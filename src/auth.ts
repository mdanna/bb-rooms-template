import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import PostgresAdapter from "@auth/pg-adapter";
import type { Adapter } from "next-auth/adapters";
import { pool, ensureAuthSchema } from "@/lib/db";
import { CONTENT } from "@/lib/siteContent";
import { DEMO_MODE } from "@/lib/demo";
import { ADMIN_EMAILS, ADMIN_GITHUB_LOGINS } from "@/lib/adminAccess";
import { isAuthorizedAdmin } from "@/lib/adminAuthz";

// Allowlist admin: username GitHub ED email autorizzate (magic-link + Google) arrivano
// entrambi da src/lib/adminAccess (file committato editabile da /admin/accessi, con
// fallback alle env ADMIN_GITHUB_LOGINS / ADMIN_EMAILS). La logica di autorizzazione
// (incluso il super-admin di flotta "break-glass") vive in src/lib/adminAuthz (pura,
// testabile). Vedi src/tests/adminAuthz.test.ts.
const ALLOWED_LOGINS = ADMIN_GITHUB_LOGINS;

const ALLOWED_EMAILS = ADMIN_EMAILS;

// Login con Google (OAuth condiviso di flotta): attivo solo se le credenziali sono
// configurate nell'env del sito. Senza, Auth.js darebbe "server configuration error",
// quindi il provider va incluso in modo condizionato (come il magic-link col dominio
// Resend). Esportato per mostrare/nascondere il pulsante nel pannello. Mai in demo.
export const GOOGLE_ENABLED =
  !DEMO_MODE && !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Mittente del magic-link: di default lo stesso indirizzo (sul dominio verificato
// in Resend) usato per le email transazionali, così eredita l'autenticazione SPF/DKIM.
const AUTH_EMAIL_FROM = process.env.AUTH_EMAIL_FROM ?? CONTENT.bookingEmail;

// Wrappa l'adapter Postgres in modo che lo schema Auth.js venga creato (idempotente)
// prima di ogni chiamata: l'app crea le tabelle a runtime (come ensureSchema).
function ensuredAdapter(): Adapter {
  const base = PostgresAdapter(pool) as unknown as Record<string, unknown>;
  return new Proxy(base, {
    get(target, prop) {
      const value = target[prop as string];
      if (typeof value === "function") {
        return async (...args: unknown[]) => {
          await ensureAuthSchema();
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as unknown as Adapter;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Senza questo, dietro il proxy di Vercel Auth.js non si fida dell'header Host del dominio
  // personalizzato e ricostruisce la callback URL usando il dominio *.vercel.app di default.
  trustHost: true,
  // In demo il login è solo Credentials+JWT: nessun adapter → nessun database richiesto.
  adapter: DEMO_MODE ? undefined : ensuredAdapter(),
  session: { strategy: "jwt" },
  // In demo l'unico provider è Credentials ("demo"): GitHub e Resend
  // richiederebbero AUTH_GITHUB_ID/SECRET e un dominio Resend verificato, assenti
  // nell'istanza demo → li includessimo, Auth.js darebbe "server configuration".
  providers: DEMO_MODE
    ? [
        // Login demo pubblico: nessuna credenziale, nessuna scrittura possibile a
        // valle (tutte le route di scrittura sono no-op sotto DEMO_MODE).
        Credentials({
          id: "demo",
          name: "Demo",
          credentials: {},
          async authorize() {
            return { id: "demo", name: "Demo", email: "demo@dimorasuite.com" };
          },
        }),
      ]
    : [
        GitHub({
          // Con l'adapter DB, se esiste già un utente con la stessa email (es. creato
          // dal login via magic-link) il login GitHub darebbe OAuthAccountNotLinked.
          // Colleghiamo l'account allo stesso utente: l'accesso resta comunque
          // ristretto dall'allowlist (ADMIN_GITHUB_LOGINS/ADMIN_EMAILS).
          allowDangerousEmailAccountLinking: true,
          // I commit su GitHub usano GITHUB_BOT_TOKEN, non il token OAuth dell'admin:
          // qui basta lo scope minimo per identificare l'utente che effettua il login.
          authorization: { params: { scope: "read:user user:email" } },
        }),
        // Google: incluso solo se configurato (OAuth condiviso di flotta). Autorizza
        // per EMAIL verificata contro la stessa allowlist del magic-link (vedi signIn).
        ...(GOOGLE_ENABLED
          ? [
              Google({
                // Stesso motivo di GitHub: collega l'account allo stesso utente se
                // l'email esiste già (magic-link). Il cancello resta l'allowlist.
                allowDangerousEmailAccountLinking: true,
              }),
            ]
          : []),
        Resend({
          apiKey: process.env.RESEND_API_KEY,
          from: AUTH_EMAIL_FROM,
          // Invia il magic-link SOLO agli indirizzi in allowlist: evita di usare il
          // sito per spedire email a indirizzi arbitrari (enumeration/abuso).
          async sendVerificationRequest({ identifier, url, provider }) {
            const email = identifier.toLowerCase();
            if (ALLOWED_EMAILS.length === 0 || !ALLOWED_EMAILS.includes(email)) {
              return; // non autorizzato: nessun invio, in silenzio
            }
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: provider.from,
                to: email,
                subject: "Accesso amministrazione",
                html: `<p>Ciao,</p><p>clicca il pulsante per accedere all'amministrazione:</p>
                       <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#b8860b;color:#fff;text-decoration:none;border-radius:9999px">Accedi</a></p>
                       <p>Oppure copia questo link: ${url}</p>
                       <p>Il link scade a breve. Se non hai richiesto tu l'accesso, ignora questa email.</p>`,
              }),
            });
            if (!res.ok) {
              throw new Error(`Invio email di accesso fallito: ${await res.text()}`);
            }
          },
        }),
      ],
  callbacks: {
    async signIn({ profile, user, account }) {
      const p = profile as { login?: string; id?: number; email_verified?: boolean } | undefined;
      return isAuthorizedAdmin(
        {
          provider: account?.provider,
          login: p?.login ?? null,
          githubId: p?.id ?? null,
          email: user?.email ?? null,
          emailVerified: p?.email_verified ?? null,
          demoMode: DEMO_MODE,
        },
        { githubLogins: ALLOWED_LOGINS, emails: ALLOWED_EMAILS },
      );
    },
  },
  pages: {
    signIn: "/admin",
  },
});
