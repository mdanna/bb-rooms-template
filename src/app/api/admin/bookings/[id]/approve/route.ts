import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { sendApprovalEmail, sendCheckinRecapEmail } from "@/lib/email";
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
  // Eccezione "paga al check-in": l'host, a sua discrezione, salta il pagamento online.
  // La prenotazione va diretta a 'completed' (payment_method='checkin'); nessun incasso
  // online → in caso di cancellazione non c'è nulla da rimborsare.
  const payAtCheckin = body.payAtCheckin === true;

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

  // Modello a pagamento intero: niente più acconto/saldo. Congeliamo solo il prezzo
  // (eventualmente personalizzato dall'host) e la tassa di soggiorno.
  if (customPrice !== null) {
    const pricing = computePricingBreakdown(customPrice, target.guests, target.checkin, target.checkout);
    await pool.query(
      `UPDATE bookings SET custom_price = $2, total_price = $2, city_tax = $3 WHERE id = $1`,
      [id, customPrice, pricing.cityTax]
    );
  } else if (target.city_tax == null && target.total_price) {
    // Fallback per prenotazioni create prima del calcolo della tassa di soggiorno.
    const pricing = computePricingBreakdown(
      Number(target.total_price),
      target.guests,
      target.checkin,
      target.checkout
    );
    await pool.query(`UPDATE bookings SET city_tax = $2 WHERE id = $1`, [id, pricing.cityTax]);
  }

  // Stato di destinazione: 'completed' se paga-al-check-in (nessun pagamento online atteso),
  // altrimenti 'approved' (l'ospite paga l'intero importo online dalla pagina di pagamento).
  const nextStatus = payAtCheckin ? "completed" : "approved";
  const result = await pool.query<Booking>(
    payAtCheckin
      ? `UPDATE bookings SET status = 'completed', payment_method = 'checkin' WHERE id = $1 AND status = 'pending' RETURNING *`
      : `UPDATE bookings SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING *`,
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
    if (payAtCheckin) {
      // Ricapitolazione check-in: importo (soggiorno + tassa) da saldare all'arrivo, nessun link di pagamento.
      await sendCheckinRecapEmail({
        to: booking.email,
        code: booking.code,
        unitId: booking.unit_id ?? undefined,
        locale: (booking.locale as LocaleCode) ?? "it",
        firstName: booking.first_name,
        checkin: booking.checkin,
        checkout: booking.checkout,
        totalPrice: booking.total_price,
        cityTax: booking.city_tax,
        guests: booking.guests,
      });
    } else {
      await sendApprovalEmail({
        to: booking.email,
        code: booking.code,
        unitId: booking.unit_id ?? undefined,
        locale: (booking.locale as LocaleCode) ?? "it",
        totalPrice: booking.total_price,
        cityTax: booking.city_tax,
        cityTaxOnline: booking.city_tax_online,
        guests: booking.guests,
        refundPolicy: booking.refund_policy,
      });
    }
  } catch (err) {
    // Lo stato è comunque aggiornato anche se l'invio dell'email fallisce:
    // l'errore viene riportato all'admin invece di essere ignorato in silenzio.
    emailError = err instanceof Error ? err.message : "Invio email fallito";
  }

  return NextResponse.json({ ok: true, booking, emailError, calendarError, status: nextStatus });
}
