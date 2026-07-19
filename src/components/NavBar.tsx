"use client";

import Link from "next/link";
import { pickL10n } from "@/lib/l10n";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { localeOrder, translations, type LocaleCode } from "@/i18n/index";
import { CONTENT } from "@/lib/siteContent";
import { getUnit, rootUnitId, isBookable } from "@/lib/structure";

const FLAGS: Record<LocaleCode, string> = {
  it: "🇮🇹",
  en: "🇬🇧",
  fr: "🇫🇷",
  de: "🇩🇪",
  es: "🇪🇸",
  pt: "🇵🇹",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
};

function LanguagePicker({
  locale,
  setLocale,
  open,
  setOpen,
}: {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={translations[locale].langName}
        className="text-xl leading-none transition hover:opacity-70"
      >
        {FLAGS[locale]}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-gold/40 bg-background shadow-lg">
          {localeOrder.map((code) => (
            <button
              key={code}
              onClick={() => {
                setLocale(code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-gold/10 ${
                code === locale ? "text-gold" : "text-foreground/80"
              }`}
            >
              <span className="text-base leading-none">{FLAGS[code]}</span>
              {translations[code].langName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { t, locale, setLocale } = useLanguage();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Stessa struttura dei siti mono-struttura: link "contenuto" (browse), l'azione
  // principale (Prenota) è un pulsante CTA a parte e "gestisci prenotazione" vive
  // nel footer. Unica differenza data-driven: "solo camere" (l'appartamento intero
  // non è prenotabile) → niente CTA "Prenota" dell'intero, si prenota dalle camere.
  const rootU = getUnit(rootUnitId());
  const wholeBookable = rootU ? isBookable(rootU) : true;

  // Il CTA "Prenota" prenota l'ELEMENTO CORRENTE, come i pulsanti in pagina: su una
  // pagina camera scrolla al form di QUELLA camera (#prenota, come l'hero camera);
  // sulle pagine dell'intero porta alla pagina di prenotazione dell'intero (/prenota,
  // come l'hero della home). Sulla camera il CTA c'è sempre; sull'intero solo se
  // l'intero è prenotabile (in "solo camere" si prenota dalla pagina camera).
  const onRoomPage = pathname.startsWith("/camera/");
  const bookHref = onRoomPage ? "#prenota" : "/prenota";
  const showBook = onRoomPage || wholeBookable;

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/galleria", label: t.nav.gallery },
    { href: "/servizi", label: t.nav.amenities },
    { href: "/zona", label: t.nav.area },
    { href: "/recensioni", label: t.nav.reviews },
  ];

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gold/30 bg-background/90 backdrop-blur-sm">
      {/* Mobile toolbar: hamburger left, title centered, language right */}
      <div className="relative flex items-center justify-between px-6 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="rounded-full border border-gold/40 px-3 py-1.5 text-gold"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif-display text-sm italic text-foreground"
        >
          {pickL10n(CONTENT.siteTitle, locale)}
        </Link>
        <LanguagePicker locale={locale} setLocale={setLocale} open={langOpen} setOpen={setLangOpen} />
      </div>

      {/* Desktop toolbar */}
      <div className="hidden items-center justify-between px-6 py-3 lg:flex">
        <Link href="/" className="whitespace-nowrap font-serif-display text-base italic text-foreground">
          {pickL10n(CONTENT.siteTitle, locale)}
        </Link>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs uppercase tracking-widest transition hover:text-gold ${
                  isActive(link.href) ? "text-gold" : "text-foreground/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          {showBook && (
            <Link
              href={bookHref}
              className="rounded-full border border-gold bg-gold px-5 py-1.5 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
            >
              {t.nav.booking}
            </Link>
          )}
          <LanguagePicker locale={locale} setLocale={setLocale} open={langOpen} setOpen={setLangOpen} />
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-gold/30 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`text-xs uppercase tracking-widest transition hover:text-gold ${
                  isActive(link.href) ? "text-gold" : "text-foreground/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {showBook && (
              <Link
                href={bookHref}
                onClick={() => setMobileOpen(false)}
                className="mt-1 rounded-full border border-gold bg-gold px-5 py-2 text-center text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
              >
                {t.nav.booking}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
