"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";
import { CONTENT } from "@/lib/siteContent";

export default function ServiziPage() {
  const { t, locale } = useLanguage();

  return (
    <section className="mx-auto grid max-w-5xl gap-12 px-6 py-20 sm:grid-cols-2">
      <div>
        <h1 className="font-serif-display text-3xl italic text-foreground">{t.details.title}</h1>
        <div className="mt-4 h-px w-16 bg-gold" />
        <ul className="mt-6 space-y-2 text-foreground/80">
          <li>{CONTENT.details.entirePlace[locale] || CONTENT.details.entirePlace.it}</li>
          <li>{CONTENT.details.quietCourtyard[locale] || CONTENT.details.quietCourtyard.it}</li>
          <li>{CONTENT.details.roomInfo[locale] || CONTENT.details.roomInfo.it}</li>
          <li>{CONTENT.details.maxGuests[locale] || CONTENT.details.maxGuests.it}</li>
          <li>{CONTENT.details.neighborhood[locale] || CONTENT.details.neighborhood.it}</li>
          {CONTENT.airbnbReviewCount > 0 && (
            <li>
              {format(t.details.rating, { rating: CONTENT.airbnbRating, count: CONTENT.airbnbReviewCount })}
            </li>
          )}
        </ul>
      </div>
      <div>
        <h2 className="font-serif-display text-3xl italic text-foreground">{t.amenities.title}</h2>
        <div className="mt-4 h-px w-16 bg-gold" />
        <ul className="mt-6 grid grid-cols-1 gap-2 text-foreground/80 sm:grid-cols-2">
          {CONTENT.amenities.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gold">·</span> {item[locale] || item.it}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
