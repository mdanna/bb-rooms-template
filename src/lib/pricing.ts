import { nightsBetween } from "./dateOnly";
import { POLICIES } from "./policies";

export const CITY_TAX_PER_PERSON_PER_NIGHT = POLICIES.cityTaxPerPersonPerNight;
export const CITY_TAX_MAX_NIGHTS          = POLICIES.cityTaxMaxNights;
export const DEFAULT_DEPOSIT_RATE         = POLICIES.minDepositRate;
export const MIN_DEPOSIT_RATE             = POLICIES.minDepositRate;
export const MAX_DEPOSIT_RATE             = 1.0;
export const BALANCE_DUE_DAYS             = POLICIES.balanceDueDays;
export const CANCEL_FULL_REFUND_DAYS      = POLICIES.cancelFullRefundDays;
export const CANCEL_HALF_REFUND_DAYS      = POLICIES.cancelHalfRefundDays;
export const CANCEL_FEE_PERCENT           = POLICIES.cancelFeePercent;
export const CANCEL_PARTIAL_REFUND_PCT    = POLICIES.cancelPartialRefundPct;

export interface PricingBreakdown {
  totalPrice: number;
  depositAmount: number;
  depositRate: number;
  cityTax: number;
  balanceDue: number;
}

export function computePricingBreakdown(
  totalPrice: number,
  guests: number,
  checkin: string | Date,
  checkout: string | Date,
  depositRate: number = DEFAULT_DEPOSIT_RATE
): PricingBreakdown {
  const rate = Math.min(Math.max(depositRate, MIN_DEPOSIT_RATE), MAX_DEPOSIT_RATE);
  const nights = nightsBetween(checkin, checkout);
  const cityTaxNights = Math.min(nights, CITY_TAX_MAX_NIGHTS);
  const cityTax = CITY_TAX_PER_PERSON_PER_NIGHT * guests * cityTaxNights;
  const depositAmount = Math.round(totalPrice * rate);
  const balanceDue = totalPrice - depositAmount;
  return { totalPrice, depositAmount, depositRate: rate, cityTax, balanceDue };
}

export function computeRefund(
  depositAmount: number,
  daysUntilCheckin: number,
  cityTax: number = 0
): { eligible: boolean; amount: number; reason: "full" | "half" | "none"; cityTaxRefund: number } {
  // Opzione A: quando la tassa di soggiorno è stata incassata online (con
  // l'anticipo), va rimborsata INTERA in caso di cancellazione — la tassa per
  // notti non godute non è dovuta, indipendentemente dalla finestra di penale
  // che si applica solo all'anticipo. Le prenotazioni vecchie passano cityTax=0
  // (tassa mai incassata) e il comportamento resta identico a prima.
  const cityTaxRefund = cityTax > 0 ? cityTax : 0;
  const fee = Math.round(depositAmount * CANCEL_FEE_PERCENT) / 100;
  if (daysUntilCheckin > CANCEL_FULL_REFUND_DAYS) {
    return { eligible: true, amount: depositAmount - fee + cityTaxRefund, reason: "full", cityTaxRefund };
  }
  if (daysUntilCheckin >= CANCEL_HALF_REFUND_DAYS) {
    const partial = Math.round(depositAmount * CANCEL_PARTIAL_REFUND_PCT) / 100;
    return { eligible: true, amount: partial - fee + cityTaxRefund, reason: "half", cityTaxRefund };
  }
  // Nessun rimborso dell'anticipo, ma la tassa online resta comunque dovuta al
  // rimborso: se presente, la cancellazione è "eligible" per il solo importo tassa.
  return { eligible: cityTaxRefund > 0, amount: cityTaxRefund, reason: "none", cityTaxRefund };
}
