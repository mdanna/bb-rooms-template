import rawPolicies from "@/data/policies.json";
import type { OtaPlatform } from "@/data/availability";

export type CalendarUrls = Record<OtaPlatform, string>; // { airbnb, booking, vrbo }

export interface Policies {
  airbnbIcalUrl?: string; // legacy: singolo URL Airbnb (letto come calendars.airbnb)
  calendars?: Partial<CalendarUrls>;
  // Struttura con camere: URL iCal OTA PER UNITÀ (appartamento intero + ogni camera
  // hanno le proprie inserzioni). Chiave = unit id. L'unità radice ricade su
  // `calendars` (retro-compat col sito a unità singola) se qui non ha una voce.
  unitCalendars?: Record<string, Partial<CalendarUrls>>;
  // Prenotazione esterna (bottone pubblico "Prenota su…"): URL degli annunci sulle
  // OTA + piattaforma di default. `airbnbUrl` legge in fallback il vecchio
  // `content.airbnbUrl` finché non viene salvato qui (vedi bookingLinks.ts).
  airbnbUrl?: string;
  bookingUrl?: string;
  vrboUrl?: string;
  defaultBookingPlatform?: OtaPlatform;
  cityTaxPerPersonPerNight: number;
  cityTaxMaxNights: number;
  defaultDepositRate: number;
  minDepositRate: number;
  balanceDueDays: number;
  cancelFullRefundDays: number;
  cancelHalfRefundDays: number;
  cancelPartialRefundPct: number;
  cancelFeePercent: number;
  minAdvanceBookingDays: number;
  minNights: number;
  maxNights: number;
  maxGuests: number;
  balanceReminderDaysFirst: number;
  balanceReminderDaysSecond: number;
  checkinTime: string;
  checkoutTime: string;
  // Lingua del pannello di amministrazione: scelta in configurazione, modificabile
  // in Impostazioni. Default "it". (Il sito pubblico resta multilingua a parte.)
  adminLocale?: "it" | "en" | "es" | "fr";
}

export const POLICIES: Policies = rawPolicies as Policies;

export const ADMIN_LOCALES = ["it", "en", "es", "fr"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];

// Nome del cookie con la lingua del pannello scelta dall'operatore (preferenza per-browser,
// effetto immediato). Definito qui (modulo server+client) così il layout server può leggerlo:
// una costante esportata da un modulo "use client" arriva ai server component come reference,
// non come stringa.
export const ADMIN_LOCALE_COOKIE = "admin_locale";

/** Lingua del pannello admin dalle policy, con default "it". */
export function resolveAdminLocale(): AdminLocale {
  const l = POLICIES.adminLocale;
  return l && (ADMIN_LOCALES as readonly string[]).includes(l) ? (l as AdminLocale) : "it";
}

// Risolve i 3 URL iCal dalle policy, con retrocompat dal vecchio `airbnbIcalUrl`.
export function calendarUrlsFromPolicies(p: Pick<Policies, "airbnbIcalUrl" | "calendars">): CalendarUrls {
  const c = p.calendars ?? {};
  return {
    airbnb: (c.airbnb ?? p.airbnbIcalUrl ?? "").trim(),
    booking: (c.booking ?? "").trim(),
    vrbo: (c.vrbo ?? "").trim(),
  };
}

// URL iCal OTA di UNA unità. Le camere leggono da `unitCalendars[unitId]`; l'unità
// radice ricade sul singolo `calendars`/`airbnbIcalUrl` se non ha una voce dedicata
// (così un sito a unità singola migrato a struttura non perde la sua configurazione).
export function calendarUrlsForUnit(
  p: Pick<Policies, "airbnbIcalUrl" | "calendars" | "unitCalendars">,
  unitId: string,
  rootId: string
): CalendarUrls {
  const per = p.unitCalendars?.[unitId];
  if (per) {
    return {
      airbnb: (per.airbnb ?? "").trim(),
      booking: (per.booking ?? "").trim(),
      vrbo: (per.vrbo ?? "").trim(),
    };
  }
  // Nessuna voce per-unità: la radice eredita il singolo calendario legacy; le camere no.
  if (unitId === rootId) return calendarUrlsFromPolicies(p);
  return { airbnb: "", booking: "", vrbo: "" };
}
