import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { unmarkNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { quoteRefund, refundInputsFor } from "@/lib/refund";

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

  // Cancellazione atomica in un'unica istruzione: la CTE `locked` blocca la riga con
  // FOR UPDATE, `upd` la porta a 'cancelled' e la SELECT finale restituisce lo stato
  // PRECEDENTE. Così un pagamento che completa in parallelo (webhook Stripe) non viene
  // sovrascritto in modo silenzioso e wasPaid/rimborso riflettono lo stato reale al lock.
  const before = await pool.query<Booking>(
    `WITH locked AS (
       SELECT * FROM bookings
       WHERE id = $1 AND status IN ('pending', 'approved', 'completed')
       FOR UPDATE
     ), upd AS (
       UPDATE bookings SET status = 'cancelled' WHERE id IN (SELECT id FROM locked) RETURNING id
     )
     SELECT * FROM locked`,
    [id]
  );
  const previous = before.rows[0];
  if (!previous) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o già rifiutata/annullata" },
      { status: 404 }
    );
  }
  // La riga è ora 'cancelled' nel DB; per la risposta rispecchiamo lo stato aggiornato.
  const booking: Booking = { ...previous, status: "cancelled" };

  // Cancellazione da parte dell'host: quota soggiorno rimborsata al 100% senza franchigia,
  // più la tassa di soggiorno online (sempre 100%). Il rimborso NON è automatico: salviamo
  // l'importo dovuto (refund_due) e l'host lo esegue col pulsante "Rimborsa" dal pannello.
  const inputs = refundInputsFor(previous, true);
  const quote = quoteRefund(inputs);
  const wasPaid = inputs.wasPaidOnline;

  if (wasPaid) {
    await pool.query(`UPDATE bookings SET refund_due = $2 WHERE id = $1`, [booking.id, quote.amount]);
  }

  let calendarError: string | null = null;
  // Se la richiesta era ancora "pending" il calendario non aveva nulla di bloccato per queste
  // date: rimuovere un override inesistente è comunque un'operazione innocua (no-op).
  try {
    await unmarkNightsBooked(booking.unit_id ?? rootUnitId(), booking.checkin, booking.checkout);
  } catch (err) {
    calendarError = err instanceof Error ? err.message : "Sincronizzazione calendario fallita";
  }

  const refundDue = quote.amount > 0;
  const refundNotice = wasPaid
    ? refundDue
      ? `Rimborso dovuto all'ospite: €${quote.amount.toFixed(2)} (soggiorno €${quote.stayRefund.toFixed(2)}${quote.cityTaxRefund > 0 ? ` + tassa di soggiorno €${quote.cityTaxRefund.toFixed(2)}` : ""}). Eseguilo dal pannello con il pulsante "Rimborsa".`
      : `Nessun rimborso dovuto per questa prenotazione.`
    : null;

  return NextResponse.json({ ok: true, booking, calendarError, refundDue, refundAmount: refundDue ? quote.amount : null, refundNotice });
}
