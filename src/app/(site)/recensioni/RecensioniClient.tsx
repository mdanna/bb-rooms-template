"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";
import { translations as I18N, type LocaleCode } from "@/i18n/index";
import { cleanReviewText } from "@/lib/reviewText";

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

/** Nome nativo di una lingua (es. "Italiano", "English") dal suo codice. */
function langName(code: string): string {
  return I18N[code as LocaleCode]?.langName ?? code.toUpperCase();
}

function ReviewCard({ r }: { r: PublicReview }) {
  const { t, locale } = useLanguage();
  // Lingue in cui la recensione è disponibile (la sorgente è sempre inclusa).
  const available = r.translations
    ? Object.keys(r.translations).filter((k) => (r.translations as Record<string, string>)[k]?.trim())
    : [];
  const source = r.bodyLocale;
  // Default: la lingua del visitatore se disponibile, altrimenti l'originale.
  const initial = available.includes(locale) ? locale : source;
  // L'override manuale (pulsante "originale" / menu lingua) è LEGATO alla lingua del sito
  // attiva: se il visitatore cambia lingua al sito, il default torna a seguire la nuova
  // lingua (l'override valeva solo finché restava su quella). Così le recensioni seguono
  // il cambio lingua, senza un useEffect di sincronizzazione.
  const [override, setOverride] = useState<{ forLocale: string; lang: string } | null>(null);
  const display = override && override.forLocale === locale ? override.lang : initial;

  const text = cleanReviewText((r.translations && r.translations[display]?.trim()) || r.body);
  const isTranslated = display !== source;

  return (
    <blockquote className="rounded-lg border border-gold/40 bg-card p-6 text-sm leading-7 text-foreground/80">
      <div className="mb-2 flex items-center justify-between">
        <Stars rating={r.rating} />
        {r.verified && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
            ✓ {t.reviews.verified}
          </span>
        )}
      </div>

      <p>&ldquo;{text}&rdquo;</p>

      {/* Lingua d'origine + eventuale indicatore "tradotto" + scelta lingua */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-foreground/45">
        <span>{format(t.reviews.writtenIn, { lang: langName(source) })}</span>
        {isTranslated && <span className="text-gold/70">· {t.reviews.translated}</span>}
        {isTranslated && (
          <button
            onClick={() => setOverride({ forLocale: locale, lang: source })}
            className="underline underline-offset-2 transition hover:text-gold"
          >
            {t.reviews.original}
          </button>
        )}
        {available.length > 1 && (
          <select
            value={display}
            onChange={(e) => setOverride({ forLocale: locale, lang: e.target.value })}
            aria-label={t.reviews.original}
            className="ml-auto rounded border border-gold/30 bg-background px-1.5 py-0.5 text-[10px] text-foreground/70 outline-none focus:border-gold"
          >
            {available.map((l) => (
              <option key={l} value={l}>
                {langName(l)}
              </option>
            ))}
          </select>
        )}
      </div>

      <footer className="label-gold mt-4 text-[10px]">
        {r.author}
        {r.stayMonth ? ` · ${r.stayMonth}` : ""}
      </footer>
    </blockquote>
  );
}

export default function RecensioniClient({ reviews, aggregate }: Props) {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20">
      <h1 className="font-serif-display mb-4 text-center text-3xl italic text-foreground">
        {t.reviews.title}
      </h1>
      {aggregate && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <span className="font-serif-display text-5xl leading-none text-gold">
              {aggregate.rating}
            </span>
            <Stars rating={5} />
          </div>
          <p className="label-gold mt-1 text-[11px]">
            {format(t.reviews.aggregateReviews, { count: aggregate.count })}
          </p>
        </div>
      )}
      <div className="mx-auto mb-10 mt-6 max-w-xs">
        <Diamond />
      </div>

      {reviews.length === 0 ? (
        <p className="mx-auto max-w-xl text-center text-sm text-foreground/60">{t.reviews.empty}</p>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {/* La scrittura di una recensione vive su una pagina dedicata (/recensioni/scrivi):
          qui teniamo solo la call-to-action, così l'elenco resta protagonista. */}
      <div className="mt-14 text-center">
        <Link
          href="/recensioni/scrivi"
          className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          {t.reviews.writeCta}
        </Link>
      </div>
    </section>
  );
}
