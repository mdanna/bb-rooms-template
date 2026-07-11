import { createHmac, timingSafeEqual } from "crypto";

// Le pagine di pagamento/conferma e l'API che le alimenta non devono essere accessibili a
// chiunque conosca (o indovini) il codice di prenotazione: i link inviati via email portano
// anche un token firmato con scadenza, verificato lato server prima di esporre i dati.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni (link di pagamento)
const MANAGEMENT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni (link di gestione)

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET non configurato");
  return s;
}

function sign(code: string, exp: number): string {
  return createHmac("sha256", secret())
    .update(`${code}:${exp}`)
    .digest("base64url");
}

export function generateManagementToken(code: string): string {
  const exp = Date.now() + MANAGEMENT_TOKEN_TTL_MS;
  const sig = sign(code, exp);
  return `${exp}.${sig}`;
}

export function generateAccessToken(code: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = sign(code, exp);
  return `${exp}.${sig}`;
}

export function verifyAccessToken(code: string, token: string | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const expected = sign(code, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
