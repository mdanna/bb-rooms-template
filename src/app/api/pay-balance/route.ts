import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { verifyAccessToken } from "@/lib/accessToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { CONTENT } from "@/lib/siteContent";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com";
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "pay-balance", 10, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Troppe richieste. Riprova tra qualche minuto." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const code: string = body?.code;
  const token: string = body?.token;

  if (!code || !verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1 AND status = 'completed' AND balance_paid_at IS NULL`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata o saldo già pagato" }, { status: 404 });
  }

  const balanceDue = Number(booking.balance_due);
  if (!balanceDue || balanceDue <= 0) {
    return NextResponse.json({ error: "Nessun saldo da pagare" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(balanceDue * 100),
            product_data: {
              name: `Saldo soggiorno · ${CONTENT.siteTitle.it} · ${booking.code}`,
              // La tassa di soggiorno NON è mai sul saldo (opzione A: online è
              // sull'anticipo, altrimenti riscossa al check-in). Descrizione
              // corretta senza riferimento alla tassa.
              description: `Check-in ${booking.checkin} → Check-out ${booking.checkout} · Saldo del soggiorno`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: booking.email,
      client_reference_id: booking.code,
      metadata: { bookingCode: booking.code, type: "balance" },
      success_url: `${siteUrl()}/pay-balance/${booking.code}/success?t=${encodeURIComponent(token)}&locale=${encodeURIComponent(booking.locale ?? "it")}`,
      cancel_url: `${siteUrl()}/pay-balance/${booking.code}?t=${encodeURIComponent(token)}`,
    });

    if (!session.url) throw new Error("Stripe non ha restituito un URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossibile avviare il pagamento" },
      { status: 502 }
    );
  }
}
