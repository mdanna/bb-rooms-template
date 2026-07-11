"use client";

import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

// Footer del pannello admin. Ospita il link al Manuale (spostato qui dalla nav):
// il manuale è centralizzato su dimorasuite.com (IT + EN), si apre nella lingua
// del pannello con EN come fallback per es/fr.
export default function AdminFooter() {
  const { t, locale } = useAdminLanguage();
  const manualUrl =
    locale === "it"
      ? "https://dimorasuite.com/manuale.html"
      : "https://dimorasuite.com/manuale-en.html";

  return (
    <footer className="border-t border-gold/30 bg-background/90 px-6 py-6">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-foreground/50 sm:flex-row">
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener"
          className="uppercase tracking-widest transition hover:text-gold"
        >
          {t.nav.manual}
        </a>
        <span>Powered by Dimora Suite</span>
      </div>
    </footer>
  );
}
