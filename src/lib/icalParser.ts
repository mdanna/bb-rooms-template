import type { OtaPlatform } from "@/data/availability";

export interface ICalEvent {
  summary: string;
  dtstart: string; // YYYY-MM-DD (first night)
  dtend: string;   // YYYY-MM-DD (exclusive: checkout day)
  isReservation: boolean; // true = actual guest booking, false = host block
}

// Classifica un evento come prenotazione (true) o blocco (false), per piattaforma.
// Default-safe: uno stato sconosciuto è comunque "occupato" (blocco), mai "libero";
// qui restituiamo solo se è una *prenotazione* — l'evento resta comunque una notte occupata.
function classifyReservation(summary: string, platform: OtaPlatform): boolean {
  const s = summary.toLowerCase();
  // Blocchi espliciti → mai prenotazione.
  if (s.includes("not available") || s.includes("unavailable") || s.includes("closed") || s.includes("blocked")) {
    return false;
  }
  if (platform === "booking") {
    // L'iCal di Booking esporta quasi tutto come "CLOSED - Not available": trattiamo
    // come prenotazione solo con un segnale esplicito (raro).
    return s.includes("reserved") || s.includes("booked");
  }
  // Airbnb / Vrbo: le prenotazioni hanno SUMMARY "Reserved".
  return s.includes("reserved");
}

function parseICalDate(raw: string): string | null {
  // Formats: 20260720 or 20260720T120000Z or 20260720T120000
  const digits = raw.replace(/[TZ].*/g, "").trim();
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// Returns all nights [dtstart, dtend) as ISO date strings.
// DTEND in iCal is exclusive, so a booking 20–23 July occupies nights 20, 21, 22.
export function icalEventNights(event: ICalEvent): string[] {
  const nights: string[] = [];
  const cur = new Date(event.dtstart + "T00:00:00");
  const end = new Date(event.dtend + "T00:00:00");
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    nights.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

// Analizza un feed iCal e classifica ogni evento come prenotazione/blocco secondo la
// piattaforma. `parseICalReservations` resta come alias platform-agnostic (Airbnb).
export function parseICalEvents(text: string, platform: OtaPlatform): ICalEvent[] {
  const events: ICalEvent[] = [];
  // Split into VEVENT blocks
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of blocks) {
    const end = block.indexOf("END:VEVENT");
    const body = end !== -1 ? block.slice(0, end) : block;

    // Unfold long lines (iCal folds at 75 chars with CRLF + space/tab)
    const unfolded = body.replace(/\r?\n[ \t]/g, "");

    const lines = unfolded.split(/\r?\n/);
    const props: Record<string, string> = {};
    for (const line of lines) {
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      const key = line.slice(0, sep).split(";")[0].toUpperCase().trim();
      const val = line.slice(sep + 1).trim();
      props[key] = val;
    }

    const summary = props["SUMMARY"] ?? "";
    const dtstart = parseICalDate(props["DTSTART"] ?? "");
    const dtend = parseICalDate(props["DTEND"] ?? "");

    if (!dtstart || !dtend) continue;

    const isReservation = classifyReservation(summary, platform);
    events.push({ summary, dtstart, dtend, isReservation });
  }

  return events;
}

export function parseICalReservations(text: string): ICalEvent[] {
  return parseICalEvents(text, "airbnb");
}
