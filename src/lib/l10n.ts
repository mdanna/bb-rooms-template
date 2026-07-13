import type { LocaleCode } from "@/i18n/index";
import { resolveAdminLocale } from "./policies";

// Lingua primaria del sito = lingua di lavoro dell'operatore (`policies.adminLocale`,
// scelta in Impostazioni → "lingua del pannello", persistita lì). È la SORGENTE delle
// traduzioni nell'admin e il FALLBACK del sito pubblico: se un contenuto manca nella
// lingua del visitatore, si mostra questa (poi l'italiano come ultima rete di sicurezza).
export const PRIMARY_LANG: LocaleCode = resolveAdminLocale();

// Risolve un campo localizzato per il visitatore:
//   lingua richiesta → lingua primaria → italiano → prima non vuota.
// Usa `||` (non `??`) perché una lingua non compilata vale "" e deve fare fallback.
export function pickL10n(
  field: Partial<Record<string, string>> | null | undefined,
  locale: LocaleCode,
): string {
  if (!field) return "";
  return field[locale] || field[PRIMARY_LANG] || field.it || Object.values(field).find(Boolean) || "";
}
