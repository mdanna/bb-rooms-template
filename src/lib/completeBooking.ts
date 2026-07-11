import { pool, type Booking } from "./db";
import { sendPaymentConfirmationEmail, sendHostPaymentNotification } from "./email";
import type { LocaleCode } from "@/i18n/index";

// Segna una prenotazione come pagata/completata. Idempotente: se è già "completed" non fa
// nulla. Chiamata sia dal webhook Stripe (percorso primario) sia, come rete di sicurezza,
// quando l'ospite atterra sulla pagina di conferma dopo il checkout (nel caso il webhook
// non sia ancora arrivato).
export async function completeBookingPayment(
  code: string,
  paymentMethod: "card" | "paypal",
  paymentIntentId?: string | null
): Promise<Booking | null> {
  const result = await pool.query<Booking>(
    `UPDATE bookings SET status = 'completed', payment_method = $2, paid_at = now(),
       stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id)
     WHERE code = $1 AND status = 'approved' RETURNING *`,
    [code, paymentMethod, paymentIntentId ?? null]
  );

  const booking = result.rows[0];
  if (!booking) return null;

  const locale = (booking.locale as LocaleCode) ?? "it";
  const methodLabel = paymentMethod === "paypal" ? "PayPal" : "Carta di credito";

  try {
    await sendPaymentConfirmationEmail({
      to: booking.email,
      code: booking.code,
      firstName: booking.first_name,
      lastName: booking.last_name,
      checkin: booking.checkin,
      checkout: booking.checkout,
      totalPrice: booking.total_price,
      depositAmount: booking.deposit_amount,
      balanceDue: booking.balance_due,
      cityTax: booking.city_tax,
      cityTaxOnline: booking.city_tax_online,
      guests: booking.guests,
      paymentMethod: methodLabel,
      locale,
    });
  } catch (err) {
    console.error("sendPaymentConfirmationEmail failed:", err);
  }

  try {
    await sendHostPaymentNotification({
      code: booking.code,
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
      paymentMethod: methodLabel,
    });
  } catch (err) {
    console.error("sendHostPaymentNotification failed:", err);
  }

  return booking;
}
