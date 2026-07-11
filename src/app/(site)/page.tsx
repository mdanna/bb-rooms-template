"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";
import { getBookingLinks } from "@/lib/bookingLinks";
import { format } from "@/i18n/format";
import UnitSwitcher from "@/components/UnitSwitcher";
import { rootUnitId, getUnit, isBookable } from "@/lib/structure";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export default function Home() {
  const { t, locale } = useLanguage();
  const { primary: bookPrimary, others: bookOthers } = getBookingLinks();
  // "Solo camere": l'appartamento intero non è prenotabile → niente CTA "prenota intero",
  // la scelta passa dalle camere (selettore sotto l'hero) e la home non linka /prenota.
  const rootU = getUnit(rootUnitId());
  const wholeBookable = rootU ? isBookable(rootU) : true;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <header className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
        <Image
          src={`/images/${CONTENT.heroImage}`}
          alt={CONTENT.siteTitle[locale] || CONTENT.siteTitle.it}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#f5efe1]/45" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a6a2a]">
            {CONTENT.locationDisplay}
          </p>
          <h1 className="font-serif-display mt-6 max-w-3xl text-4xl italic leading-tight text-foreground sm:text-6xl">
            {CONTENT.siteTitle[locale] || CONTENT.siteTitle.it}
          </h1>
          <div className="mx-auto mt-8 w-full max-w-xs">
            <Diamond />
          </div>
          <p className="mx-auto mt-8 max-w-xl text-base text-foreground sm:text-lg">
            {CONTENT.heroSubtitle[locale] || CONTENT.heroSubtitle.it}
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

      {/* Selettore unità: intero appartamento + singole camere */}
      <section className="bg-card py-8">
        <UnitSwitcher activeUnitId={rootUnitId()} />
      </section>

      {/* Racconto */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-serif-display text-3xl italic text-foreground sm:text-4xl">
          {CONTENT.storyTitle[locale] || CONTENT.storyTitle.it}
        </h2>
        <div className="mx-auto mt-6 max-w-xs">
          <Diamond />
        </div>
        {CONTENT.storyParagraphs.map((p, i) => (
          <p key={i} className="mt-6 text-left text-base leading-8 text-foreground/80 sm:text-lg">
            {p[locale] || p.it}
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
