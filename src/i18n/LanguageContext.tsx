"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations, localeOrder, type LocaleCode, type Translation } from "./index";

interface LanguageContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "bb-locale";

function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === "undefined") return "it";
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return (localeOrder as string[]).includes(nav) ? (nav as LocaleCode) : "it";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("it");

  useEffect(() => {
    // Lettura una tantum di localStorage al mount (non disponibile durante l'SSR): non è il
    // pattern "sincronizza con sistema esterno" che la regola si aspetta, ma è il modo
    // corretto per evitare un mismatch di idratazione qui.
    const stored = window.localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(stored && translations[stored] ? stored : detectBrowserLocale());
  }, []);

  function setLocale(next: LocaleCode) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
