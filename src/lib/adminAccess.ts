import rawAdmins from "@/data/admins.json";

// Allowlist admin (EMAIL per magic-link/Google + USERNAME GitHub). Fonte editabile:
// il file committato src/data/admins.json (modificato da /admin/accessi → commit su
// GitHub → redeploy). Se una lista del file è vuota (istanza non ancora migrata) si
// ricade sulle rispettive env (ADMIN_EMAILS / ADMIN_GITHUB_LOGINS), così l'accesso di
// chi era già configurato via env non si interrompe mai. Vedi src/auth.ts.

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

/** Username GitHub via variabile d'ambiente (config iniziale, separati da virgola). */
export const ADMIN_GITHUB_LOGINS_ENV: string[] = norm((process.env.ADMIN_GITHUB_LOGINS ?? "").split(","));

/** Username GitHub dal file committato (editabile da UI). */
export const ADMIN_GITHUB_LOGINS_FILE: string[] = norm((rawAdmins as { githubLogins?: unknown }).githubLogins);

/** Fonte effettiva: il file se contiene almeno un username, altrimenti le env. */
export const ADMIN_GITHUB_LOGINS: string[] = ADMIN_GITHUB_LOGINS_FILE.length
  ? ADMIN_GITHUB_LOGINS_FILE
  : ADMIN_GITHUB_LOGINS_ENV;

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Username GitHub: 1–39 caratteri alfanumerici o trattini singoli, non iniziale/finale.
export function isValidGithubLogin(v: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(v.trim());
}
