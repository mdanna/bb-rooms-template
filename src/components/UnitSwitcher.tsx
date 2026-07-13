"use client";

import Link from "next/link";
import { pickL10n } from "@/lib/l10n";
import { useLanguage } from "@/i18n/LanguageContext";
import { bookableUnits, rootUnitId, type Unit } from "@/lib/structure";

// Selettore di unità: mostra l'appartamento intero e le camere, e permette di passare
// dall'uno all'altro. Appare sulla home (flusso dell'intero) e sulle pagine camera.
// Se c'è una sola unità affittabile (sito a unità singola) non mostra nulla.

function unitHref(u: Unit): string {
  // Ogni bottone porta alla HOME dell'unità: l'appartamento intero → "/" (la home
  // principale, che ha il suo pulsante Prenota); le camere → "/camera/<slug>".
  return u.slug ? `/camera/${u.slug}` : "/";
}

export default function UnitSwitcher({ activeUnitId }: { activeUnitId?: string }) {
  const { locale } = useLanguage();
  const units = bookableUnits();
  if (units.length <= 1) return null;

  const active = activeUnitId ?? rootUnitId();

  return (
    <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-6">
      {units.map((u) => {
        const name = pickL10n(u.name, locale) || u.id;
        const isActive = u.id === active;
        return (
          <Link
            key={u.id}
            href={unitHref(u)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-5 py-2 text-sm uppercase tracking-widest transition ${
              isActive
                ? "border-gold bg-gold text-[#faf6ec]"
                : "border-gold/40 text-foreground hover:border-gold"
            }`}
          >
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
