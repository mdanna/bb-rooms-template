import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { LocaleCode } from "@/i18n/index";
import { DEMO_MODE } from "@/lib/demo";
import { ALL_LOCALES, translateFields } from "@/lib/translate";
import { getEffectiveAnthropicKey } from "@/lib/siteSecrets";

// Messaggio mostrato quando si tenta di tradurre nella demo pubblica: il pulsante
// resta visibile (vetrina) ma non chiama l'API Anthropic (niente costi/abusi).
const DEMO_TRANSLATE_MSG: Partial<Record<LocaleCode, string>> = {
  it: "Traduzione disponibile nella versione completa (non attiva nella demo).",
  en: "Translation available in the full version (not active in the demo).",
  es: "Traducción disponible en la versión completa (no activa en la demo).",
  fr: "Traduction disponible dans la version complète (non active dans la démo).",
};

// Body: { texts: Record<string, string>, sourceLang?: LocaleCode }
// Returns: { translations: Record<string, Record<LocaleCode, string>> }
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { texts?: Record<string, string>; sourceLang?: string }
    | null;
  if (!body?.texts || typeof body.texts !== "object") {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const sourceLang: LocaleCode =
    body.sourceLang && ALL_LOCALES.includes(body.sourceLang as LocaleCode)
      ? (body.sourceLang as LocaleCode)
      : "it";

  if (DEMO_MODE) {
    return NextResponse.json({ error: DEMO_TRANSLATE_MSG[sourceLang] ?? DEMO_TRANSLATE_MSG.it }, { status: 200 });
  }

  const apiKey = await getEffectiveAnthropicKey();
  if (!apiKey) return NextResponse.json({ error: "Chiave Anthropic non configurata" }, { status: 503 });

  try {
    const translations = await translateFields(body.texts, sourceLang, apiKey);
    return NextResponse.json({ translations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore traduzione" },
      { status: 502 },
    );
  }
}
