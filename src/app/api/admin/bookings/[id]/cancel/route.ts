import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { unmarkNightsBooked } from "@/lib/syncAvailability";
import { rootUnitId } from "@/lib/structure";
import { parseDateOnly } from "@/lib/dateOnly";

const REFUND_WINDOW_DAYS = 10;

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

  const before = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE id = $1 AND status IN ('pending', 'approved', 'completed')`,
    [id]
  );
  const previous = before.rows[0];
  if (!previous) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o già rifiutata/annullata" },
      { status: 404 }
    );
  }

  const wasPaid = previous.status === "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilCheckin = Math.round(
    (parseDateOnly(previous.checkin).getTime() - today.getTime()) / 86_400_000
  );
  const depositRefundDue = wasPaid && daysUntilCheckin >= REFUND_WINDOW_DAYS;
  // Opzione A: la tassa di soggiorno online è stata incassata con l'anticipo →
  // va sempre rimborsata (non dovuta per notti non godute), a prescindere dalla
  // finestra di penale sull'anticipo. Prenotazioni vecchie (flag null/false):
  // tassa mai incassata → nessun rimborso tassa, comportamento invariato.
  const cityTaxRefund =
    wasPaid && previous.city_tax_online === true ? Number(previous.city_tax ?? 0) : 0;
  const refundDue = depositRefundDue || cityTaxRefund > 0;

  const result = await pool.query<Booking>(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [id]
  );
  const booking = result.rows[0];

  let calendarError: string | null = null;
  // Se la richiesta era ancora "pending" il calendario non aveva nulla di bloccato per queste
  // date: rimuovere un override inesistente è comunque un'operazione innocua (no-op).
  try {
    await unmarkNightsBooked(booking.unit_id ?? rootUnitId(), booking.checkin, booking.checkout);
  } catch (err) {
    calendarError = err instanceof Error ? err.message : "Sincronizzazione calendario fallita";
  }

  // Il rimborso della anticipo non è automatico: lo gestisce l'host manualmente da Stripe.
  // Qui calcoliamo solo se spetta (cancellazione di una prenotazione pagata con almeno 10
  // giorni di anticipo sul check-in) e lo segnaliamo chiaramente in risposta.
  const depositNotice = depositRefundDue
    ? `Rimborso dovuto: l'anticipo di €${booking.deposit_amount ?? "?"} va restituito manualmente all'ospite (cancellazione con ${daysUntilCheckin} giorni di anticipo, oltre la soglia di ${REFUND_WINDOW_DAYS}).`
    : `Nessun rimborso dell'anticipo dovuto: cancellazione a ${daysUntilCheckin} giorni dal check-in, sotto la soglia di ${REFUND_WINDOW_DAYS} giorni.`;
  const cityTaxNotice =
    cityTaxRefund > 0
      ? ` Inoltre la tassa di soggiorno di €${cityTaxRefund} (incassata online con l'anticipo) va rimborsata all'ospite: non è dovuta per le notti non godute.`
      : "";
  const refundNotice = wasPaid ? `${depositNotice}${cityTaxNotice}` : null;

  return NextResponse.json({ ok: true, booking, calendarError, refundDue, refundNotice });
}
