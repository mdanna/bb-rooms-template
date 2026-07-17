"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

/** Lingue in cui la recensione è disponibile (la sorgente è sempre inclusa). */
function availableLangs(r: PublicReview): string[] {
  return r.translations
    ? Object.keys(r.translations).filter((k) => (r.translations as Record<string, string>)[k]?.trim())
    : [];
}

/**
 * Lingua di default con cui mostrare la recensione: quella del visitatore se
 * disponibile, altrimenti l'originale. Usata sia dalla card (sola lettura) sia
 * come stato iniziale della modale (dove è cambiabile).
 */
function defaultDisplay(r: PublicReview, locale: string): string {
  return availableLangs(r).includes(locale) ? locale : r.bodyLocale;
}

function reviewText(r: PublicReview, display: string): string {
  return cleanReviewText((r.translations && r.translations[display]?.trim()) || r.body);
}

/**
 * Card compatta e di altezza uniforme: stelle, testo troncato a 3 righe e footer.
 * Se il testo è realmente troncato mostra "Leggi tutto" che apre la modale; i
 * controlli di lingua vivono ora solo nella modale, così la griglia resta pulita.
 */
function ReviewCard({ r, onOpen }: { r: PublicReview; onOpen: () => void }) {
  const { t, locale } = useLanguage();
  const display = defaultDisplay(r, locale);
  const text = reviewText(r, display);

  const pRef = useRef<HTMLParagraphElement | null>(null);
  const [truncated, setTruncated] = useState(false);

  // Rileva il troncamento confrontando l'altezza reale col riquadro clampato.
  // Gira solo lato client (l'effetto non parte in SSR) e aggiorna lo stato solo
  // quando il valore cambia davvero, evitando il lint set-state-in-effect e loop.
  useEffect(() => {
    const el = pRef.current;
    if (!el) return;
    const isTrunc = el.scrollHeight - el.clientHeight > 2;
    if (isTrunc !== truncated) setTruncated(isTrunc);
  }, [text, display, locale, truncated]);

  return (
    <blockquote className="flex min-h-[13rem] flex-col rounded-lg border border-gold/40 bg-card p-6 text-sm leading-7 text-foreground/80">
      <div className="mb-2 flex items-center justify-between">
        <Stars rating={r.rating} />
        {r.verified && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
            ✓ {t.reviews.verified}
          </span>
        )}
      </div>

      <p ref={pRef} className="line-clamp-3">
        &ldquo;{text}&rdquo;
      </p>

      {truncated && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 self-start text-xs text-gold transition hover:underline"
        >
          {t.reviews.readMore}
        </button>
      )}

      <footer className="label-gold mt-auto pt-4 text-[10px]">
        {r.author}
        {r.stayMonth ? ` · ${r.stayMonth}` : ""}
      </footer>
    </blockquote>
  );
}

/**
 * Modale con la recensione completa: possiede lo stato della lingua mostrata
 * (i controlli lingua sono stati spostati qui dalla card). Chiude con la X, il
 * click sullo sfondo e il tasto Escape; blocca lo scroll di fondo mentre è aperta.
 */
function ReviewModal({ r, onClose }: { r: PublicReview; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const source = r.bodyLocale;
  const available = availableLangs(r);
  const [display, setDisplay] = useState(() => defaultDisplay(r, locale));
  const text = reviewText(r, display);
  const isTranslated = display !== source;

  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Sposta il focus sul pulsante di chiusura all'apertura.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Chiusura con Escape + blocco dello scroll di fondo mentre la modale è aperta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.reviews.title}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gold/40 bg-card p-6 text-sm leading-7 text-foreground/80"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t.reviews.close}
          className="absolute right-3 top-3 text-foreground/50 transition hover:text-gold"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mb-3 flex items-center gap-2 pr-8">
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
              type="button"
              onClick={() => setDisplay(source)}
              className="underline underline-offset-2 transition hover:text-gold"
            >
              {t.reviews.original}
            </button>
          )}
          {available.length > 1 && (
            <select
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
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
      </div>
    </div>
  );
}

export default function RecensioniClient({ reviews, aggregate }: Props) {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState<number | null>(null);
  const openReview = openId != null ? reviews.find((r) => r.id === openId) ?? null : null;

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
            <ReviewCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} />
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

      {openReview && <ReviewModal r={openReview} onClose={() => setOpenId(null)} />}
    </section>
  );
}
