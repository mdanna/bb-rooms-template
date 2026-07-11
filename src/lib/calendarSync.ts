import type { DayRate, DaySource, OtaPlatform } from "@/data/availability";

// Feed classificato di una piattaforma (solo quelle il cui fetch è riuscito).
export interface FetchedFeed {
  platform: OtaPlatform;
  reservations: { date: string; note: string }[]; // per-notte
  blocks: string[]; // notti bloccate (non prenotazioni)
}

export interface CalendarConflict {
  date: string;
  platforms: OtaPlatform[]; // OTA che rivendicano una notte già occupata
  note?: string;            // nota della prenotazione già presente
}

export interface ReverseGap {
  label: string;            // nome/nota della prenotazione (o intervallo)
  nights: string[];
  missingOn: OtaPlatform[]; // OTA su cui queste notti NON risultano bloccate
}

export interface PlatformSummary {
  platform: OtaPlatform;
  reservations: number;
  blocks: number;
}

export interface ReconcileResult {
  overrides: DayRate[];
  conflicts: CalendarConflict[];
  reverseGaps: ReverseGap[];
  perPlatform: PlatformSummary[];
  bookingDisclaimer: boolean; // true se Booking è tra le piattaforme sincronizzate
}

function normalizeLegacy(o: DayRate): DayRate {
  // "airbnb-blocked" (schema vecchio) → blocco importato da Airbnb.
  if (o.source === "airbnb-blocked") {
    return { ...o, source: "imported", blockedBy: ["airbnb"] };
  }
  return o;
}

function isOtaReservationSource(s: DaySource | undefined): s is OtaPlatform {
  return s === "airbnb" || s === "booking" || s === "vrbo";
}
function isOwnBooking(o: DayRate | undefined): boolean {
  return !!o && o.status === "booked" && (o.source === "app" || o.source === "direct");
}
function isImported(o: DayRate | undefined): boolean {
  return !!o && o.status === "booked" && o.source === "imported";
}

function clearConflict(o: DayRate): DayRate {
  if (!o.conflict && !o.conflictWith) return o;
  const copy = { ...o };
  delete copy.conflict;
  delete copy.conflictWith;
  return copy;
}
function withConflict(o: DayRate, platform: OtaPlatform): DayRate {
  const list = o.conflictWith ?? [];
  const conflictWith = list.includes(platform) ? list : [...list, platform];
  return { ...o, conflict: true, conflictWith };
}

