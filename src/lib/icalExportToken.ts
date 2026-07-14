import { createHmac, timingSafeEqual } from "crypto";

// Token stabile e non indovinabile per il feed iCal di export (noi → OTA).
// Derivato via HMAC dal segreto del sito (AUTH_SECRET): non scade, non è salvato
// in nessun file del repo (invariante no-segreti) e si ricalcola identico sia quando
// mostriamo l'URL nel pannello sia quando validiamo la richiesta in ingresso.
export function icalExportToken(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET non configurato");
  return createHmac("sha256", s).update("ical-export").digest("base64url");
}

/** Confronto in tempo costante del token ricevuto con quello atteso. */
export function verifyIcalExportToken(token: string): boolean {
  let expected: string;
  try {
    expected = icalExportToken();
  } catch {
    return false;
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
