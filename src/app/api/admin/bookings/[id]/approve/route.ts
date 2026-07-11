import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";
import type { LocaleCode } from "@/i18n/index";
import { hasOverlappingBooking } from "@/lib/bookingOverlap";
import { markNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { computePricingBreakdown } from "@/lib/pricing";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const customPrice: number | null =
    body.customPrice != null && !isNaN(Number(body.customPrice)) && Number(body.customPrice) > 0
      ? Number(body.customPrice)
      : null;

  await ensureSchema();

  const pending = await pool.query<Booking>(`SELECT * FROM bookings WHERE id = $1`, [id]);
  const target = pending.rows[0];
  if (!target || target.status !== "pending") {
    return NextResponse.json(
      { error: "Prenotazione non trovata o non più in attesa" },
      { status: 404 }
    );
  }

  if (await hasOverlappingBooking(target.unit_id ?? rootUnitId(), target.checkin, target.checkout, target.id)) {
    return NextResponse.json(
      {
        error:
          "Queste date si sovrappongono a un'altra prenotazione già approvata o completata. Rifiuta una delle due richieste prima di procedere.",
      },
      { status: 409 }
    );
  }

  // Se l'admin ha impostato un prezzo personalizzato, ricalcola tutto il breakdown prima di approvare.
  if (customPrice !== null) {
    const pricing = computePricingBreakdown(customPrice, target.guests, target.checkin, target.checkout);
    await pool.query(
      `UPDATE bookings SET custom_price = $2, total_price = $2, deposit_amount = $3, city_tax = $4, balance_due = $5 WHERE id = $1`,
      [id, customPrice, pricing.depositAmount, pricing.cityTax, pricing.balanceDue]
    );
  } else if (
    (target.deposit_amount == null || target.city_tax == null || target.balance_due == null) &&
    target.total_price
  ) {
    // Fallback per prenotazioni create prima dell'introduzione della anticipo.
    const pricing = computePricingBreakdown(
      Number(target.total_price),
      target.guests,
      target.checkin,
      target.checkout
    );
    await pool.query(
      `UPDATE bookings SET deposit_amount = $2, city_tax = $3, balance_due = $4 WHERE id = $1`,
      [id, pricing.depositAmount, pricing.cityTax, pricing.balanceDue]
    );
  }

  const result = await pool.query<Booking>(
    `UPDATE bookings SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );

  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o non più in attesa" },
      { status: 404 }
    );
  }

  let calendarError: string | null = null;
  try {
    await markNightsBooked(booking.unit_id ?? rootUnitId(), booking.checkin, booking.checkout, `${booking.first_name} ${booking.last_name}`);
  } catch (err) {
    // Lo stato è comunque aggiornato: l'host viene avvisato per bloccare le date a mano
    // sul calendario se la sincronizzazione automatica fallisce.
    calendarError = err instanceof Error ? err.message : "Sincronizzazione calendario fallita";
  }

  let emailError: string | null = null;
  try {
    await sendApprovalEmail({
      to: booking.email,
      code: booking.code,
      locale: (booking.locale as LocaleCode) ?? "it",
      totalPrice: booking.total_price,
      depositAmount: booking.deposit_amount,
      balanceDue: booking.balance_due,
      cityTax: booking.city_tax,
      cityTaxOnline: booking.city_tax_online,
      guests: booking.guests,
    });
  } catch (err) {
    // Lo stato è comunque aggiornato anche se l'invio dell'email fallisce:
    // l'errore viene riportato all'admin invece di essere ignorato in silenzio.
    emailError = err instanceof Error ? err.message : "Invio email fallito";
  }

  return NextResponse.json({ ok: true, booking, emailError, calendarError });
}
