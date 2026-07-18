import raw from "./availability.json";

export type DayStatus = "available" | "booked";

// OTA con calendario iCal importabile.
export type OtaPlatform = "airbnb" | "booking" | "vrbo";

// Prenotazioni: airbnb/booking/vrbo (OTA), app (dal sito), direct (manuale).
// Blocchi: "blocked" = manuale (viola chiaro, editabile), "imported" = blocco
// importato da una OTA (grigio, non editabile). Legacy: "airbnb-blocked" viene
// trattato come "imported" (riscritto al primo sync).
// "contained" = blocco DERIVATO dal contenimento (struttura con camere): la notte è
// occupata su un'unità collegata (antenato o discendente), quindi questa unità non è
// prenotabile. Non editabile e non esportato come proprio: è ricalcolato dallo stato
// delle unità collegate (vedi src/lib/unitAvailability.ts, computeContainedLayer).
export type DaySource =
  | "airbnb" | "booking" | "vrbo"
  | "app" | "direct"
  | "blocked" | "imported"
  | "contained"
  | "airbnb-blocked";

export interface DayRate {
  date: string; // YYYY-MM-DD
  price: number; // EUR per night
  status: DayStatus;
  source?: DaySource; // undefined = "blocked" (backward compat)
  note?: string;
  conflict?: boolean; // true = overbooking (≥2 prenotazioni indipendenti sulla notte)
  blockedBy?: OtaPlatform[]; // per i blocchi "imported": su quali calendari OTA è bloccata
  conflictWith?: OtaPlatform[]; // per l'overbooking: quali OTA rivendicano la notte
}

// Regola di soggiorno per un intervallo di date di CHECK-IN [from, to] (inclusi,
// YYYY-MM-DD): impone una durata minima e/o massima ai soggiorni che iniziano in
// quell'intervallo. I campi opzionali cadono sul valore di policy (minNights/maxNights).
export interface StayRule {
  from: string; // YYYY-MM-DD (incluso) — si applica alle date di CHECK-IN
  to: string;   // YYYY-MM-DD (incluso)
  minStay?: number;
  maxStay?: number;
}

export interface AvailabilityData {
  defaultPrice: number;
  overrides: DayRate[];
  // Opzionale: assente sui vecchi availability.json (fallback `?? []`), così il
  // comportamento di default resta invariato finché l'host non aggiunge regole.
  stayRules?: StayRule[];
}

const data = raw as AvailabilityData;

export const DEFAULT_PRICE = data.defaultPrice;
export const OVERRIDES: DayRate[] = data.overrides;
export const STAY_RULES: StayRule[] = data.stayRules ?? [];

// Durata min/max effettiva per una data di check-in, applicando l'ULTIMA regola il cui
// intervallo [from, to] contiene la data (last-match-wins). Se nessuna regola combacia,
// tornano i default di policy. min/max di una regola cadono sul default se non impostati.
export function stayLimitsFor(
  checkinISO: string,
  rules: StayRule[],
  defaults: { min: number; max: number }
): { min: number; max: number } {
  let match: StayRule | undefined;
  for (const r of rules) {
    if (!r || typeof r.from !== "string" || typeof r.to !== "string") continue;
    if (checkinISO >= r.from && checkinISO <= r.to) match = r; // l'ultima che combacia vince
  }
  if (!match) return { min: defaults.min, max: defaults.max };
  return {
    min: typeof match.minStay === "number" ? match.minStay : defaults.min,
    max: typeof match.maxStay === "number" ? match.maxStay : defaults.max,
  };
}

// Variante che legge le regole del bundle build-time (STAY_RULES), come getDayRate fa con
// OVERRIDES. Utile lato server/build; il runtime usa `stayLimitsFor` con le regole caricate.
export function getStayLimits(
  checkinISO: string,
  defaults: { min: number; max: number }
): { min: number; max: number } {
  return stayLimitsFor(checkinISO, STAY_RULES, defaults);
}

// Numero di notti prenotabili consecutive a partire dalla data di check-in: conta i giorni
// il cui stato NON è "booked" fino alla prima notte occupata (la dimensione del "buco"
// disponibile che inizia al check-in). Cap di sicurezza per calendari interamente liberi.
export function availableGapNights(checkinISO: string, getRate: (d: Date) => DayRate): number {
  const [y, m, d] = checkinISO.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const cur = new Date(y, m - 1, d);
  let count = 0;
  while (getRate(cur).status !== "booked") {
    count++;
    cur.setDate(cur.getDate() + 1);
    if (count >= 370) break; // calendario libero: nessun buco rilevante
  }
  return count;
}

export function getDayRate(date: Date): DayRate {
  const iso = toISODate(date);
  const override = OVERRIDES.find((o) => o.date === iso);
  if (override) return override;
  return { date: iso, price: DEFAULT_PRICE, status: "available" };
}

// Returns a getDayRate bound to dynamic data (fetched at runtime, not the static build-time bundle).
export function makeDayRateFn(defaultPrice: number, overrides: DayRate[]) {
  const map = new Map(overrides.map((o) => [o.date, o]));
  return (date: Date): DayRate => {
    const iso = toISODate(date);
    return map.get(iso) ?? { date: iso, price: defaultPrice, status: "available" };
  };
}

// `toISOString()` converte in UTC: con un fuso orario locale avanti rispetto a UTC (es. la
// sera tardi in Italia, o di giorno negli USA) la data può scivolare al giorno precedente.
// Qui lavoriamo sempre sui componenti locali della data, mai sulla sua rappresentazione UTC.
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
