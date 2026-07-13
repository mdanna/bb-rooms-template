"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { pickL10n } from "@/lib/l10n";
import { CONTENT } from "@/lib/siteContent";

export default function ServiziPage() {
  const { t, locale } = useLanguage();

  return (
    <section className="mx-auto grid max-w-5xl gap-12 px-6 py-20 sm:grid-cols-2">
      <div>
        <h1 className="font-serif-display text-3xl italic text-foreground">{t.details.title}</h1>
        <div className="mt-4 h-px w-16 bg-gold" />
        <ul className="mt-6 space-y-2 text-foreground/80">
          <li>{pickL10n(CONTENT.details.entirePlace, locale)}</li>
          <li>{pickL10n(CONTENT.details.quietCourtyard, locale)}</li>
          <li>{pickL10n(CONTENT.details.roomInfo, locale)}</li>
          <li>{pickL10n(CONTENT.details.maxGuests, locale)}</li>
          <li>{pickL10n(CONTENT.details.neighborhood, locale)}</li>
        </ul>
      </div>
      <div>
        <h2 className="font-serif-display text-3xl italic text-foreground">{t.amenities.title}</h2>
        <div className="mt-4 h-px w-16 bg-gold" />
        <ul className="mt-6 grid grid-cols-1 gap-2 text-foreground/80 sm:grid-cols-2">
          {CONTENT.amenities.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gold">·</span> {pickL10n(item, locale)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
