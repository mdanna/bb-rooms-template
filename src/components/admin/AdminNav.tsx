"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import StructureSwitcher from "@/components/admin/StructureSwitcher";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminNav({ userName: _userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const { t } = useAdminLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ordine per frequenza d'uso: operatività (Dashboard, Calendario, Prenotazioni),
  // poi aspetto del sito (Contenuti, Immagini), poi Impostazioni.
  // Policy, Colori e Stripe non sono più voci di menu: card-link in Impostazioni.
  const links = [
    { href: "/admin/dashboard", label: t.nav.dashboard },
    { href: "/admin", label: t.nav.calendar },
    { href: "/admin/bookings", label: t.nav.bookings },
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
        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif-display text-sm italic text-foreground">
          {t.nav.title}
        </span>
        <span className="w-9" aria-hidden />
      </div>

      {/* Desktop toolbar: full-width con px-6 costante (niente mx-auto/max-w) così
          titolo e voci restano ancorati ai bordi a qualsiasi larghezza, come il NavBar pubblico. */}
      <div className="hidden items-center justify-between px-6 py-3 lg:flex">
        <span className="font-serif-display text-base italic text-foreground">
          {t.nav.title}
        </span>
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkCls(link.href)}>
              {link.label}
            </Link>
          ))}
          {/* Switcher tra le strutture del portale (non mostrato se la struttura è singola) */}
          <StructureSwitcher />
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
          >
            {t.nav.publicSite}
          </a>
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
            <a
              href="/"
              target="_blank"
              rel="noopener"
              onClick={() => setMobileOpen(false)}
              className="text-left text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
            >
              {t.nav.publicSite}
            </a>
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
