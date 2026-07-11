// Le date di prenotazione sono concetti "civili" (un giorno di calendario), non istanti
// nel tempo. Passarle per `new Date(isoString)` le interpreta in UTC e, formattandole nel
// fuso orario locale del browser, può farle scivolare di un giorno (es. per ospiti USA).
// Queste utility lavorano sempre sulla sola parte YYYY-MM-DD, ignorando l'ora/fuso.
//
// Il driver `pg` restituisce le colonne DATE come oggetti `Date` (non stringhe) quando si
// interroga il database direttamente (a differenza delle risposte JSON delle API, dove
// `JSON.stringify` le converte già in stringa): tutte le funzioni qui accettano entrambi i
// formati per evitare bug di questo tipo.

function toDateOnlyValue(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export function parseDateOnly(value: string | Date): Date {
  const [y, m, d] = toDateOnlyValue(value).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDateOnly(value: string | Date, locale: string): string {
  return parseDateOnly(value).toLocaleDateString(locale);
}

export function enumerateDateOnly(start: string | Date, end: string | Date): string[] {
  const dates: string[] = [];
  const cur = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (cur <= last) {
    dates.push(toDateOnlyString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function nightsBetween(checkin: string | Date, checkout: string | Date): number {
  const start = parseDateOnly(checkin);
  const end = parseDateOnly(checkout);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
