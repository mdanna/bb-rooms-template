"use client";

import Link from "next/link";
import { pickL10n } from "@/lib/l10n";
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
    return pickL10n(r.translations, locale).trim() || r.body;
  }

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
