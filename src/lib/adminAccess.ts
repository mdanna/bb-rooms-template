import rawAdmins from "@/data/admins.json";

// Allowlist delle EMAIL autorizzate al login admin (magic-link). Fonte editabile:
// il file committato src/data/admins.json (modificato da /admin/accessi → commit su
// GitHub → redeploy). Se il file è vuoto (istanza non ancora migrata) si ricade sulle
// env ADMIN_EMAILS, così l'accesso non si interrompe mai. Gli username GitHub restano
// invece gestiti via env (ADMIN_GITHUB_LOGINS) — vedi src/auth.ts.

const norm = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? Array.from(new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean)))
    : [];

/** Email configurate via variabile d'ambiente (config iniziale). */
export const ADMIN_EMAILS_ENV: string[] = norm((process.env.ADMIN_EMAILS ?? "").split(","));

/** Email dal file committato (editabile da UI). */
export const ADMIN_EMAILS_FILE: string[] = norm((rawAdmins as { emails?: unknown }).emails);

/** Fonte effettiva: il file se contiene almeno un indirizzo, altrimenti le env. */
export const ADMIN_EMAILS: string[] = ADMIN_EMAILS_FILE.length ? ADMIN_EMAILS_FILE : ADMIN_EMAILS_ENV;

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
