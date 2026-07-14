import Anthropic from "@anthropic-ai/sdk";
import type { LocaleCode } from "@/i18n/index";

// Motore di traduzione condiviso (Claude Haiku). Usato sia da /api/admin/translate
// (contenuti del sito) sia dalla traduzione automatica delle recensioni.

export const LOCALE_NAMES: Record<LocaleCode, string> = {
  it: "Italian", en: "English", fr: "French", de: "German",
  es: "Spanish", pt: "Portuguese", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean",
};

export const ALL_LOCALES: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

const MODEL = "claude-haiku-4-5-20251001";
const SEP = "__";

/**
 * Traduce un set di campi da `sourceLang` in tutte le altre lingue supportate.
 * Schema PIATTO `<campo>__<lingua>` (l'annidato fa "spandere" Haiku in modo non
 * deterministico). Ritorna { campo: { lingua: testo } } per le sole lingue diverse
 * dalla sorgente. Lancia in caso di errore API.
 */
export async function translateFields(
  texts: Record<string, string>,
  sourceLang: LocaleCode,
  apiKey: string,
): Promise<Record<string, Record<string, string>>> {
  const nonEmpty = Object.fromEntries(Object.entries(texts).filter(([, v]) => v.trim()));
  const fieldKeys = Object.keys(nonEmpty);
  if (fieldKeys.length === 0) return {};

  const targets = ALL_LOCALES.filter((l) => l !== sourceLang);
  const flatProps: Record<string, { type: "string" }> = {};
  const flatRequired: string[] = [];
  for (const key of fieldKeys) {
    for (const l of targets) {
      flatProps[`${key}${SEP}${l}`] = { type: "string" };
      flatRequired.push(`${key}${SEP}${l}`);
    }
  }

  const fieldsList = Object.entries(nonEmpty)
    .map(([key, val]) => `- ${key}: ${JSON.stringify(val)}`)
    .join("\n");
  const prompt = `You are a professional translator for a B&B accommodation website.
Translate the following ${LOCALE_NAMES[sourceLang]} text fields into: ${targets.map((l) => LOCALE_NAMES[l]).join(", ")}.

${LOCALE_NAMES[sourceLang]} source texts:
${fieldsList}

For each source field there is one property per target language, named "<field>${SEP}<lang>" (e.g. storyP0${SEP}en). Fill each one with the translation of that field into that language.

Rules:
- Keep proper nouns (place names, landmarks, and personal names) in their conventional translated form
- Maintain a warm, natural tone
- Do not add or remove sentences`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      tools: [
        {
          name: "save_translations",
          description: "Save the translation of each field into each language as a plain string",
          input_schema: { type: "object" as const, properties: flatProps, required: flatRequired },
        },
      ],
      tool_choice: { type: "tool", name: "save_translations" },
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();

  if (message.stop_reason === "max_tokens") {
    throw new Error("Testi troppo lunghi per una singola traduzione: riprova con meno contenuti");
  }
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Risposta non valida dall'API");

  const flat = toolUse.input as Record<string, unknown>;
  const out: Record<string, Record<string, string>> = {};
  for (const key of fieldKeys) {
    for (const l of targets) {
      const v = flat[`${key}${SEP}${l}`];
      if (typeof v === "string" && v.trim()) (out[key] ??= {})[l] = v;
    }
  }
  return out;
}

export interface ReviewTranslation {
  /** Lingua rilevata del testo originale. */
  sourceLang: LocaleCode;
  /** Testo in tutte le 9 lingue (la sorgente resta il testo ORIGINALE). */
  translations: Record<string, string>;
}

/**
 * Rileva la lingua di una recensione e la traduce in TUTTE le 9 lingue supportate,
 * in un'unica chiamata. La voce della lingua sorgente resta il testo ORIGINALE
 * (autenticità), le altre 8 sono tradotte. Lancia in caso di errore API.
 */
export async function translateReviewBody(body: string, apiKey: string): Promise<ReviewTranslation> {
  const text = body.trim();
  if (!text) throw new Error("Testo recensione vuoto");

  const props: Record<string, { type: "string" }> = {};
  const required: string[] = ["detectedLang"];
  for (const l of ALL_LOCALES) {
    props[`text${SEP}${l}`] = { type: "string" };
    required.push(`text${SEP}${l}`);
  }
  const inputSchema = {
    type: "object" as const,
    properties: {
      detectedLang: { type: "string" as const, enum: ALL_LOCALES },
      ...props,
    },
    required,
  };

  const prompt = `You are a professional translator for a B&B accommodation website.
Below is a guest review written in one of these languages: ${ALL_LOCALES.map((l) => `${l} (${LOCALE_NAMES[l]})`).join(", ")}.

Guest review:
${JSON.stringify(text)}

Do two things:
1. In "detectedLang", put the ISO code of the language the review is written in.
2. Provide the review text in every supported language, in the property "text${SEP}<lang>" (e.g. text${SEP}en). For the detected source language, return the ORIGINAL text unchanged; for the others, translate it.

Rules:
- Preserve meaning and the guest's tone; do not add or remove content
- Keep proper nouns in their conventional form
- If the review mixes languages, pick the predominant one as detectedLang`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 8000,
      tools: [
        {
          name: "save_review_translations",
          description: "Save the detected language and the review text in every supported language",
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "save_review_translations" },
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();

  if (message.stop_reason === "max_tokens") throw new Error("Recensione troppo lunga per la traduzione");
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Risposta non valida dall'API");

  const flat = toolUse.input as Record<string, unknown>;
  const detected = flat.detectedLang;
  const sourceLang: LocaleCode = ALL_LOCALES.includes(detected as LocaleCode)
    ? (detected as LocaleCode)
    : "it";

  const translations: Record<string, string> = {};
  for (const l of ALL_LOCALES) {
    const v = flat[`text${SEP}${l}`];
    if (typeof v === "string" && v.trim()) translations[l] = v.trim();
  }
  // Autenticità: la lingua sorgente conserva il testo ORIGINALE, non la resa del modello.
  translations[sourceLang] = text;

  return { sourceLang, translations };
}
