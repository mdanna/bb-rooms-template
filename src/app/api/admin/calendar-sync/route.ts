import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, requireBotToken } from "@/lib/githubContent";
import { parseICalEvents, icalEventNights } from "@/lib/icalParser";
import { reconcile, type FetchedFeed, type CalendarConflict, type ReverseGap, type PlatformSummary } from "@/lib/calendarSync";
import { calendarUrlsForUnit, type Policies } from "@/lib/policies";
import { toISODate, type DayRate, type OtaPlatform, type AvailabilityData } from "@/data/availability";
import { availPath, stripContained, syncContainedLayer } from "@/lib/unitAvailability";
import { getUnit, rootUnitId } from "@/lib/structure";
import { DEMO_MODE } from "@/lib/demo";

const SETTINGS_PATH = "src/data/policies.json";
const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];

export interface CalendarSyncResult {
  unitId: string;
  perPlatform: PlatformSummary[];
  fetchErrors: { platform: OtaPlatform; error: string }[];
  conflicts: CalendarConflict[];
  reverseGaps: ReverseGap[];
  bookingDisclaimer: boolean;
  changed: boolean;
  overrides: DayRate[];
  defaultPrice: number;
}

// Serializza un override con ordine di campi stabile (per il diff no-op).
function clean(o: DayRate): DayRate {
  const r: DayRate = { date: o.date, price: o.price, status: o.status };
  if (o.source) r.source = o.source;
  if (o.note) r.note = o.note;
  if (o.blockedBy && o.blockedBy.length) r.blockedBy = o.blockedBy;
  if (o.conflict) r.conflict = o.conflict;
  if (o.conflictWith && o.conflictWith.length) r.conflictWith = o.conflictWith;
  return r;
}

// Sincronizza le OTA di UNA unità (?unit=<id>, default radice): stessa logica del sito
// (reconcile), ma applicata al calendario di quell'unità. Dopo la riconciliazione
// ricalcola il layer "contained": una prenotazione OTA su una camera blocca a cascata
// l'appartamento (e viceversa), come per le prenotazioni dirette.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();

  // In demo non si sincronizza nulla (nessun URL reale, nessuna scrittura).
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const token = requireBotToken();

  // URL dei calendari dell'unità dalle impostazioni (policies.json), con retrocompat.
  let urls: Record<OtaPlatform, string>;
  try {
    const { content } = await getFile(SETTINGS_PATH, token);
    urls = calendarUrlsForUnit(JSON.parse(content) as Policies, unitId, rootUnitId());
  } catch {
    return NextResponse.json({ error: "Impostazioni calendari non leggibili" }, { status: 400 });
  }

  const configured = PLATFORMS.filter((p) => urls[p]);
  if (configured.length === 0) {
    return NextResponse.json({ error: "Nessun calendario iCal configurato per questa unità" }, { status: 400 });
  }

  // Fetch per-piattaforma, FAIL-SAFE: se una fallisce non entra in `fetched` → i suoi
  // dati esistenti restano intatti (una notte non viene mai liberata per un fetch fallito).
  const fetched: FetchedFeed[] = [];
  const fetchErrors: { platform: OtaPlatform; error: string }[] = [];
  for (const platform of configured) {
    try {
      const res = await fetch(urls[platform], { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const events = parseICalEvents(text, platform);

      const resSet = new Set<string>();
      const reservations: { date: string; note: string }[] = [];
      const blockSet = new Set<string>();
      for (const ev of events) {
        for (const night of icalEventNights(ev)) {
          if (ev.isReservation) {
            if (!resSet.has(night)) { resSet.add(night); reservations.push({ date: night, note: ev.summary }); }
          } else {
            blockSet.add(night);
          }
        }
      }
      // Una notte che è sia prenotazione che blocco → vince la prenotazione.
      const blocks = [...blockSet].filter((n) => !resSet.has(n));
      fetched.push({ platform, reservations, blocks });
    } catch (err) {
      fetchErrors.push({ platform, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Riconciliazione (pura) sugli override PROPRI dell'unità (senza il layer "contained",
  // che è derivato e viene ricalcolato dopo).
  const { content } = await getFile(availPath(unitId), token);
  const data = JSON.parse(content) as AvailabilityData;
  const own = stripContained(data.overrides ?? []);
  const result = reconcile({
    defaultPrice: data.defaultPrice,
    currentOverrides: own,
    fetched,
    todayISO: toISODate(new Date()),
  });

  const cleanOverrides = result.overrides.map(clean);

  // Scrive il calendario dell'unità e RICALCOLA la cascata su tutte le unità collegate.
  const { overrides: finalByUnit } = await syncContainedLayer(token, `Sync calendars (${unitId})`, {
    [unitId]: cleanOverrides,
  });
  const finalUnit = finalByUnit[unitId] ?? cleanOverrides;
  const changed = JSON.stringify(finalUnit) !== JSON.stringify(data.overrides ?? []);

  const payload: CalendarSyncResult = {
    unitId,
    perPlatform: result.perPlatform,
    fetchErrors,
    conflicts: result.conflicts,
    reverseGaps: result.reverseGaps,
    bookingDisclaimer: result.bookingDisclaimer,
    changed,
    overrides: finalUnit,
    defaultPrice: data.defaultPrice,
  };
  return NextResponse.json(payload);
}
