import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { verifyAccessToken } from "@/lib/accessToken";
import { unmarkNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { sendGuestCancellationEmail, sendHostCancellationNotification } from "@/lib/email";
import { quoteRefund, refundInputsFor } from "@/lib/refund";

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

  // Calcolo del rimborso secondo la policy CONGELATA sulla prenotazione (ospite → con franchigia
  // sul rimborso pieno del soggiorno). Il rimborso NON è automatico: qui salviamo l'importo dovuto
  // (refund_due) e l'host lo esegue col pulsante "Rimborsa" dal pannello.
  const inputs = refundInputsFor(booking, false);
  const quote = quoteRefund(inputs);
  const wasPaid = inputs.wasPaidOnline;

  if (wasPaid) {
    await pool.query(`UPDATE bookings SET refund_due = $2 WHERE id = $1`, [booking.id, quote.amount]);
  }

  try {
    await sendGuestCancellationEmail({
      to: booking.email,
      code: booking.code,
      unitId: booking.unit_id ?? undefined,
      firstName: booking.first_name,
      checkin: booking.checkin,
      checkout: booking.checkout,
      wasPaid,
      quote,
      policy: inputs.policy,
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
      byHost: false,
      quote,
      stripePaymentIntentId: booking.stripe_payment_intent_id,
    });
  } catch { /* non-critical */ }

  return NextResponse.json({
    ok: true,
    wasPaid,
    refundEligible: quote.amount > 0,
    refundReason: quote.reason,
    refundAmount: quote.amount > 0 ? quote.amount : null,
    calendarError,
    daysUntilCheckin: inputs.daysUntilCheckin,
  });
}
