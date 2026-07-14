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
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  await ensureSchema();

  const result = await pool.query<Booking>(`SELECT * FROM bookings WHERE code = $1`, [code]);
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  // Espone solo i dati necessari alla pagina pubblica di pagamento/conferma.
  return NextResponse.json({
    booking: {
      code: booking.code,
      first_name: booking.first_name,
      last_name: booking.last_name,
      guests: booking.guests,
      checkin: booking.checkin,
      checkout: booking.checkout,
      total_price: booking.total_price,
      city_tax: booking.city_tax,
      city_tax_online: booking.city_tax_online,
      status: booking.status,
      payment_method: booking.payment_method,
      paid_at: booking.paid_at,
      locale: booking.locale,
    },
  });
}
