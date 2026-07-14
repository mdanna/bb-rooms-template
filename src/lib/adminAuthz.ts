// Autorizzazione del login admin — funzione PURA (nessun side-effect, allowlist
// passate come argomento) così è testabile in isolamento. Usata dal callback
// `signIn` in src/auth.ts. Regole:
//   - demo:   consentito solo se l'istanza è in DEMO_MODE;
//   - github: super-admin di flotta SEMPRE ammesso (break-glass), altrimenti
//             username ∈ allowlist (fail-closed: allowlist vuota = nessun accesso);
//   - google: email VERIFICATA ∈ allowlist email;
//   - resend (magic-link): email ∈ allowlist email;
//   - qualunque altro provider: negato.

// ── Super-admin di flotta (accesso "break-glass") ────────────────────────────
// L'utenza GitHub del gestore della flotta è SEMPRE autorizzata su OGNI sito, in
// modo SILENTE: non compare nell'allowlist per-sito, non è rimovibile dal pannello
// e sopravvive anche se il proprietario la cancella per errore. Accesso di
// emergenza per ripristinare gli accessi di un sito che si è chiuso fuori.
// ATTENZIONE: chi controlla questo account GitHub entra in TUTTI i pannelli →
// l'account DEVE avere la 2FA attiva. Il match è sia sullo username sia sull'ID
// numerico IMMUTABILE: un eventuale rename dello username non deve trasferire il
// super-admin a chi ne rivendicasse il nome liberato.
export const SUPER_ADMIN_GITHUB_LOGIN = "mdanna";
export const SUPER_ADMIN_GITHUB_ID = 35303820; // github.com/mdanna (Mario D'Anna)

export interface SignInIdentity {
  provider?: string | null;
  /** GitHub: username (case-insensitive). */
  login?: string | null;
  /** GitHub: id numerico immutabile del profilo. */
  githubId?: number | null;
  /** Google / magic-link: email. */
  email?: string | null;
  /** Google: se l'email è verificata dal provider. */
  emailVerified?: boolean | null;
  /** L'istanza gira in modalità demo. */
  demoMode: boolean;
}

export interface AdminAllowlist {
  githubLogins: string[];
  emails: string[];
}

export function isSuperAdminGithub(login: string | null | undefined, githubId: number | null | undefined): boolean {
  return login?.toLowerCase() === SUPER_ADMIN_GITHUB_LOGIN || githubId === SUPER_ADMIN_GITHUB_ID;
}

export function isAuthorizedAdmin(idy: SignInIdentity, allow: AdminAllowlist): boolean {
  switch (idy.provider) {
    case "demo":
      return idy.demoMode;
    case "github": {
      const login = idy.login?.toLowerCase();
      if (!login) return false;
      if (isSuperAdminGithub(login, idy.githubId)) return true;
      return allow.githubLogins.includes(login);
    }
    case "google": {
      const email = idy.email?.toLowerCase();
      if (!email || idy.emailVerified === false) return false;
      return allow.emails.includes(email);
    }
    case "resend": {
      const email = idy.email?.toLowerCase();
      if (!email) return false;
      return allow.emails.includes(email);
    }
    default:
      return false;
  }
}
