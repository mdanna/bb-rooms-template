import { POLICIES } from "./policies";
import { parseDateOnly } from "./dateOnly";
import type { Booking } from "./db";

// Politiche di rimborso stile Airbnb, a LIVELLI. L'host sceglie il livello nelle
// policy; il livello viene CONGELATO su ogni prenotazione (colonna refund_policy) e
// non cambia se l'host poi modifica la policy. Il calcolo del rimborso avviene sempre
// sul livello congelato della singola prenotazione.

export type RefundPolicy = "flexible" | "moderate" | "strict";
export const REFUND_POLICIES: RefundPolicy[] = ["flexible", "moderate", "strict"];

export function isRefundPolicy(v: unknown): v is RefundPolicy {
  return typeof v === "string" && (REFUND_POLICIES as string[]).includes(v);
}

/** Livello effettivo di una prenotazione: quello congelato, con fallback alla policy corrente. */
export function refundPolicyOf(frozen: string | null | undefined): RefundPolicy {
  if (isRefundPolicy(frozen)) return frozen;
  const cur = POLICIES.refundPolicy;
  return isRefundPolicy(cur) ? cur : "moderate";
}

// Soglie in GIORNI prima del check-in per ciascun livello.
//  - flexible: rimborso pieno se si cancella con ≥1 giorno (24h) di anticipo.
//  - moderate: pieno con ≥5 giorni.
//  - strict:   pieno ≥30 giorni; 50% da 30 a 7 giorni; niente sotto i 7.
const TIERS: Record<RefundPolicy, { fullDays: number; halfDays: number | null }> = {
  flexible: { fullDays: 1, halfDays: null },
  moderate: { fullDays: 5, halfDays: null },
  strict: { fullDays: 30, halfDays: 7 },
};

// Finestra di grazia: rimborso pieno se si cancella entro 48h dalla prenotazione E il
// check-in è ancora lontano (≥14 giorni). Come Airbnb.
const GRACE_HOURS = 48;
const GRACE_MIN_DAYS_TO_CHECKIN = 14;

/** Franchigia (%) trattenuta sui rimborsi TOTALI da guest, a copertura dei costi di transazione. */
export function franchisePct(): number {
  const v = POLICIES.franchiseRefundPct;
  return typeof v === "number" && v >= 0 ? v : 3.5;
}

export interface RefundQuote {
  /** Totale da rimborsare = quota soggiorno + tassa di soggiorno. */
  amount: number;
  /** Quota rimborsata del solo SOGGIORNO (dopo livello/franchigia). */
  stayRefund: number;
  /** Tassa di soggiorno rimborsata: SEMPRE il 100% di quella incassata online. */
  cityTaxRefund: number;
  /** Esito riferito alla sola quota SOGGIORNO. */
  kind: "full" | "partial" | "none";
  /** Quota trattenuta come franchigia (solo su rimborso pieno del soggiorno da guest). */
  franchise: number;
  /** Chiave motivo (per email/UI): livello o "host_cancel"/"nothing_paid". */
  reason: string;
}

/**
 * Calcola il rimborso di una cancellazione. Tratta SEPARATAMENTE:
 *  - la quota SOGGIORNO (`stayPaid`): soggetta a livello + grazia 48h + franchigia
 *    (solo sul rimborso pieno da guest);
 *  - la TASSA DI SOGGIORNO (`cityTaxPaid`): SEMPRE rimborsata al 100% se incassata
 *    online (è una tassa non dovuta per notti non godute).
 * `byHost`: cancellazione dell'host → soggiorno 100% senza franchigia + tassa 100%.
 * Prenotazioni "paga-al-check-in" hanno stayPaid=cityTaxPaid=0 → nessun rimborso.
 * NB: all'esecuzione il refund va espresso in centesimi e limitato all'importo REALE
 * del PaymentIntent Stripe (vedi endpoint refund).
 */
export function quoteRefund(opts: {
  stayPaid: number;
  cityTaxPaid: number;
  policy: RefundPolicy;
  daysUntilCheckin: number;
  hoursSinceBooking: number;
  byHost: boolean;
}): RefundQuote {
  const { stayPaid, cityTaxPaid, policy, daysUntilCheckin, hoursSinceBooking, byHost } = opts;
  const cityTaxRefund = cityTaxPaid > 0 ? Math.round(cityTaxPaid) : 0; // sempre 100%

  if (stayPaid <= 0 && cityTaxRefund <= 0) {
    return { amount: 0, stayRefund: 0, cityTaxRefund: 0, kind: "none", franchise: 0, reason: "nothing_paid" };
  }

  // Cancellazione dell'host → soggiorno pieno senza franchigia (+ tassa 100%).
  if (byHost) {
    return { amount: stayPaid + cityTaxRefund, stayRefund: stayPaid, cityTaxRefund, kind: "full", franchise: 0, reason: "host_cancel" };
  }

  const inGrace = hoursSinceBooking <= GRACE_HOURS && daysUntilCheckin >= GRACE_MIN_DAYS_TO_CHECKIN;
  const tier = TIERS[policy];

  let kind: "full" | "partial" | "none";
  if (inGrace || daysUntilCheckin >= tier.fullDays) kind = "full";
  else if (tier.halfDays !== null && daysUntilCheckin >= tier.halfDays) kind = "partial";
  else kind = "none";

  let stayRefund = 0;
  let franchise = 0;
  if (kind === "full") {
    franchise = Math.round((stayPaid * franchisePct()) / 100);
    stayRefund = Math.max(0, stayPaid - franchise);
  } else if (kind === "partial") {
    stayRefund = Math.round(stayPaid * 0.5);
  }

  return { amount: stayRefund + cityTaxRefund, stayRefund, cityTaxRefund, kind, franchise, reason: policy };
}

/**
 * Deriva gli input di `quoteRefund` da una prenotazione e da chi cancella (host o ospite),
 * così i due percorsi di cancellazione (admin e guest) calcolano il rimborso in modo identico.
 * "Pagato online" = prenotazione `completed` CON un PaymentIntent Stripe: le prenotazioni
 * paga-al-check-in sono `completed` ma senza PI → nulla è stato incassato online, nessun rimborso.
 */
export function refundInputsFor(
  b: Pick<
    Booking,
    | "status"
    | "stripe_payment_intent_id"
    | "total_price"
    | "custom_price"
    | "city_tax"
    | "city_tax_online"
    | "created_at"
    | "checkin"
    | "refund_policy"
  >,
  byHost: boolean,
  now: Date = new Date(),
): {
  wasPaidOnline: boolean;
  stayPaid: number;
  cityTaxPaid: number;
  policy: RefundPolicy;
  daysUntilCheckin: number;
  hoursSinceBooking: number;
  byHost: boolean;
} {
  const wasPaidOnline = b.status === "completed" && !!b.stripe_payment_intent_id;
  const stayPaid = wasPaidOnline ? Number(b.custom_price ?? b.total_price ?? 0) : 0;
  const cityTaxPaid = wasPaidOnline && b.city_tax_online === true ? Number(b.city_tax ?? 0) : 0;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const daysUntilCheckin = Math.round(
    (parseDateOnly(b.checkin).getTime() - midnight.getTime()) / 86_400_000,
  );
  const hoursSinceBooking = (now.getTime() - new Date(b.created_at).getTime()) / 3_600_000;
  return {
    wasPaidOnline,
    stayPaid,
    cityTaxPaid,
    policy: refundPolicyOf(b.refund_policy),
    daysUntilCheckin,
    hoursSinceBooking,
    byHost,
  };
}
