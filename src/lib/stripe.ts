import Stripe from "stripe";
import stripeConfig from "@/data/stripe.json";

export type StripeMode = "test" | "live";

// La modalità è un flag NON-segreto, committato in src/data/stripe.json e
// modificabile dalla pagina admin protetta da TOTP. Le chiavi segrete di Stripe
// restano SOLO nelle env var (mai su git): qui scegliamo quale usare.
export const STRIPE_MODE: StripeMode = stripeConfig.mode === "live" ? "live" : "test";

// Chiave di test: STRIPE_SECRET_KEY_TEST, con fallback alla vecchia STRIPE_SECRET_KEY
// (retrocompatibilità — il wizard configura ancora STRIPE_SECRET_KEY).
const TEST_KEY = process.env.STRIPE_SECRET_KEY_TEST ?? process.env.STRIPE_SECRET_KEY ?? "";
const LIVE_KEY = process.env.STRIPE_SECRET_KEY_LIVE ?? "";

export const LIVE_KEY_CONFIGURED = LIVE_KEY.length > 0;

// Client per la modalità attiva. Usato da checkout, pay-balance e confirm-session:
// selezionando qui la chiave, quei percorsi non richiedono modifiche.
export const stripe = new Stripe(STRIPE_MODE === "live" ? LIVE_KEY : TEST_KEY);

// Client per singola modalità: il webhook li usa per verificare la firma di eventi
// di entrambe le modalità; l'health-check usa stripeLive per validare la live key
// senza attivarla.
export const stripeTest = new Stripe(TEST_KEY);
export const stripeLive: Stripe | null = LIVE_KEY_CONFIGURED ? new Stripe(LIVE_KEY) : null;

export const WEBHOOK_SECRET_TEST =
  process.env.STRIPE_WEBHOOK_SECRET_TEST ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? "";
