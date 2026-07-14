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
  return totalPrice + (cityTaxOnline ? cityTax : 0);
}
