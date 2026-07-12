"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export interface PublicReview {
  id: number;
  author: string;
  rating: number;
  /** Traduzioni { it,en,... } se presenti. */
  translations: Record<string, string> | null;
  /** Testo originale + sua lingua (fallback se manca la traduzione). */
  body: string;
  bodyLocale: string;
  verified: boolean;
  stayMonth: string | null;
  datePublished: string;
}

interface Props {
  reviews: PublicReview[];
  /** Rating aggregato già formattato col punto (es. "4.94") + conteggio. */
  aggregate: { rating: string; count: number } | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-gold" aria-label={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="text-gold/30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function RecensioniClient({ reviews, aggregate }: Props) {
  const { t, locale } = useLanguage();

  function textOf(r: PublicReview): string {
    return (r.translations?.[locale] || r.translations?.it || "").trim() || r.body;
  }

  return (
    <section className="px-6 py-20">
      <h1 className="font-serif-display mb-2 text-center text-3xl italic text-foreground">
        {t.reviews.title}
      </h1>
      {aggregate && (
        <p className="text-center text-sm text-foreground/60">
          {format(t.reviews.subtitleOwn, { rating: aggregate.rating, count: aggregate.count })}
        </p>
      )}
      <div className="mx-auto mb-10 mt-4 max-w-xs">
        <Diamond />
      </div>

      {reviews.length === 0 ? (
        <p className="mx-auto max-w-xl text-center text-sm text-foreground/60">{t.reviews.empty}</p>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {reviews.map((r) => (
            <blockquote
              key={r.id}
              className="rounded-lg border border-gold/40 bg-card p-6 text-sm leading-7 text-foreground/80"
            >
              <div className="mb-2 flex items-center justify-between">
                <Stars rating={r.rating} />
                {r.verified && (
                  <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
                    ✓ {t.reviews.verified}
                  </span>
                )}
              </div>
              <p>&ldquo;{textOf(r)}&rdquo;</p>
              <footer className="label-gold mt-4 text-[10px]">
                {r.author}
                {r.stayMonth ? ` · ${r.stayMonth}` : ""}
              </footer>
            </blockquote>
          ))}
        </div>
      )}

      <ReviewForm />
    </section>
  );
}

function ReviewForm() {
  const { t, locale } = useLanguage();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [stayMonth, setStayMonth] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [email, setEmail] = useState("");
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

  if (state === "done") {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-lg border border-gold/40 bg-card p-6 text-center text-sm text-foreground/80">
        {t.reviews.success}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-xl space-y-4">
      <h2 className="text-center font-serif-display text-2xl italic text-foreground">
        {t.reviews.writeTitle}
      </h2>
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
          <input className={inputCls} value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} maxLength={40} />
          <span className="mt-1 block text-[10px] text-foreground/40">{t.reviews.bookingCodeHelp}</span>
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
  );
}
