"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import StructureSwitcher from "@/components/admin/StructureSwitcher";
import { CONTENT } from "@/lib/siteContent";
import { getUnit } from "@/lib/structure";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminNav({ userName: _userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const { t, locale } = useAdminLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  // A sinistra il NOME di dove si è (così si capisce), come link alla home pubblica →
  // la voce "Sito pubblico" diventa ridondante ed è stata tolta. Se stai gestendo una
  // CAMERA (?unit=<camera>) mostra il suo nome e linka alla sua pagina; altrimenti il
  // nome della struttura e linka alla home.
  const searchParams = useSearchParams();
  const unitParam = searchParams.get("unit") ?? undefined;
  const activeUnit = unitParam ? getUnit(unitParam) : undefined;
  const isRoom = !!activeUnit && !!activeUnit.slug; // le camere hanno uno slug; la radice ""
  const headerName = isRoom
    ? activeUnit!.name[locale] || activeUnit!.name.it || activeUnit!.id
    : CONTENT.siteTitle[locale] || CONTENT.siteTitle.it || t.nav.title;
  const homeHref = isRoom ? `/camera/${activeUnit!.slug}` : "/";

  // Ordine per frequenza d'uso: operatività (Dashboard, Calendario, Prenotazioni),
  // poi aspetto del sito (Contenuti, Immagini), poi Impostazioni.
  // Policy, Colori e Stripe non sono più voci di menu: card-link in Impostazioni.
  const links = [
    { href: "/admin/dashboard", label: t.nav.dashboard },
    { href: "/admin", label: t.nav.calendar },
    { href: "/admin/bookings", label: t.nav.bookings },
    { href: "/admin/recensioni", label: t.nav.reviews },
    { href: "/admin/contenuti", label: t.nav.contents },
    { href: "/admin/immagini", label: t.nav.images },
    { href: "/admin/impostazioni", label: t.nav.settings },
  ];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const linkCls = (href: string) =>
    `text-xs uppercase tracking-widest transition hover:text-gold ${
      isActive(href) ? "text-gold" : "text-foreground/70"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-gold/30 bg-background/90 backdrop-blur-sm">
      {/* Mobile toolbar */}
      <div className="relative flex items-center justify-between px-6 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="rounded-full border border-gold/40 px-3 py-1.5 text-gold"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <Link href={homeHref} className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif-display text-sm italic text-foreground transition hover:text-gold">
          {headerName}
        </Link>
        <span className="w-9" aria-hidden />
      </div>

      {/* Desktop toolbar: full-width con px-6 costante (niente mx-auto/max-w) così
          titolo e voci restano ancorati ai bordi a qualsiasi larghezza, come il NavBar pubblico. */}
      <div className="hidden items-center justify-between px-6 py-3 lg:flex">
        <Link href={homeHref} className="font-serif-display text-base italic text-foreground transition hover:text-gold">
          {headerName}
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkCls(link.href)}>
              {link.label}
            </Link>
          ))}
          {/* Switcher tra le strutture del portale (non mostrato se la struttura è singola) */}
          <StructureSwitcher />
          <button
            onClick={() => signOut({ callbackUrl: "/admin" })}
            className="text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
          >
            {t.nav.signOut}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-gold/30 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkCls(link.href)}
              >
                {link.label}
              </Link>
            ))}
            <StructureSwitcher />
            <button
              onClick={() => signOut({ callbackUrl: "/admin" })}
              className="text-left text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
            >
              {t.nav.signOut}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
