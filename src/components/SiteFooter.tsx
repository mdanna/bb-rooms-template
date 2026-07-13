"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT, HOST_WHATSAPP } from "@/lib/siteContent";
import { PORTAL_LINK } from "@/lib/portalLink";
import { waLink } from "@/lib/whatsapp";
import type { LocaleCode } from "@/i18n/index";

// Etichetta (aria-label/tooltip) e testo precompilato del contatto WhatsApp pubblico
// (verso la struttura). Il pulsante è solo icona → l'etichetta resta accessibile.
const WA_CTA: Partial<Record<LocaleCode, string>> = {
  it: "Contattaci su WhatsApp", en: "Contact us on WhatsApp", fr: "Contactez-nous sur WhatsApp",
  es: "Contáctanos por WhatsApp", de: "Über WhatsApp kontaktieren", pt: "Fale connosco no WhatsApp",
  zh: "通过 WhatsApp 联系我们", ja: "WhatsAppでお問い合わせ", ko: "WhatsApp으로 문의하기",
};
const WA_HELLO: Partial<Record<LocaleCode, string>> = {
  it: "Ciao, vorrei informazioni su", en: "Hi, I'd like information about", fr: "Bonjour, je voudrais des informations sur",
  es: "Hola, quisiera información sobre", de: "Hallo, ich hätte gerne Informationen über", pt: "Olá, gostaria de informações sobre",
  zh: "你好，我想了解", ja: "こんにちは、次の物件について知りたいです：", ko: "안녕하세요, 다음 숙소에 대해 문의드립니다:",
};

// Se questa struttura fa parte di un portale multi-struttura, mostriamo un link che
// rimanda alla home del portale ("scopri tutte le nostre dimore"). L'appartenenza è
// in src/data/portal-link.json (scritto dall'handshake, di proprietà del sito), con
// fallback all'env. Assente = struttura singola → nessun link (retro-compatibile).
const PORTAL_URL = PORTAL_LINK.url;
const PORTAL_NAME = PORTAL_LINK.name;

const PORTAL_LABEL: Record<LocaleCode, string> = {
  it: "Scopri tutte le nostre dimore",
  en: "Discover all our properties",
  fr: "Découvrez tous nos hébergements",
  de: "Alle unsere Unterkünfte entdecken",
  es: "Descubre todos nuestros alojamientos",
  pt: "Descubra todos os nossos alojamentos",
  zh: "探索我们所有的住宿",
  ja: "すべての宿泊施設を見る",
  ko: "우리의 모든 숙소 보기",
};

export default function SiteFooter() {
  const { t, locale } = useLanguage();
  // `||` non `??`: una lingua non tradotta ha "" (dopo la pulizia segnaposto) → fallback alla principale.
  const siteName = CONTENT.siteTitle[locale] || CONTENT.siteTitle.it;
  const portalLabel = PORTAL_NAME || PORTAL_LABEL[locale] || PORTAL_LABEL.it;
  const waCta = WA_CTA[locale] ?? WA_CTA.it;
  const year = new Date().getFullYear();
  const hasWa = !!waLink(HOST_WHATSAPP);

  return (
    <footer className="border-t border-gold/30 px-6 py-10 text-xs text-foreground/60">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          {/* Sinistra: struttura + link di navigazione */}
          <div className="sm:max-w-[58%]">
            <div className="font-serif-display text-base italic text-foreground">{siteName}</div>
            <div className="mt-1 text-foreground/50">{CONTENT.city}</div>
            <div className="mt-4 flex flex-col items-center gap-2 sm:items-start">
              {PORTAL_URL && (
                <a
                  href={PORTAL_URL}
                  className="uppercase tracking-widest text-gold transition hover:opacity-70"
                >
                  {portalLabel} →
                </a>
              )}
              <a
                href="/privacy"
                className="underline decoration-gold/40 underline-offset-2 transition hover:text-gold"
              >
                {t.footer.privacy}
              </a>
            </div>
          </div>

          {/* Destra: contatti — WhatsApp accanto al telefono */}
          <div className="sm:text-right">
            <p className="text-[11px] uppercase tracking-widest text-foreground/40">{t.footer.contacts}</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-center gap-2.5 sm:justify-end">
                <a href={`tel:${CONTENT.phone.replace(/\s+/g, "")}`} className="transition hover:text-gold">
                  {CONTENT.phone}
                </a>
                {hasWa && (
                  <a
                    href={waLink(HOST_WHATSAPP, `${WA_HELLO[locale] ?? WA_HELLO.it} ${siteName}.`)}
                    target="_blank"
                    rel="noopener"
                    aria-label={waCta}
                    title={waCta}
                    className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-gold/40 text-[#25D366] transition hover:bg-foreground/5"
                  >
                    <svg viewBox="0 0 448 512" fill="currentColor" width="18" height="18" aria-hidden="true">
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 438.7c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                    </svg>
                  </a>
                )}
              </div>
              <div>
                <a href={`mailto:${CONTENT.email}`} className="transition hover:text-gold">
                  {CONTENT.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Barra in fondo: copyright + CIN a sinistra, Powered + Gestione (⚙) a destra */}
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-gold/20 pt-4 text-foreground/40 sm:flex-row sm:justify-between">
          <span>
            © {year} {siteName} · CIN: {CONTENT.cin}
          </span>
          <span className="inline-flex items-center gap-2">
            Powered by{" "}
            <a
              href="https://dimorasuite.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition hover:text-gold"
            >
              Dimora Suite
            </a>
            <Link href="/admin" aria-label={t.footer.admin} title={t.footer.admin} className="transition hover:text-gold">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
