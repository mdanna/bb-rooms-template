import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rateLimit";
import { computePricingBreakdown, MIN_DEPOSIT_RATE, MAX_DEPOSIT_RATE, DEFAULT_DEPOSIT_RATE, CITY_TAX_MAX_NIGHTS } from "@/lib/pricing";
import { POLICIES } from "@/lib/policies";
import { CONTENT } from "@/lib/siteContent";
import { verifyAccessToken } from "@/lib/accessToken";
import { nightsBetween } from "@/lib/dateOnly";
import { translations, type LocaleCode } from "@/i18n";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const rate = checkRateLimit(request, "bookings-checkout", 10, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  const { code } = await context.params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyAccessToken(code, token)) {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  // Parse optional depositRate from body
  let bodyDepositRate: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.depositRate === "number") {
      bodyDepositRate = Math.min(Math.max(body.depositRate, MIN_DEPOSIT_RATE), MAX_DEPOSIT_RATE);
    }
  } catch { /* body is optional */ }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1 AND status = 'approved'`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o non in stato approvato" },
      { status: 404 }
    );
  }
  if (!booking.total_price || booking.total_price <= 0) {
    return NextResponse.json({ error: "Importo non valido per il pagamento" }, { status: 400 });
  }

  // Always recompute pricing with the chosen deposit rate (or fall back to stored rate / default)
  const depositRate =
    bodyDepositRate ??
    (booking.deposit_rate != null ? Number(booking.deposit_rate) : undefined);

  const pricing = computePricingBreakdown(
    Number(booking.total_price),
    booking.guests,
    booking.checkin,
    booking.checkout,
    depositRate
  );

  await pool.query(
    `UPDATE bookings SET deposit_amount = $2, city_tax = $3, balance_due = $4, deposit_rate = $5 WHERE id = $1`,
    [booking.id, pricing.depositAmount, pricing.cityTax, pricing.balanceDue, pricing.depositRate]
  );

  const depositPct = Math.round((pricing.depositRate ?? DEFAULT_DEPOSIT_RATE) * 100);
  const isFullPayment = depositPct >= 100;

  // Opzione A: la tassa di soggiorno viaggia con l'anticipo online come voce
  // separata. Le prenotazioni vecchie (flag null) mantengono il vecchio testo
  // "riscossa al check-in" e NON hanno la seconda riga.
  const cityTaxOnline = booking.city_tax_online === true && pricing.cityTax > 0;
  const locale = (booking.locale as LocaleCode) ?? "it";
  const t = translations[locale] ?? translations.it;

  const nights = nightsBetween(booking.checkin, booking.checkout);
  const cityTaxNights = Math.min(nights, CITY_TAX_MAX_NIGHTS);

  const depositBaseDesc = isFullPayment
    ? `Check-in ${booking.checkin} → Check-out ${booking.checkout}`
    : `Check-in ${booking.checkin} → Check-out ${booking.checkout} · Saldo di €${pricing.balanceDue} da versare entro ${POLICIES.balanceDueDays} giorni prima del check-in`;

  // Vecchio comportamento (flag null/false): la tassa resta annotata come
  // riscossa al check-in nella riga dell'anticipo. Online: nessuna menzione qui,
  // perché è una line item separata pagata ora.
  const depositDescription = cityTaxOnline
    ? depositBaseDesc
    : `${depositBaseDesc} · Tassa di soggiorno €${pricing.cityTax} riscossa separatamente al check-in`;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "eur",
        unit_amount: Math.round(pricing.depositAmount * 100),
        product_data: {
          name: isFullPayment
            ? `Pagamento completo · ${CONTENT.siteTitle.it} · ${booking.code}`
            : `Anticipo ${depositPct}% · ${CONTENT.siteTitle.it} · ${booking.code}`,
          description: depositDescription,
        },
      },
      quantity: 1,
    },
  ];

  if (cityTaxOnline) {
    lineItems.push({
      price_data: {
        currency: "eur",
        unit_amount: Math.round(pricing.cityTax * 100),
        product_data: {
          name: t.payment.cityTaxLineItem,
          description: `${booking.guests} ospiti × ${cityTaxNights} notti`,
        },
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: booking.email,
      client_reference_id: booking.code,
      metadata: { bookingCode: booking.code },
      success_url: `${siteUrl()}/confirmation/${booking.code}?session_id={CHECKOUT_SESSION_ID}&t=${encodeURIComponent(token!)}`,
      cancel_url: `${siteUrl()}/pay/${booking.code}?t=${encodeURIComponent(token!)}`,
    });

    if (!session.url) {
      throw new Error("Stripe non ha restituito un URL di pagamento");
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossibile avviare il pagamento" },
      { status: 502 }
    );
  }
}
