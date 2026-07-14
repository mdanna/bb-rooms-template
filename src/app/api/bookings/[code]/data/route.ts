import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { verifyAccessToken } from "@/lib/accessToken";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const token = new URL(request.url).searchParams.get("t");

  if (!verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Link non valido o scaduto" }, { status: 401 });
  }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  // Expose only the fields the client needs — do not leak internal IDs or admin notes
  return NextResponse.json({
    booking: {
      code: booking.code,
      status: booking.status,
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      guests: booking.guests,
      checkin: booking.checkin,
      checkout: booking.checkout,
      total_price: booking.total_price,
      city_tax: booking.city_tax,
      city_tax_online: booking.city_tax_online,
      paid_at: booking.paid_at,
      stripe_payment_intent_id: booking.stripe_payment_intent_id,
      payment_method: booking.payment_method,
      // Servono al preventivo di rimborso lato client (policy congelata + finestra di grazia 48h).
      refund_policy: booking.refund_policy,
      refunded_at: booking.refunded_at,
      created_at: booking.created_at,
      locale: booking.locale,
    },
  });
}
