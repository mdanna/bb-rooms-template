"use client";

import { useState } from "react";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingForm from "@/components/BookingForm";
import UnitSwitcher from "@/components/UnitSwitcher";
import { rootUnitId } from "@/lib/structure";
import { useLanguage } from "@/i18n/LanguageContext";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

interface Props {
  airbnbUrl: string;
  minAdvanceDays: number;
}

export default function PrenotaClient({ airbnbUrl, minAdvanceDays }: Props) {
  const { t } = useLanguage();
  const [booking, setBooking] = useState<{
    checkin: string;
    checkout: string;
    totalPrice: number;
  } | null>(null);

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
          {t.booking.title}
        </h1>
        <div className="mx-auto mt-4 max-w-xs">
          <Diamond />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-foreground/80">{t.booking.subtitle}</p>
        {airbnbUrl && (
          <p className="mx-auto mt-3 max-w-xl text-sm text-foreground/60">
            {t.booking.preferAirbnb}{" "}
            <a
              href={airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline"
            >
              {t.hero.bookAirbnb}
            </a>
          </p>
        )}
      </div>

      <div className="mt-10">
        <UnitSwitcher activeUnitId={rootUnitId()} />
      </div>

      <div className="mt-12">
        <AvailabilityCalendar
          minAdvanceDays={minAdvanceDays}
          onRequestBooking={(checkin, checkout, totalPrice) =>
            setBooking({ checkin, checkout, totalPrice })
          }
          onClear={() => setBooking(null)}
        />
      </div>

      <BookingForm
        checkin={booking?.checkin ?? ""}
        checkout={booking?.checkout ?? ""}
        totalPrice={booking?.totalPrice ?? 0}
      />
    </section>
  );
}
