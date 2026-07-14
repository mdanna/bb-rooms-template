import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { resolvePaymentIntentClient } from "@/lib/stripe";

// Esegue il rimborso (semi-automatico) di una prenotazione annullata. L'importo dovuto è già
// stato calcolato alla cancellazione secondo la policy congelata e salvato in `refund_due`;
// qui l'host lo conferma col pulsante "Rimborsa" e il rimborso viene eseguito davvero su Stripe.
//
// Sicurezza contro il doppio rimborso: prima di chiamare Stripe rivendichiamo la riga in modo
// ATOMICO (SET refunded_at = now() WHERE refunded_at IS NULL). Se Stripe fallisce, annulliamo la
// rivendicazione (refunded_at → NULL) così l'host può riprovare. Idempotente: un secondo click
// non trova più refunded_at nullo e restituisce 409.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureSchema();

  const existing = await pool.query<Booking>(`SELECT * FROM bookings WHERE id = $1`, [id]);
  const booking = existing.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }
  if (!booking.stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "Nessun pagamento online da rimborsare per questa prenotazione." },
      { status: 400 }
    );
  }
  if (booking.refunded_at) {
    return NextResponse.json({ error: "Rimborso già effettuato." }, { status: 409 });
  }
  const refundDue = Number(booking.refund_due ?? 0);
  if (!(refundDue > 0)) {
    return NextResponse.json({ error: "Nessun rimborso dovuto per questa prenotazione." }, { status: 400 });
  }

  // Rivendicazione atomica: solo il primo click "vince" (refunded_at passa da NULL a now()).
  const claim = await pool.query<Booking>(
    `UPDATE bookings SET refunded_at = now()
     WHERE id = $1 AND refunded_at IS NULL AND refund_due > 0 AND stripe_payment_intent_id IS NOT NULL
     RETURNING *`,
    [id]
  );
  const claimed = claim.rows[0];
  if (!claimed) {
    return NextResponse.json({ error: "Rimborso già in corso o già effettuato." }, { status: 409 });
  }

  try {
    // Individua l'ambiente (test/live) che possiede davvero questo PaymentIntent e usa QUEL
    // client per il rimborso: un PI di test viene rimborsato in test (niente denaro reale), uno
    // live in live. Non dipende dalla modalità globale attiva → un cambio di modalità non può
    // deviare il rimborso sull'ambiente sbagliato. Se il PI non esiste in nessun ambiente, si
    // annulla la rivendicazione e si segnala l'errore (nessun rimborso "alla cieca").
    const resolved = await resolvePaymentIntentClient(claimed.stripe_payment_intent_id!);
    if (!resolved) {
      throw new Error("PaymentIntent non trovato su Stripe (né in test né in live).");
    }
    const { client, paymentIntent: pi } = resolved;

    // Leggiamo l'importo REALMENTE addebitato dal PaymentIntent ed esprimiamo il rimborso in
    // centesimi, limitandolo a quell'importo: così evitiamo scarti euro/centesimi e non tentiamo
    // mai di rimborsare più di quanto incassato.
    const chargedCents = pi.amount_received || pi.amount || 0;
    const wantedCents = Math.round(refundDue * 100);
    const refundCents = Math.min(wantedCents, chargedCents);
    if (!(refundCents > 0)) {
      throw new Error("Importo di rimborso non valido rispetto al pagamento su Stripe.");
    }

    const refund = await client.refunds.create({
      payment_intent: claimed.stripe_payment_intent_id!,
      amount: refundCents,
    });

    return NextResponse.json({ ok: true, refundId: refund.id, refunded: refundCents / 100 });
  } catch (err) {
    // Rimborso Stripe fallito: annulliamo la rivendicazione così l'host può riprovare.
    await pool.query(`UPDATE bookings SET refunded_at = NULL WHERE id = $1`, [id]);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rimborso Stripe fallito" },
      { status: 502 }
    );
  }
}