function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Riconcilia gli override attuali con i feed OTA appena scaricati.
// - Reset FAIL-SAFE: rimuove solo i dati delle piattaforme il cui fetch è riuscito;
//   quelle fallite (assenti da `fetched`) conservano il loro ultimo import.
// - Prenotazioni prima, blocchi dopo: un blocco che coincide con una prenotazione
//   (di qualunque tipo) o con un blocco manuale viene scartato (de-dup).
// - Overbooking: notte con ≥2 prenotazioni indipendenti (OTA+OTA o OTA+app/direct);
//   la prenotazione "propria" (app/direct) non viene mai sovrascritta.
export function reconcile(params: {
  defaultPrice: number;
  currentOverrides: DayRate[];
  fetched: FetchedFeed[];
  todayISO: string;
}): ReconcileResult {
  const { defaultPrice, fetched, todayISO } = params;
  const successful = new Set<OtaPlatform>(fetched.map((f) => f.platform));

  // Passo 0 — normalizza legacy, reset fail-safe, azzera i conflitti (ricalcolati sotto)
  const byDate = new Map<string, DayRate>();
  for (const raw of params.currentOverrides) {
    const o = normalizeLegacy(raw);
    if (isOtaReservationSource(o.source) && successful.has(o.source)) continue; // reset prenotazioni OTA riuscite
    if (o.source === "imported" && o.blockedBy) {
      const remaining = o.blockedBy.filter((p) => !successful.has(p));
      if (remaining.length === 0) continue; // blocco tutto delle piattaforme riuscite → drop
      byDate.set(o.date, clearConflict({ ...o, blockedBy: remaining }));
      continue;
    }
    byDate.set(o.date, clearConflict(o));
  }

  // Passo A — prenotazioni OTA (ordine fisso airbnb→booking→vrbo via input)
  for (const feed of fetched) {
    for (const { date, note } of feed.reservations) {
      const existing = byDate.get(date);
      if (isOwnBooking(existing)) {
        // OTA vs prenotazione propria → overbooking, NON sovrascrivere la propria
        byDate.set(date, withConflict(existing!, feed.platform));
      } else if (isOtaReservationSource(existing?.source)) {
        // OTA vs OTA → overbooking; tieni la prima, aggiungi la piattaforma
        byDate.set(date, withConflict(existing!, feed.platform));
      } else {
        // libera / blocco manuale / imported → la prenotazione vince
        byDate.set(date, { date, price: defaultPrice, status: "booked", source: feed.platform, ...(note ? { note } : {}) });
      }
    }
  }

  // Passo B — blocchi importati (de-dup: scarta se coincide con prenotazione o blocco manuale)
  for (const feed of fetched) {
    for (const date of feed.blocks) {
      const existing = byDate.get(date);
      if (existing && existing.status === "booked") {
        if (isImported(existing)) {
          const blockedBy = existing.blockedBy ?? [];
          if (!blockedBy.includes(feed.platform)) {
            byDate.set(date, { ...existing, blockedBy: [...blockedBy, feed.platform] });
          }
        }
        continue; // prenotazione o blocco manuale → de-dup
      }
      byDate.set(date, { date, price: defaultPrice, status: "booked", source: "imported", blockedBy: [feed.platform] });
    }
  }

  const overrides = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  const conflicts: CalendarConflict[] = overrides
    .filter((o) => o.conflict)
    .map((o) => ({ date: o.date, platforms: o.conflictWith ?? [], note: o.note }));

  // Reverse-gap: prenotazioni proprie (app/direct) non coperte sulle OTA sincronizzate
  const coverage = new Map<OtaPlatform, Set<string>>();
  for (const feed of fetched) {
    const set = new Set<string>();
    for (const r of feed.reservations) set.add(r.date);
    for (const b of feed.blocks) set.add(b);
    coverage.set(feed.platform, set);
  }
  const platforms = fetched.map((f) => f.platform);
  const reverseGaps = computeReverseGaps(overrides, platforms, coverage, todayISO);

  const perPlatform: PlatformSummary[] = fetched.map((f) => ({
    platform: f.platform,
    reservations: f.reservations.length,
    blocks: f.blocks.length,
  }));

  return { overrides, conflicts, reverseGaps, perPlatform, bookingDisclaimer: successful.has("booking") };
}

function computeReverseGaps(
  overrides: DayRate[],
  platforms: OtaPlatform[],
  coverage: Map<OtaPlatform, Set<string>>,
  todayISO: string
): ReverseGap[] {
  if (platforms.length === 0) return [];
  const byDate = new Map(overrides.map((o) => [o.date, o]));
  const ownNights = overrides
    .filter((o) => o.status === "booked" && (o.source === "app" || o.source === "direct") && o.date >= todayISO)
    .map((o) => o.date)
    .sort();

  const visited = new Set<string>();
  const gaps: ReverseGap[] = [];
  for (const start of ownNights) {
    if (visited.has(start)) continue;
    const src = byDate.get(start)!.source;
    const run: string[] = [];
    let cur = start;
    while (true) {
      const o = byDate.get(cur);
      if (!o || o.status !== "booked" || o.source !== src || visited.has(cur)) break;
      visited.add(cur);
      run.push(cur);
      cur = nextDay(cur);
    }
    const missingOn = platforms.filter((p) => run.some((n) => !coverage.get(p)?.has(n)));
    if (missingOn.length > 0) {
      const label = byDate.get(start)?.note || `${run[0]} → ${nextDay(run[run.length - 1])}`;
      gaps.push({ label, nights: run, missingOn });
    }
  }
  return gaps;
}
