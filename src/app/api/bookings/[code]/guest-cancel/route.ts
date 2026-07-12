import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { verifyAccessToken } from "@/lib/accessToken";
import { unmarkNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { parseDateOnly } from "@/lib/dateOnly";
import { sendGuestCancellationEmail, sendHostCancellationNotification } from "@/lib/email";
import { computeRefund, CANCEL_FEE_PERCENT } from "@/lib/pricing";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const { token } = await request.json().catch(() => ({}));

  if (!verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Link non valido o scaduto" }, { status: 401 });
  }

  await ensureSchema();

  // Cancellazione atomica in un'unica istruzione: la CTE `locked` blocca la riga con
  // FOR UPDATE, `upd` la porta a 'cancelled', e la SELECT finale restituisce lo stato
  // PRECEDENTE al lock. Così un pagamento che completa in parallelo (webhook Stripe) non
  // viene sovrascritto in modo silenzioso e wasPaid/rimborso sono calcolati sullo stato
  // reale al momento del lock, non su una lettura obsoleta.
  const before = await pool.query<Booking>(
    `WITH locked AS (
       SELECT * FROM bookings
       WHERE code = $1 AND status IN ('pending', 'approved', 'completed')
       FOR UPDATE
     ), upd AS (
       UPDATE bookings SET status = 'cancelled' WHERE id IN (SELECT id FROM locked) RETURNING id
     )
     SELECT * FROM locked`,
    [code]
  );
  const booking = before.rows[0];
  if (!booking) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o già annullata" },
      { status: 404 }
    );
  }

  let calendarError: string | null = null;
  try {
    await unmarkNightsBooked(booking.unit_id ?? rootUnitId(), booking.checkin, booking.checkout);
  } catch (err) {
    calendarError = err instanceof Error ? err.message : "Sincronizzazione calendario fallita";
  }

  const wasPaid = booking.status === "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilCheckin = Math.round(
    (parseDateOnly(booking.checkin).getTime() - today.getTime()) / 86_400_000
  );

  const depositAmount = Number(booking.deposit_amount ?? 0);
  const balancePaid = booking.balance_paid_at != null ? Number(booking.balance_due ?? 0) : 0;
  const totalPaid = depositAmount + balancePaid;
  // Opzione A: la tassa di soggiorno online è stata incassata con l'anticipo →
  // va rimborsata. Prenotazioni vecchie (flag null/false): tassa mai incassata →
  // cityTax=0, nessun rimborso tassa, comportamento invariato.
  const cityTaxCollected =
    booking.city_tax_online === true ? Number(booking.city_tax ?? 0) : 0;
  const refund = wasPaid
    ? computeRefund(totalPaid, daysUntilCheckin, cityTaxCollected)
    : { eligible: false, amount: 0, reason: "none" as const, cityTaxRefund: 0 };

  try {
    await sendGuestCancellationEmail({
      to: booking.email,
      code: booking.code,
      unitId: booking.unit_id ?? undefined,
      firstName: booking.first_name,
      checkin: booking.checkin,
      checkout: booking.checkout,
      wasPaid,
      refundEligible: refund.eligible,
      refundAmount: refund.amount,
      feePercent: CANCEL_FEE_PERCENT,
      locale: (booking.locale as import("@/i18n/index").LocaleCode) ?? "it",
    });
  } catch { /* non-critical */ }

  try {
    await sendHostCancellationNotification({
      code: booking.code,
      unitId: booking.unit_id ?? undefined,
      firstName: booking.first_name,
      lastName: booking.last_name,
      email: booking.email,
      checkin: booking.checkin,
      checkout: booking.checkout,
      wasPaid,
      refundEligible: refund.eligible,
      depositAmount: totalPaid,
      refundAmount: refund.amount,
      feePercent: CANCEL_FEE_PERCENT,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
    });
  } catch { /* non-critical */ }

  return NextResponse.json({
    ok: true,
    wasPaid,
    refundEligible: refund.eligible,
    refundReason: refund.reason,
    refundAmount: refund.eligible ? refund.amount : null,
    calendarError,
    daysUntilCheckin,
  });
}
