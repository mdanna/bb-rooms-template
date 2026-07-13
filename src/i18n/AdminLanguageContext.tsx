"use client";

import { createContext, useContext, useState } from "react";
import { adminTranslations, type AdminLocaleCode, type AdminTranslation } from "./admin";
import { ADMIN_LOCALE_COOKIE } from "@/lib/policies";

const ADMIN_LOCALES: AdminLocaleCode[] = ["it", "en", "es", "fr"];

interface AdminLanguageContextValue {
  locale: AdminLocaleCode;
  t: AdminTranslation;
  setLocale: (l: AdminLocaleCode) => void;
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

/**
 * La lingua del pannello admin. Il valore INIZIALE arriva dal layout server (cookie di
 * preferenza se presente, altrimenti `policies.adminLocale`, default "it"). Cambiandola da
 * Impostazioni, `setLocale` aggiorna SUBITO tutti i tab (stato React, via context) e scrive
 * un cookie: così la scelta ha effetto immediato su ogni sezione e persiste ai reload
 * SENZA aspettare il redeploy. `policies.adminLocale` resta il default del sito (per un
 * browser senza cookie), aggiornato in background al salvataggio.
 */
export function AdminLanguageProvider({
  locale: initial,
  children,
}: {
  locale: AdminLocaleCode;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AdminLocaleCode>(initial);

  function setLocale(l: AdminLocaleCode) {
    if (!ADMIN_LOCALES.includes(l)) return;
    setLocaleState(l);
    try {
      document.cookie = `${ADMIN_LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      /* cookie non disponibile: resta comunque l'effetto in sessione */
    }
  }

  return (
    <AdminLanguageContext.Provider value={{ locale, t: adminTranslations[locale], setLocale }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) throw new Error("useAdminLanguage must be used within AdminLanguageProvider");
  return ctx;
}
