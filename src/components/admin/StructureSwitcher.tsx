"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

interface PortalProperty {
  id: string;
  name: string;
  city: string;
  url: string;
}

// URL del portale hub a cui questa struttura appartiene. Se non è impostato, la
// struttura non fa parte di alcun portale e lo switcher NON viene mostrato
// (retro-compatibile: le strutture "singole" restano identiche a prima).
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function sameHost(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

/**
 * Menu «Le tue strutture ▾» nella nav admin: elenca le strutture pubblicate sul
 * portale e permette di saltare al pannello di ognuna. Un solo login (allowlist
 * condivisa) apre tutti i pannelli. È puramente informativo: legge l'endpoint
 * pubblico del portale, nessun segreto in gioco.
 */
export default function StructureSwitcher() {
  const { t } = useAdminLanguage();
  const [items, setItems] = useState<PortalProperty[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!PORTAL_URL) return;
    let alive = true;
    fetch(`${PORTAL_URL.replace(/\/$/, "")}/api/properties`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.properties) setItems(data.properties as PortalProperty[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Chiudi cliccando fuori.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Niente portale, o portale con una sola struttura → nessuno switcher.
  if (!PORTAL_URL || items.length < 2) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs uppercase tracking-widest text-foreground/70 transition hover:text-gold"
      >
        {t.nav.structures}
        <span aria-hidden className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-gold/30 bg-background shadow-lg">
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((p) => {
              const current = sameHost(p.url, SITE_URL);
              return (
                <li key={p.id}>
                  {/* La struttura corrente non è un link: è evidenziata come "sei qui". */}
                  {current ? (
                    <span className="flex flex-col gap-0.5 border-l-2 border-gold bg-gold/5 px-4 py-2.5">
                      <span className="text-sm text-foreground">{p.name}</span>
                      {p.city && <span className="text-[0.7rem] text-foreground/50">{p.city}</span>}
                    </span>
                  ) : (
                    <a
                      href={`${p.url.replace(/\/$/, "")}/admin`}
                      className="flex flex-col gap-0.5 border-l-2 border-transparent px-4 py-2.5 transition hover:border-gold/50 hover:bg-gold/5"
                    >
                      <span className="text-sm text-foreground">{p.name}</span>
                      {p.city && <span className="text-[0.7rem] text-foreground/50">{p.city}</span>}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
