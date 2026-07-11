"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";
import { CONTENT } from "@/lib/siteContent";
import { listingUrls } from "@/lib/bookingLinks";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export default function RecensioniPage() {
  const { t, locale } = useLanguage();
  const airbnbUrl = listingUrls().airbnb;

  return (
    <section className="px-6 py-20">
      <h1 className="font-serif-display mb-2 text-center text-3xl italic text-foreground">
        {t.reviews.title}
      </h1>
      {CONTENT.airbnbReviewCount > 0 && (
        <p className="text-center text-sm text-foreground/60">
          {format(t.reviews.subtitle, { rating: CONTENT.airbnbRating, count: CONTENT.airbnbReviewCount })}
        </p>
      )}
      <div className="mx-auto mb-10 mt-4 max-w-xs">
        <Diamond />
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
        {CONTENT.reviews.map((review, i) => (
          <blockquote
            key={i}
            className="rounded-lg border border-gold/40 bg-card p-6 text-sm leading-7 text-foreground/80"
          >
            <p>&ldquo;{review.text[locale] || review.text.it}&rdquo;</p>
            <footer className="label-gold mt-4 text-[10px]">{review.author}</footer>
          </blockquote>
        ))}
      </div>
      {airbnbUrl && (
        <p className="mx-auto mt-4 max-w-5xl text-center text-xs">
          <a
            href={airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline"
          >
            {t.reviews.readMore}
          </a>
        </p>
      )}
    </section>
  );
}
