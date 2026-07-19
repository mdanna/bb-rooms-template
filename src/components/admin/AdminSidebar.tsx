"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import StructureSwitcher from "@/components/admin/StructureSwitcher";
import { CONTENT } from "@/lib/siteContent";
import { getUnit, allUnits } from "@/lib/structure";

// Sidebar del pannello: sostituisce la vecchia top-bar. Lo sfondo diverso dal sito
// pubblico dà lo "stacco" (si capisce subito di essere nel pannello) e l'eyebrow
// "Amministrazione" + nome (struttura o camera in gestione) dice sempre dove sei.
// Voci raggruppate: Gestione (ogni giorno), Il tuo sito (vetrina), Impostazioni (raro).

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
interface NavGroup {
  header: string;
  items: NavItem[];
}

// Icone (SVG inline, outline) — niente libreria esterna, coerenti col resto del sito.
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    bookings: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
    reviews: (
      <path d="M12 3l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.99l-5.2 2.02.99-5.79-4.21-4.1 5.82-.85z" />
    ),
    contents: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </>
    ),
    images: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </>
    ),
    colors: (
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    ),
    translations: (
      <>
        <path d="M5 8l6 6" />
        <path d="M4 14l6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="M22 22l-5-10-5 10" />
        <path d="M14 18h6" />
      </>
    ),
    rooms: (
      <>
        <path d="M2 4v16" />
        <path d="M2 8h18a2 2 0 0 1 2 2v10" />
        <path d="M2 17h20" />
        <path d="M6 8v9" />
      </>
    ),
    rules: (
      <>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
      </>
    ),
    payments: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
    access: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21a6 6 0 0 1 12 0" />
        <path d="M16 11l2 2 4-4" />
      </>
    ),
    sync: (
      <>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v5h-5" />
      </>
    ),
    site: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14L21 3" />
      </>
    ),
    signout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
      className="shrink-0 opacity-80"
    >
      {paths[name]}
    </svg>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminSidebar({ userName: _userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const { t, locale } = useAdminLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Se stai gestendo una CAMERA (?unit=<camera>) mostra il suo nome; altrimenti il
  // nome della struttura. Così l'header dice sempre "dove" sei.
  const searchParams = useSearchParams();
  const unitParam = searchParams.get("unit") ?? undefined;
  const activeUnit = unitParam ? getUnit(unitParam) : undefined;
  const isRoom = !!activeUnit && !!activeUnit.slug;
  const headerName = isRoom
    ? activeUnit!.name[locale] || activeUnit!.name.it || activeUnit!.id
    : CONTENT.siteTitle[locale] || CONTENT.siteTitle.it || t.nav.title;

  // "Camere" compare solo per le strutture con camere (unità di tipo "room").
  const isRoomsStructure = allUnits().some((u) => u.kind === "room");

  const groups: NavGroup[] = [
    {
      header: t.nav.groupManage,
      items: [
        { href: "/admin/dashboard", label: t.nav.dashboard, icon: "dashboard" },
        { href: "/admin", label: t.nav.calendar, icon: "calendar" },
        { href: "/admin/bookings", label: t.nav.bookings, icon: "bookings" },
        { href: "/admin/recensioni", label: t.nav.reviews, icon: "reviews" },
      ],
    },
    {
      header: t.nav.groupSite,
      items: [
        { href: "/admin/contenuti", label: t.nav.contents, icon: "contents" },
        { href: "/admin/immagini", label: t.nav.images, icon: "images" },
        ...(isRoomsStructure ? [{ href: "/admin/camere", label: t.nav.rooms, icon: "rooms" }] : []),
        { href: "/admin/tema", label: t.nav.theme, icon: "colors" },
        { href: "/admin/traduzioni", label: t.nav.translations, icon: "translations" },
      ],
    },
    {
      header: t.nav.groupSettings,
      items: [
        { href: "/admin/policy", label: t.nav.rules, icon: "rules" },
        { href: "/admin/stripe", label: t.nav.payments, icon: "payments" },
        { href: "/admin/accessi", label: t.nav.access, icon: "access" },
        { href: "/admin/impostazioni", label: t.nav.sync, icon: "sync" },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const itemCls = (href: string) =>
    `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
      isActive(href)
        ? "bg-gold/10 font-medium text-gold"
        : "text-foreground/70 hover:bg-gold/5 hover:text-gold"
    }`;

  const brand = (
    <div className="border-b border-gold/20 px-2.5 pb-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-gold">{t.nav.title}</div>
      <div className="mt-1 font-serif-display text-lg italic leading-tight text-foreground">{headerName}</div>
    </div>
  );

  const nav = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.header}>
          <div className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/40">
            {g.header}
          </div>
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={onNavigate} className={itemCls(it.href)}>
                <NavIcon name={it.icon} />
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const footer = (onNavigate?: () => void) => (
    <div className="mt-auto flex flex-col gap-1 border-t border-gold/20 pt-4">
      <StructureSwitcher />
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground/70 transition hover:bg-gold/5 hover:text-gold"
      >
        <NavIcon name="site" />
        <span>{t.nav.publicSite}</span>
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: "/admin" })}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground/70 transition hover:bg-gold/5 hover:text-gold"
      >
        <NavIcon name="signout" />
        <span>{t.nav.signOut}</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar fissa a sinistra */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gold/30 bg-card px-4 py-6 lg:flex">
        {brand}
        <div className="mt-5 flex flex-1 flex-col">
          {nav()}
          {footer()}
        </div>
      </aside>

      {/* Mobile: barra in alto + drawer a scomparsa */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-gold/30 bg-card/95 px-6 py-3 backdrop-blur-sm">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="rounded-full border border-gold/40 px-3 py-1.5 text-gold"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
          <span className="whitespace-nowrap font-serif-display text-sm italic text-foreground">{headerName}</span>
          <span className="w-9" aria-hidden />
        </div>
        {mobileOpen && (
          <div className="flex flex-col border-b border-gold/30 bg-card px-6 py-5">
            {nav(() => setMobileOpen(false))}
            {footer(() => setMobileOpen(false))}
          </div>
        )}
      </div>
    </>
  );
}
