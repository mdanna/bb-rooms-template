import { nightsBetween } from "./dateOnly";
import { POLICIES } from "./policies";

export const CITY_TAX_PER_PERSON_PER_NIGHT = POLICIES.cityTaxPerPersonPerNight;
export const CITY_TAX_MAX_NIGHTS = POLICIES.cityTaxMaxNights;

// Modello di pagamento: importo INTERO alla prenotazione (dopo l'approvazione host).
// Niente più acconto/saldo. La tassa di soggiorno resta un importo a parte, incassabile
// online insieme al soggiorno oppure al check-in (flag city_tax_online sulla prenotazione).
export interface PricingBreakdown {
  totalPrice: number;
  cityTax: number;
}

export function computePricingBreakdown(
  totalPrice: number,
  guests: number,
  checkin: string | Date,
  checkout: string | Date,
): PricingBreakdown {
  const nights = nightsBetween(checkin, checkout);
  const cityTaxNights = Math.min(nights, CITY_TAX_MAX_NIGHTS);
  const cityTax = CITY_TAX_PER_PERSON_PER_NIGHT * guests * cityTaxNights;
  return { totalPrice, cityTax };
}

/** Importo incassato online per una prenotazione pagata: soggiorno + tassa se online. */
export function chargedAmount(totalPrice: number, cityTax: number, cityTaxOnline: boolean): number {
  // I valori arrivano dal DB tipizzati number ma a runtime spesso sono stringhe:
  // senza coercizione `+` fa concatenazione (es. "600" + "48" → "60048"). Number() è
  // identità per i number veri e parsa le stringhe numeriche.
  return Number(totalPrice) + (cityTaxOnline ? Number(cityTax) : 0);
}
