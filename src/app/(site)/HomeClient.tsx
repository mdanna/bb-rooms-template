"use client";

import Image from "next/image";
import { pickL10n } from "@/lib/l10n";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT, heroImageList } from "@/lib/siteContent";
import HeroBackdrop from "@/components/HeroBackdrop";
import { getBookingLinks } from "@/lib/bookingLinks";
import { format } from "@/i18n/format";
import UnitSwitcher from "@/components/UnitSwitcher";
import { rootUnitId, getUnit, isBookable, bookableUnits } from "@/lib/structure";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

// Copertina (singola) di ogni camera, precalcolata lato server: id unità → prima foto.
// È SEMPRE una foto sola (mai il carosello): la card è un teaser verso /camera/<slug>.
export default function HomeClient({ roomImages }: { roomImages: Record<string, string | null> }) {
  const { t, locale } = useLanguage();
  const { primary: bookPrimary, others: bookOthers } = getBookingLinks();
  // "Solo camere": l'appartamento intero non è prenotabile → niente CTA "prenota intero",
  // la scelta passa dalle camere (selettore sotto l'hero) e la home non linka /prenota.
  const rootU = getUnit(rootUnitId());
  const wholeBookable = rootU ? isBookable(rootU) : true;
  // Modalità "solo camere": l'intero non è prenotabile → la home elenca le camere
  // prenotabili (senza dipendere dallo UnitSwitcher, che si nasconde con ≤1 unità).
  const rooms = wholeBookable ? [] : bookableUnits().filter((u) => u.slug);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <header className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
        <HeroBackdrop
          images={heroImageList(CONTENT)}
          intervalSec={CONTENT.heroIntervalSec ?? 5}
          veilClassName="bg-[#f5efe1]/45"
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a6a2a]">
            {CONTENT.locationDisplay}
          </p>
          <h1 className="font-serif-display mt-6 max-w-3xl text-4xl italic leading-tight text-foreground sm:text-6xl">
            {pickL10n(CONTENT.siteTitle, locale)}
          </h1>
          <div className="mx-auto mt-8 w-full max-w-xs">
            <Diamond />
          </div>
          <p className="mx-auto mt-8 max-w-xl text-base text-foreground sm:text-lg">
            {pickL10n(CONTENT.heroSubtitle, locale)}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {wholeBookable && (
              <Link
                href="/prenota"
                className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
              >
                {t.hero.bookDirect}
              </Link>
            )}
            {wholeBookable && bookPrimary && (
              <a
                href={bookPrimary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
              >
                {format(t.hero.bookOn, { platform: bookPrimary.name })}
              </a>
            )}
          </div>
          {wholeBookable && bookOthers.length > 0 && (
            <p className="mt-5 text-sm text-foreground/60">
              {t.hero.alsoOn}{" "}
              {bookOthers.map((o, i) => (
                <span key={o.platform}>
                  {i > 0 && " · "}
                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2 hover:text-gold/80">
                    {o.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </header>

      {/* Intero prenotabile: selettore unità (intero + camere). Solo camere:
          elenco delle camere prenotabili, così restano sempre raggiungibili. */}
      {wholeBookable ? (
        <section className="bg-card py-8">
          <UnitSwitcher activeUnitId={rootUnitId()} />
        </section>
      ) : (
        rooms.length > 0 && (
          <section className="bg-card px-6 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
                {t.hero.roomsTitle}
              </h2>
              <div className="mx-auto mt-6 max-w-xs">
                <Diamond />
              </div>
              <p className="mx-auto mt-4 max-w-xl text-base text-foreground/70">
                {t.hero.roomsSubtitle}
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {rooms.map((u) => {
                const img = roomImages[u.id] ?? null;
                const name = pickL10n(u.name, locale) || u.id;
                return (
                  <Link
                    key={u.id}
                    href={`/camera/${u.slug}`}
                    className="group overflow-hidden rounded-lg border border-gold/40 bg-background text-center transition hover:border-gold"
                  >
                    {img && (
                      <div className="overflow-hidden">
                        <Image
                          src={`/images/${img}`}
                          alt={name}
                          width={800}
                          height={600}
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90"
                        />
                      </div>
                    )}
                    <span className="block px-8 py-6 font-serif-display text-xl italic text-foreground">
                      {name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )
      )}

      {/* Racconto */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
          {pickL10n(CONTENT.storyTitle, locale)}
        </h2>
        <div className="mx-auto mt-6 max-w-xs">
          <Diamond />
        </div>
        {CONTENT.storyParagraphs.map((p, i) => (
          <p key={i} className="mt-6 text-left text-base leading-8 text-foreground/80 sm:text-lg">
            {pickL10n(p, locale)}
          </p>
        ))}
      </section>

      {/* Link rapidi alle altre sezioni */}
      <section className="bg-card px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            { href: "/galleria", label: t.nav.gallery },
            { href: "/servizi", label: t.nav.amenities },
            { href: "/zona", label: t.nav.area },
            { href: "/recensioni", label: t.nav.reviews },
            ...(wholeBookable ? [{ href: "/prenota", label: t.nav.booking }] : []),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-gold/40 bg-background p-6 text-center font-serif-display text-lg italic text-foreground transition hover:border-gold"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
