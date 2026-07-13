// Link "click-to-chat" WhatsApp (wa.me): apre WhatsApp (app o web) con un messaggio già
// scritto. Nessuna API, nessun costo: usa il numero che host e ospite già hanno. Il numero
// deve essere in formato internazionale (con prefisso Paese) — wa.me non risolve i numeri
// locali senza prefisso.

/** Numero pronto per wa.me: solo cifre, prefisso internazionale, senza "+" né "00" iniziale. */
export function normalizeWaNumber(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, ""); // tieni solo le cifre
  if (d.startsWith("00")) d = d.slice(2); // "00" = prefisso internazionale → via
  return d;
}

/**
 * Link WhatsApp con testo precompilato. Ritorna "" se il numero non è plausibile
 * (così il chiamante può nascondere il pulsante).
 */
export function waLink(phone: string | null | undefined, text = ""): string {
  const n = normalizeWaNumber(phone);
  if (n.length < 8) return ""; // troppo corto per essere un numero internazionale valido
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
