import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import type { LocaleCode } from "@/i18n/index";
import { DEMO_MODE } from "@/lib/demo";

// Messaggio mostrato quando si tenta di tradurre nella demo pubblica: il pulsante
// resta visibile (vetrina) ma non chiama l'API Anthropic (niente costi/abusi).
const DEMO_TRANSLATE_MSG: Partial<Record<LocaleCode, string>> = {
  it: "Traduzione disponibile nella versione completa (non attiva nella demo).",
  en: "Translation available in the full version (not active in the demo).",
  es: "Traducción disponible en la versión completa (no activa en la demo).",
  fr: "Traduction disponible dans la version complète (non active dans la démo).",
};

const LOCALE_NAMES: Record<LocaleCode, string> = {
  it: "Italian", en: "English", fr: "French", de: "German",
  es: "Spanish", pt: "Portuguese", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean",
};

const ALL_LOCALES: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

// Body: { texts: Record<string, string>, sourceLang?: LocaleCode }
// Returns: { translations: Record<string, Record<LocaleCode, string>> }
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { texts?: Record<string, string>; sourceLang?: string } | null;
  if (!body?.texts || typeof body.texts !== "object") {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const sourceLang: LocaleCode = (body.sourceLang && ALL_LOCALES.includes(body.sourceLang as LocaleCode))
    ? body.sourceLang as LocaleCode
    : "it";
  const TARGET_LOCALES = ALL_LOCALES.filter((l) => l !== sourceLang);

  // In demo il pulsante è visibile ma non traduce: torna un messaggio (localizzato sulla
  // lingua in modifica) che i handler mostrano nel loro slot. Blocca anche l'abuso diretto
  // dell'API in una demo pubblica.
  if (DEMO_MODE) {
    return NextResponse.json({ error: DEMO_TRANSLATE_MSG[sourceLang] ?? DEMO_TRANSLATE_MSG.it }, { status: 200 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata" }, { status: 503 });

  const client = new Anthropic({ apiKey });

  // Drop fields with empty source text — nothing to translate, keeps Haiku from returning empty strings
  const nonEmptyTexts = Object.fromEntries(Object.entries(body.texts).filter(([, v]) => v.trim()));
  const fieldKeys = Object.keys(nonEmptyTexts);
  if (fieldKeys.length === 0) return NextResponse.json({ translations: {} });

  const fieldsList = Object.entries(nonEmptyTexts)
    .map(([key, val]) => `- ${key}: ${JSON.stringify(val)}`)
    .join("\n");

  // Schema PIATTO: una proprietà stringa top-level per ogni coppia campo×lingua,
  // nella forma `${campo}__${locale}`. Lo schema annidato (oggetto-di-oggetti)
  // fa sì che Haiku, in modo non-deterministico (~50% dei casi), "spanda" una
  // stringa in un oggetto a chiavi numeriche invece di riempire le lingue,
  // lasciando il campo non tradotto. Con proprietà stringa piatte il problema
  // sparisce (testato: 0 fallimenti su batch completi ripetuti).
  const SEP = "__";
  const flatProps: Record<string, { type: "string" }> = {};
  const flatRequired: string[] = [];
  for (const key of fieldKeys) {
    for (const l of TARGET_LOCALES) {
      const flatKey = `${key}${SEP}${l}`;
      flatProps[flatKey] = { type: "string" };
      flatRequired.push(flatKey);
    }
  }

  const sourceLangName = LOCALE_NAMES[sourceLang];
  const prompt = `You are a professional translator for a B&B accommodation website in Rome, Italy.
Translate the following ${sourceLangName} text fields into: ${TARGET_LOCALES.map(l => LOCALE_NAMES[l]).join(", ")}.

${sourceLangName} source texts:
${fieldsList}

For each source field there is one property per target language, named "<field>${SEP}<lang>" (e.g. storyP0${SEP}en). Fill each one with the translation of that field into that language.

Rules:
- Keep proper nouns (place names, landmarks, and personal names) in their conventional translated form
- Maintain the warm, elegant tone of a boutique B&B
- Do not add or remove sentences`;

  try {
    const message = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      tools: [
        {
          name: "save_translations",
          description: "Save the translation of each field into each language as a plain string",
          input_schema: {
            type: "object" as const,
            properties: flatProps,
            required: flatRequired,
          },
        },
      ],
      tool_choice: { type: "tool", name: "save_translations" },
      messages: [{ role: "user", content: prompt }],
    }).finalMessage();

    if (message.stop_reason === "max_tokens") {
      throw new Error("Testi troppo lunghi per una singola traduzione: riprova con meno contenuti");
    }
    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Risposta non valida dall'API");
    }
    // Ricostruisci la struttura annidata { campo: { locale: testo } } dalle chiavi piatte
    const flat = toolUse.input as Record<string, unknown>;
    const translations: Record<string, Record<string, string>> = {};
    for (const key of fieldKeys) {
      for (const l of TARGET_LOCALES) {
        const v = flat[`${key}${SEP}${l}`];
        if (typeof v === "string" && v.trim()) {
          (translations[key] ??= {})[l] = v;
        }
      }
    }
    return NextResponse.json({ translations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore traduzione" },
      { status: 502 }
    );
  }
}
