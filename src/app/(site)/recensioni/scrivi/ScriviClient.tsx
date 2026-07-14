"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ScriviClient({
  prefillCode = null,
  token = null,
}: {
  prefillCode?: string | null;
  token?: string | null;
}) {
  const { t, locale } = useLanguage();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [stayMonth, setStayMonth] = useState("");
  const [bookingCode, setBookingCode] = useState(prefillCode ?? "");
  const [email, setEmail] = useState("");
  // Link dall'email di richiesta recensione: codice + token firmato → soggiorno verificato,
  // il campo codice è precompilato e in sola lettura.
  const verifiedViaToken = Boolean(prefillCode && token);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const inputCls =
    "w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: name,
          rating,
          body,
          locale,
          consent,
          stayMonth: stayMonth || undefined,
          bookingCode: bookingCode || undefined,
          token: token || undefined,
          email: email || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.reviews.error);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.reviews.error);
      setState("error");
    }
  }

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-xl">
        <Link
          href="/recensioni"
          className="label-gold mb-10 inline-block text-[11px] text-gold transition hover:opacity-70"
        >
          {t.reviews.backToList}
        </Link>

        {state === "done" ? (
          <div className="rounded-lg border border-gold/40 bg-card p-6 text-center text-sm text-foreground/80">
            <p>{t.reviews.success}</p>
            <Link
              href="/recensioni"
              className="mt-6 inline-block rounded-full bg-gold px-8 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              {t.reviews.backToList}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-center font-serif-display text-2xl italic text-foreground">
              {t.reviews.writeTitle}
            </h1>
            <p className="mx-auto max-w-xl text-center text-[11px] leading-5 text-foreground/50">
              {t.reviews.transparency}
            </p>

            <div>
              <label className="mb-1 block text-xs text-foreground/60">{t.reviews.yourRating}</label>
              <div className="flex gap-1 text-2xl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n}/5`}
                    className={n <= rating ? "text-gold" : "text-gold/30"}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">{t.reviews.name}</span>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder={t.reviews.namePlaceholder}
              />
              <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.nameHint}</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">{t.reviews.yourReview}</span>
              <textarea
                className={inputCls}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
              />
              <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.autoTranslate}</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-foreground/60">{t.reviews.stayMonth}</span>
                <input
                  className={inputCls}
                  value={stayMonth}
                  onChange={(e) => setStayMonth(e.target.value)}
                  placeholder={t.reviews.stayMonthPh}
                  maxLength={40}
                />
                <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.stayMonthHint}</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-foreground/60">{t.reviews.bookingCode}</span>
                <input
                  className={`${inputCls} ${verifiedViaToken ? "cursor-not-allowed opacity-70" : ""}`}
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value)}
                  maxLength={40}
                  readOnly={verifiedViaToken}
                />
                {verifiedViaToken ? (
                  <span className="mt-1 block text-[10px] text-gold">✓ {t.reviews.verified}</span>
                ) : (
                  <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.bookingCodeHelp}</span>
                )}
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-foreground/60">{t.reviews.email}</span>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              />
              <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.emailHelp}</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-0.5"
              />
              <span>{t.reviews.consent}</span>
            </label>

            {state === "error" && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={state === "sending" || !consent}
              className="w-full rounded-full bg-gold px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "sending" ? t.reviews.sending : t.reviews.submit}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
