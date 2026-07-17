"use client";

import { useState } from "react";
import { pickL10n } from "@/lib/l10n";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingForm from "@/components/BookingForm";
import UnitSwitcher from "@/components/UnitSwitcher";
import HeroBackdrop from "@/components/HeroBackdrop";
import { useLanguage } from "@/i18n/LanguageContext";
import { heroImageList, type SiteContent } from "@/lib/siteContent";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

interface Props {
  unitId: string;
  content: SiteContent;
  minAdvanceDays: number;
}

export default function CameraClient({ unitId, content, minAdvanceDays }: Props) {
  const { t, locale } = useLanguage();
  const [booking, setBooking] = useState<{
    checkin: string;
    checkout: string;
    totalPrice: number;
  } | null>(null);

  const title = pickL10n(content.siteTitle, locale);
  const subtitle = pickL10n(content.heroSubtitle, locale);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero della camera */}
      <header className="relative flex min-h-[55vh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <HeroBackdrop
          images={heroImageList(content)}
          intervalSec={content.heroIntervalSec ?? 5}
          veilClassName="bg-[#f5efe1]/45"
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a6a2a]">
            {content.locationDisplay}
          </p>
          <h1 className="font-serif-display mt-6 max-w-3xl text-4xl italic leading-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <div className="mx-auto mt-6 w-full max-w-xs">
            <Diamond />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-base text-foreground sm:text-lg">{subtitle}</p>
          <div className="mt-8">
            <a
              href="#prenota"
              className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
            >
              {t.hero.bookDirect}
            </a>
          </div>
        </div>
      </header>

      {/* Selettore unità */}
      <section className="bg-card py-8">
        <UnitSwitcher activeUnitId={unitId} />
      </section>

      {/* Descrizione + servizi */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
          {pickL10n(content.storyTitle, locale)}
        </h2>
        <div className="mx-auto mt-6 max-w-xs">
          <Diamond />
        </div>
        {content.storyParagraphs.map((p, i) => (
          <p key={i} className="mt-6 text-left text-base leading-8 text-foreground/80 sm:text-lg">
            {pickL10n(p, locale)}
          </p>
        ))}

        {content.amenities.length > 0 && (
          <ul className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-2">
            {content.amenities.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-foreground/80">
                <span className="text-gold">◆</span>
                {pickL10n(a, locale)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Prenotazione della camera */}
      <section id="prenota" className="scroll-mt-24 px-6 pb-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
            {t.booking.title}
          </h2>
          <div className="mx-auto mt-4 max-w-xs">
            <Diamond />
          </div>
        </div>

        <div className="mt-10">
          <AvailabilityCalendar
            unitId={unitId}
            minAdvanceDays={minAdvanceDays}
            onRequestBooking={(checkin, checkout, totalPrice) =>
              setBooking({ checkin, checkout, totalPrice })
            }
            onClear={() => setBooking(null)}
          />
        </div>

        <BookingForm
          unitId={unitId}
          checkin={booking?.checkin ?? ""}
          checkout={booking?.checkout ?? ""}
          totalPrice={booking?.totalPrice ?? 0}
        />
      </section>
    </div>
  );
}
