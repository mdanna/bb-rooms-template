import type { DayRate } from "@/data/availability";

// Export iCal PER UNITÀ. Genera un feed VCALENDAR con le notti occupate dell'unità,
// così le OTA (Airbnb/Booking/Vrbo) che importano questo URL bloccano quelle date.
//
// Fondamentale per la struttura con camere: le notti esportate includono i blocchi
// DERIVATI "contained". Se l'appartamento intero è prenotato, il feed della camera
// mostra quelle notti come occupate → l'inserzione della camera si blocca sull'OTA
// (e viceversa). È il lato "uscente" della sincronizzazione a cascata.

function nextDayCompact(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return compact(toISO(d));
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function compact(iso: string): string {
  return iso.replace(/-/g, "");
}

function isNextDay(a: string, b: string): boolean {
  const d = new Date(a + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return toISO(d) === b;
}

// Raggruppa le notti occupate (ordinate) in intervalli contigui [start, endEsclusivo).
function bookedRanges(overrides: DayRate[]): { start: string; endExclusive: string }[] {
  const nights = overrides
    .filter((o) => o.status === "booked")
    .map((o) => o.date)
    .sort();
  const ranges: { start: string; endExclusive: string }[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const n of nights) {
    if (start === null) {
      start = n;
      prev = n;
    } else if (prev && isNextDay(prev, n)) {
      prev = n;
    } else {
      ranges.push({ start, endExclusive: nextDayCompact(prev!) });
      start = n;
      prev = n;
    }
  }
  if (start && prev) ranges.push({ start, endExclusive: nextDayCompact(prev) });
  return ranges;
}

/** Costruisce il feed iCal (VCALENDAR) delle notti occupate di un'unità. */
export function buildUnitICal(unitId: string, overrides: DayRate[], nowStamp: string): string {
  const ranges = bookedRanges(overrides);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DimoraSuite//Rooms//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const r of ranges) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${unitId}-${r.start}@dimorasuite`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${compact(r.start)}`,
      `DTEND;VALUE=DATE:${r.endExclusive}`,
      "SUMMARY:Non disponibile",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  // I feed iCal usano CRLF come terminatore di riga (RFC 5545).
  return lines.join("\r\n") + "\r\n";
}

/** Timestamp UTC in formato iCal basic (YYYYMMDDTHHMMSSZ). */
export function icalStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}
