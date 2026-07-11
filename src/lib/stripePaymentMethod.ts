import { stripe } from "./stripe";
import type Stripe from "stripe";

// Determina il metodo di pagamento effettivamente usato dall'ospite (carta o PayPal),
// espandendo il payment intent della sessione Checkout. In caso di dubbio ricade su "card".
export async function resolveSessionPaymentMethod(
  session: Stripe.Checkout.Session
): Promise<"card" | "paypal"> {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) return "card";

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
    const pm = intent.payment_method;
    const type = typeof pm === "object" && pm ? pm.type : null;
    return type === "paypal" ? "paypal" : "card";
  } catch {
    return "card";
  }
}
