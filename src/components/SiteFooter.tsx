"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT, HOST_WHATSAPP } from "@/lib/siteContent";
import { PORTAL_LINK } from "@/lib/portalLink";
import { waLink } from "@/lib/whatsapp";
import type { LocaleCode } from "@/i18n/index";

// CTA e testo precompilato del pulsante WhatsApp pubblico (verso la struttura).
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
  const portalLabel = PORTAL_LABEL[locale] ?? PORTAL_LABEL.it;

  return (
    <footer className="border-t border-gold/30 px-6 py-8 text-center text-xs text-foreground/50">
      {PORTAL_URL && (
        <div className="mb-5">
          <a
            href={PORTAL_URL}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-gold transition hover:opacity-70"
          >
            {PORTAL_NAME || portalLabel} →
          </a>
        </div>
      )}
      {waLink(HOST_WHATSAPP) && (
        <div className="mb-5">
          <a
            href={waLink(HOST_WHATSAPP, `${WA_HELLO[locale] ?? WA_HELLO.it} ${siteName}.`)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/60 px-4 py-1.5 text-xs uppercase tracking-widest text-[#128C7E] transition hover:bg-[#25D366]/10"
          >
            <span aria-hidden>✆</span> {WA_CTA[locale] ?? WA_CTA.it}
          </a>
        </div>
      )}
© {new Date().getFullYear()} {siteName} · {CONTENT.city}
      <br />{CONTENT.phone} · {CONTENT.email}
      <br />CIN: {CONTENT.cin}
      <br />
      <a href="/privacy" className="underline hover:text-gold">
        Informativa sulla privacy
      </a>
      <div className="mt-3">
        <Link
          href="/admin"
          className="text-xs uppercase tracking-widest transition hover:text-gold"
        >
          {t.footer.admin}
        </Link>
      </div>
      <div className="mt-4 text-foreground/40">
        Powered by{" "}
        <a
          href="https://dimorasuite.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gold"
        >
          Dimora Suite
        </a>
      </div>
    </footer>
  );
}
