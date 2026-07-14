import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { pool } from "@/lib/db";

// Segreti PER-SITO cifrati a riposo nel DATABASE — MAI su git (a differenza di
// src/data/*.json). Es.: la chiave Anthropic del proprietario, impostabile dal
// pannello. Cifratura AES-256-GCM con TOTP_ENC_KEY (la stessa chiave a-riposo del
// secret TOTP di Stripe, impostata dal wizard su ogni sito). Senza TOTP_ENC_KEY il
// valore resta comunque fuori da git ma in chiaro nel DB; con essa nemmeno un dump
// del solo DB basta a leggerlo. Il valore reale non viene MAI ritornato al client.

let initialized = false;
async function ensureSchema(): Promise<void> {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_secrets (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  initialized = true;
}

function encKey(): Buffer | null {
  const k = process.env.TOTP_ENC_KEY;
  if (!k) return null;
  return createHash("sha256").update(k).digest(); // 32 byte
}

function encrypt(plain: string): string {
  const key = encKey();
  if (!key) return plain; // nessuna chiave → in chiaro (comunque solo nel DB)
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function decrypt(stored: string): string {
  if (!stored.startsWith("enc:v1:")) return stored; // già in chiaro
  const key = encKey();
  if (!key) throw new Error("TOTP_ENC_KEY non configurata ma il valore è cifrato");
  const [, , ivB64, tagB64, ctB64] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

export async function setSiteSecret(name: string, plain: string): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO site_secrets (name, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [name, encrypt(plain)],
  );
}

export async function getSiteSecret(name: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM site_secrets WHERE name = $1`,
    [name],
  );
  if (!rows[0]) return null;
  try {
    return decrypt(rows[0].value);
  } catch {
    return null; // valore cifrato non decifrabile (chiave cambiata) → trattato come assente
  }
}

export async function hasSiteSecret(name: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT 1 FROM site_secrets WHERE name = $1`, [name]);
  return rows.length > 0;
}

export async function deleteSiteSecret(name: string): Promise<void> {
  await ensureSchema();
  await pool.query(`DELETE FROM site_secrets WHERE name = $1`, [name]);
}

/** Nome del segreto per la chiave Anthropic del proprietario del sito. */
export const ANTHROPIC_SECRET = "anthropic_api_key";

/**
 * Chiave Anthropic EFFETTIVA da usare per le traduzioni: quella del proprietario
 * (dal DB, decifrata) se impostata, altrimenti quella dell'operatore (env
 * ANTHROPIC_API_KEY). Stringa vuota se non ce n'è nessuna → il chiamante salta la
 * traduzione (fallback: resta solo il testo originale).
 */
export async function getEffectiveAnthropicKey(): Promise<string> {
  try {
    const own = await getSiteSecret(ANTHROPIC_SECRET);
    if (own && own.trim()) return own.trim();
  } catch {
    /* DB non disponibile (es. demo) → ricadi sull'env */
  }
  return (process.env.ANTHROPIC_API_KEY ?? "").trim();
}
