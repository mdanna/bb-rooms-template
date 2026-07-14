"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

// L'esito è un codice di stato (non un messaggio): la stringa mostrata viene
// localizzata lato client in base alla lingua admin scelta.
export type LoginState = { ok: boolean; status: "sent" | "empty" | "error" } | null;

// callbackUrl (relativo, same-origin — Auth.js rifiuta URL esterni) = pagina a cui
// tornare dopo il login. Default /admin; la pagina "collega-portale" lo valorizza a
// sé stessa (col token nella query) così dopo il login si torna alla conferma, non al
// pannello.
export async function signInGithub(formData: FormData): Promise<void> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim() || "/admin";
  await signIn("github", { redirectTo: callbackUrl });
}

export async function signInGoogle(formData: FormData): Promise<void> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim() || "/admin";
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signInDemo(): Promise<void> {
  await signIn("demo", { redirectTo: "/admin" });
}

// Richiede il magic-link SENZA redirect: così l'esito torna qui e possiamo
// mostrare un messaggio inline invece della pagina di errore di Next.
// Esito neutro (uguale per email autorizzate e non) per non rivelare
// quali indirizzi sono admin.
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, status: "empty" };
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim() || "/admin";

  try {
    // redirectTo = dove atterra il magic-link dopo la verifica (torna alla pagina
    // di partenza, es. la conferma di collegamento al portale).
    await signIn("resend", { email, redirectTo: callbackUrl, redirect: false });
  } catch (err) {
    // Se Auth.js tentasse comunque un redirect (caso di successo), lascialo passare.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    if (err instanceof AuthError) {
      return { ok: false, status: "error" };
    }
    throw err;
  }

  return { ok: true, status: "sent" };
}
