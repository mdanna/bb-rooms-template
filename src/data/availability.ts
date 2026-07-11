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

export interface AvailabilityData {
  defaultPrice: number;
  overrides: DayRate[];
}

const data = raw as AvailabilityData;

export const DEFAULT_PRICE = data.defaultPrice;
export const OVERRIDES: DayRate[] = data.overrides;

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
