import { getFile, requireBotToken } from "@/lib/githubContent";
import { parseICalEvents, icalEventNights } from "@/lib/icalParser";
import { reconcile, type FetchedFeed, type CalendarConflict, type ReverseGap, type PlatformSummary } from "@/lib/calendarSync";
import { calendarUrlsForUnit, type Policies } from "@/lib/policies";
import { toISODate, type DayRate, type OtaPlatform, type AvailabilityData } from "@/data/availability";
import { availPath, stripContained, syncContainedLayer } from "@/lib/unitAvailability";
import { getUnit, rootUnitId } from "@/lib/structure";

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

export type SyncOutcome =
  | { ok: true; result: CalendarSyncResult }
  | { ok: false; reason: "settings-unreadable" | "no-calendars" };

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

/**
 * Importa le prenotazioni OTA di UNA unità e riconcilia il suo calendario, poi RICALCOLA
 * il layer "contained" (una prenotazione su una camera blocca a cascata l'appartamento e
 * viceversa). FAIL-SAFE: un feed che non risponde non libera mai le notti esistenti.
 * Motore condiviso tra il pulsante manuale (sessione admin) e il cron automatico.
 */
export async function runCalendarSync(requestedUnit?: string | null): Promise<SyncOutcome> {
  const unitId = requestedUnit && getUnit(requestedUnit) ? requestedUnit : rootUnitId();
  const token = requireBotToken();

  // URL dei calendari dell'unità dalle impostazioni (policies.json), con retrocompat.
  let urls: Record<OtaPlatform, string>;
  try {
    const { content } = await getFile(SETTINGS_PATH, token);
    urls = calendarUrlsForUnit(JSON.parse(content) as Policies, unitId, rootUnitId());
  } catch {
    return { ok: false, reason: "settings-unreadable" };
  }

  const configured = PLATFORMS.filter((p) => urls[p]);
  if (configured.length === 0) {
    return { ok: false, reason: "no-calendars" };
  }

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

  return {
    ok: true,
    result: {
      unitId,
      perPlatform: result.perPlatform,
      fetchErrors,
      conflicts: result.conflicts,
      reverseGaps: result.reverseGaps,
      bookingDisclaimer: result.bookingDisclaimer,
      changed,
      overrides: finalUnit,
      defaultPrice: data.defaultPrice,
    },
  };
}
