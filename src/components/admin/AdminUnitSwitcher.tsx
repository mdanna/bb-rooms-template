"use client";

import Link from "next/link";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { allUnits, bookableUnits, rootUnitId } from "@/lib/structure";
import { CONTENT } from "@/lib/siteContent";

// Selettore di unità nell'admin: schede appartamento intero + camere. Governa quale
// calendario/prezzi/impostazioni si stanno modificando, via ?unit=<id>. Con una sola
// unità (sito a unità singola) non mostra nulla. `basePath` è la pagina admin corrente
// (es. "/admin" o "/admin/impostazioni") così lo switcher resta nella stessa sezione.
// `bookableOnly` limita alle unità affittabili: nei tab di PRENOTAZIONE (calendario,
// prezzi, OTA) l'appartamento non prenotabile ("solo camere") non deve comparire.
export default function AdminUnitSwitcher({
  activeUnitId,
  basePath = "/admin",
  bookableOnly = false,
}: {
  activeUnitId: string;
  basePath?: string;
  bookableOnly?: boolean;
}) {
  const { locale } = useAdminLanguage();
  const units = bookableOnly ? bookableUnits() : allUnits();
  if (units.length <= 1) return null;

  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-gold/20 pb-4">
      {units.map((u) => {
        // Unità intera: mostra il titolo dell'appartamento (siteTitle), non "Intero
        // appartamento". Le camere usano il proprio nome.
        const name = (u.id === rootUnitId()
          ? CONTENT.siteTitle[locale] || CONTENT.siteTitle.it
          : u.name[locale] || u.name.it) || u.id;
        const isActive = u.id === activeUnitId;
        return (
          <Link
            key={u.id}
            href={`${basePath}?unit=${encodeURIComponent(u.id)}`}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition ${
              isActive
                ? "border-gold bg-gold text-[#faf6ec]"
                : "border-gold/40 text-foreground/70 hover:border-gold hover:text-foreground"
            }`}
          >
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
