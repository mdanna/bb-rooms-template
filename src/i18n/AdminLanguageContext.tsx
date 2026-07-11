"use client";

import { createContext, useContext } from "react";
import { adminTranslations, type AdminLocaleCode, type AdminTranslation } from "./admin";

interface AdminLanguageContextValue {
  locale: AdminLocaleCode;
  t: AdminTranslation;
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

/**
 * La lingua del pannello admin è una scelta di configurazione per-sito
 * (`policies.adminLocale`, default "it"), passata dal layout server. Non c'è più
 * un toggle: si cambia da Impostazioni. Così la lingua è coerente su ogni
 * browser e non si può finire per sbaglio in una lingua che non si legge.
 */
export function AdminLanguageProvider({
  locale,
  children,
}: {
  locale: AdminLocaleCode;
  children: React.ReactNode;
}) {
  return (
    <AdminLanguageContext.Provider value={{ locale, t: adminTranslations[locale] }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) throw new Error("useAdminLanguage must be used within AdminLanguageProvider");
  return ctx;
}
