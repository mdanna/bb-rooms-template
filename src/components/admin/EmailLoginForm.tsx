"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "@/app/admin/actions";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

export default function EmailLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const { t } = useAdminLanguage();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    requestMagicLink,
    null,
  );

  const message = state
    ? state.status === "sent"
      ? t.login.emailSent
      : state.status === "empty"
        ? t.login.emailEmpty
        : t.login.emailError
    : null;

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <input
        type="email"
        name="email"
        required
        placeholder={t.login.emailPlaceholder}
        className="rounded-full border border-foreground/20 bg-transparent px-6 py-3 text-sm text-foreground outline-none transition focus:border-gold"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-foreground/30 px-8 py-3 text-sm font-medium uppercase tracking-widest text-foreground transition hover:border-gold hover:text-gold disabled:opacity-50"
      >
        {pending ? t.login.emailSending : t.login.emailSubmit}
      </button>

      {state && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.ok
              ? "border-gold/40 bg-gold/10 text-foreground"
              : "border-red-400/40 bg-red-400/10 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </form>
  );
}
