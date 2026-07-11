import type { LocaleCode, Translation } from "./types";
import it from "./locales/it";
import en from "./locales/en";
import fr from "./locales/fr";
import de from "./locales/de";
import es from "./locales/es";
import pt from "./locales/pt";
import zh from "./locales/zh";
import ja from "./locales/ja";
import ko from "./locales/ko";

export const translations: Record<LocaleCode, Translation> = {
  it,
  en,
  fr,
  de,
  es,
  pt,
  zh,
  ja,
  ko,
};

export const localeOrder: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

export type { LocaleCode, Translation } from "./types";
