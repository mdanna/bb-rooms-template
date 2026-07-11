import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeTest, stripeLive, WEBHOOK_SECRET_TEST, WEBHOOK_SECRET_LIVE } from "@/lib/stripe";
import { completeBookingPayment } from "@/lib/completeBooking";
import { resolveSessionPaymentMethod } from "@/lib/stripePaymentMethod";
import { markNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { ensureSchema, pool, type Booking } from "@/lib/db";
import { sendBalanceReceiptEmail, sendHostPaymentNotification } from "@/lib/email";

// Stripe richiede il corpo grezzo (non parsato) per verificare la firma della richiesta.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Firma webhook mancante" }, { status: 400 });
  }

  // Verifichiamo la firma provando i segreti di ENTRAMBE le modalità (test + live):
  // così gli eventi non vengono rifiutati durante/dopo uno switch di modalità, e la
  // stessa URL di webhook funziona per gli endpoint test e live di Stripe.
  const candidates: { client: Stripe; secret: string }[] = [];
  if (stripeLive && WEBHOOK_SECRET_LIVE) candidates.push({ client: stripeLive, secret: WEBHOOK_SECRET_LIVE });
  if (WEBHOOK_SECRET_TEST) candidates.push({ client: stripeTest, secret: WEBHOOK_SECRET_TEST });
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Webhook non configurato" }, { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event | null = null;
  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      event = c.client.webhooks.constructEvent(rawBody, signature, c.secret);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!event) {
    return NextResponse.json(
      { error: `Firma webhook non valida: ${lastErr instanceof Error ? lastErr.message : lastErr}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const code = session.metadata?.bookingCode ?? session.client_reference_id;
    if (code && session.payment_status === "paid") {
      await ensureSchema();
      const isBalance = session.metadata?.type === "balance";

      if (isBalance) {
        const piId = typeof session.payment_intent === "string" ? session.payment_intent : null;
        const result = await pool.query<Booking>(
          `UPDATE bookings SET balance_paid_at = now(), balance_payment_intent_id = COALESCE($2, balance_payment_intent_id)
           WHERE code = $1 AND status = 'completed' AND balance_paid_at IS NULL RETURNING *`,
          [code, piId]
        );
        const booking = result.rows[0];
        if (booking) {
          try {
            await sendBalanceReceiptEmail({
              to: booking.email,
              code: booking.code,
              unitId: booking.unit_id ?? undefined,
              firstName: booking.first_name,
              lastName: booking.last_name,
              checkin: booking.checkin,
              checkout: booking.checkout,
              totalPrice: booking.total_price,
              balanceDue: booking.balance_due,
              cityTax: booking.city_tax,
              cityTaxOnline: booking.city_tax_online,
              guests: booking.guests,
              locale: (booking.locale as import("@/i18n/index").LocaleCode) ?? "it",
            });
          } catch (err) {
            console.error("sendBalanceReceiptEmail failed:", err);
          }
          try {
            await sendHostPaymentNotification({
              code: booking.code,
              unitId: booking.unit_id ?? undefined,
              firstName: booking.first_name,
              lastName: booking.last_name,
              email: booking.email,
              guests: booking.guests,
              checkin: booking.checkin,
              checkout: booking.checkout,
              totalPrice: booking.total_price,
              depositAmount: booking.deposit_amount,
              balanceDue: booking.balance_due,
              cityTax: booking.city_tax,
              cityTaxOnline: booking.city_tax_online,
              paymentMethod: "Carta di credito (saldo online)",
            });
          } catch (err) {
            console.error("sendHostPaymentNotification (balance) failed:", err);
          }
        }
      } else {
        const method = await resolveSessionPaymentMethod(session);
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : null;
        const booking = await completeBookingPayment(code, method, paymentIntentId);
        if (booking) {
          try {
            await markNightsBooked(booking.unit_id ?? rootUnitId(), booking.checkin, booking.checkout);
          } catch (err) {
            console.error("markNightsBooked after payment failed:", err);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
