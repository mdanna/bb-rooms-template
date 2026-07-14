"use client";

import Link from "next/link";
import { signInGithub, signInGoogle, signInDemo } from "@/app/admin/actions";
import EmailLoginForm from "@/components/admin/EmailLoginForm";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

export default function AdminLogin({
  demo,
  google = false,
  callbackUrl,
}: {
  demo: boolean;
  google?: boolean;
  callbackUrl?: string;
}) {
  const { t } = useAdminLanguage();

  if (demo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        {/* Nessun "Torna al sito" qui: in demo il banner in cima offre già
            "Vedi il sito pubblico" (ed evita la sovrapposizione con la barra). */}
        <p className="text-xs uppercase tracking-[0.3em] text-gold">{t.login.demoEyebrow}</p>
        <h1 className="font-serif-display text-3xl italic text-foreground">{t.login.demoTitle}</h1>
        <p className="max-w-md text-sm text-foreground/70">
          {t.login.demoDesc}
          <strong>{t.login.demoNotSaved}</strong>.
        </p>
        <form action={signInDemo}>
          <button
            type="submit"
            className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
          >
            {t.login.demoEnter}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Link
        href="/"
        className="fixed left-6 top-6 text-xs uppercase tracking-widest text-foreground/60 transition hover:text-gold"
      >
        ← {t.login.backToSite}
      </Link>

      <h1 className="font-serif-display text-3xl italic text-foreground">{t.login.title}</h1>
      <p className="max-w-sm text-sm text-foreground/70">{t.login.subtitle}</p>

      {/* Login con GitHub */}
      <form action={signInGithub}>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <button
          type="submit"
          className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
        >
          {t.login.github}
        </button>
      </form>

      {/* Login con Google (mostrato solo se configurato per questo sito) */}
      {google && (
        <form action={signInGoogle}>
          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          <button
            type="submit"
            className="rounded-full border border-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-foreground transition hover:bg-gold/10"
          >
            {t.login.google}
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-foreground/40">
        <span className="h-px w-8 bg-foreground/20" /> {t.login.or} <span className="h-px w-8 bg-foreground/20" />
      </div>

      {/* Login con magic-link via email (client component con esito inline) */}
      <EmailLoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
