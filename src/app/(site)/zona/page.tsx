"use client";

import dynamic from "next/dynamic";
import { pickL10n } from "@/lib/l10n";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";

const AreaMap = dynamic(() => import("@/components/AreaMap"), { ssr: false });

// Un colore distinto per ogni segnalibro, così si riconoscono sulla mappa
// (l'appartamento resta blu). Oltre il quinto la palette si ricicla.
const BOOKMARK_COLORS = ["#dc2626", "#7c3aed", "#16a34a", "#8b4513", "#ca8a04"];

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export default function ZonaPage() {
  const { t, locale } = useLanguage();

  return (
    <section className="bg-card px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="font-serif-display text-3xl italic text-foreground">{t.area.title}</h1>
        <div className="mx-auto mt-4 max-w-xs">
          <Diamond />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-foreground/80">{pickL10n(CONTENT.areaDescription, locale)}</p>

        <div className="mx-auto mt-10 overflow-hidden rounded-lg border border-gold/40">
          <AreaMap
            markers={[
              { lat: CONTENT.mapLat, lon: CONTENT.mapLng, label: t.area.mapApartmentLabel, color: "#2563eb" },
              ...CONTENT.mapBookmarks.map((b, i) => ({ lat: b.lat, lon: b.lng, label: b.label, color: BOOKMARK_COLORS[i % BOOKMARK_COLORS.length] })),
            ]}
          />
        </div>
        <div className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-foreground/60">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full border border-white" style={{ backgroundColor: "#2563eb" }} />
            {t.area.mapApartmentLabel}
          </span>
          {CONTENT.mapBookmarks.map((b, i) => (
            <span key={b.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border border-white" style={{ backgroundColor: BOOKMARK_COLORS[i % BOOKMARK_COLORS.length] }} />
              {b.label}
            </span>
          ))}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CONTENT.areaPlaces.map((place) => {
            const name = pickL10n(place.name, locale);
            const distance = pickL10n(place.comment, locale);
            return (
              <div
                key={place.name.it}
                className="rounded-lg border border-gold/40 bg-background p-6 text-left"
              >
                <p className="font-serif-display text-lg italic text-foreground">{name}</p>
                <p className="mt-1 text-sm text-foreground/70">{distance}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
