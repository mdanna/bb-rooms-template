import type { LocaleCode } from "@/i18n/index";
import { parseDateOnly } from "./dateOnly";

const INTL_LOCALE: Record<LocaleCode, string> = {
  it: "it-IT",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  pt: "pt-PT",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

export function formatFriendlyDate(value: string | Date, locale: LocaleCode): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function toIntlLocale(locale: LocaleCode): string {
  return INTL_LOCALE[locale] ?? "it-IT";
}

// Per le date "civili" (check-in/check-out): evita lo slittamento di un giorno che si
// otterrebbe interpretando "2026-10-01" come istante UTC e formattandolo in un fuso orario
// con offset negativo (es. USA).
export function formatFriendlyDateOnly(value: string, locale: LocaleCode): string {
  return formatFriendlyDate(parseDateOnly(value), locale);
}
