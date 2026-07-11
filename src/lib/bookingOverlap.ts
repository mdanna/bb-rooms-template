import { pool } from "./db";
import { relatedUnitIds, rootUnitId } from "./structure";

// Due soggiorni si sovrappongono se l'intervallo [checkin, checkout) di uno interseca
// quello dell'altro. Si considerano solo le prenotazioni "approved" o "completed":
// le richieste "pending" non bloccano ancora le date (l'host deve poterle confrontare).
//
// STRUTTURA CON CAMERE: la sovrapposizione è CONSAPEVOLE DEL CONTENIMENTO. Una
// prenotazione sull'unità X è in conflitto non solo con le prenotazioni su X, ma anche
// con quelle sui suoi antenati (l'appartamento) e sui suoi discendenti (le camere) —
// relatedUnitIds(X). Le prenotazioni con unit_id NULL (antecedenti / unità singola)
// sono trattate come l'unità radice.
export async function hasOverlappingBooking(
  unitId: string,
  checkin: string,
  checkout: string,
  excludeId?: number
): Promise<boolean> {
  const related = relatedUnitIds(unitId);
  // NULL = unità radice: se la radice è tra le unità collegate, includi anche i NULL.
  const includeNull = related.includes(rootUnitId());
  const result = await pool.query(
    `SELECT 1 FROM bookings
     WHERE status IN ('approved', 'completed')
       AND (unit_id = ANY($4::text[]) OR ($5 AND unit_id IS NULL))
       AND checkin < $2
       AND checkout > $1
       AND ($3::int IS NULL OR id != $3)
     LIMIT 1`,
    [checkin, checkout, excludeId ?? null, related, includeNull]
  );
  return (result.rowCount ?? 0) > 0;
}
