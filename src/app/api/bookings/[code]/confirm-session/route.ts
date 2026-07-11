import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { completeBookingPayment } from "@/lib/completeBooking";
import { resolveSessionPaymentMethod } from "@/lib/stripePaymentMethod";
import { markNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { ensureSchema } from "@/lib/db";

// Rete di sicurezza lato client: quando l'ospite torna dal checkout Stripe, verifichiamo
// subito lo stato della sessione invece di aspettare il webhook (che può arrivare con un
// piccolo ritardo). L'aggiornamento resta comunque idempotente: se il webhook è già passato,
// questa chiamata non fa nulla di nuovo.
export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId mancante" }, { status: 400 });
  }

  await ensureSchema();

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionCode = session.metadata?.bookingCode ?? session.client_reference_id;
  if (sessionCode !== code) {
    return NextResponse.json({ error: "Sessione non corrispondente" }, { status: 400 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: false, paid: false });
  }

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

  return NextResponse.json({ ok: true, paid: true });
}
