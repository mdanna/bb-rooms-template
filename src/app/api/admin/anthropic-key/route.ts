import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEMO_MODE, demoWriteBlocked } from "@/lib/demo";
import {
  ANTHROPIC_SECRET,
  hasSiteSecret,
  setSiteSecret,
  deleteSiteSecret,
} from "@/lib/siteSecrets";

// Chiave Anthropic PER-SITO (opzionale). Se impostata dal proprietario è usata per le
// traduzioni al posto della chiave operatore di default. Salvata CIFRATA nel DB (mai su
// git, mai ritornata al client): la GET dice solo se c'è o no.

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (DEMO_MODE) return NextResponse.json({ set: false, demo: true });
  try {
    return NextResponse.json({ set: await hasSiteSecret(ANTHROPIC_SECRET) });
  } catch {
    return NextResponse.json({ set: false });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (DEMO_MODE) return demoWriteBlocked({ set: true });

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ error: "Chiave mancante" }, { status: 400 });
  // Le chiavi Anthropic iniziano con "sk-ant-": guardia contro incolla errati.
  if (!key.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Chiave Anthropic non valida (deve iniziare con sk-ant-)." }, { status: 400 });
  }
  try {
    await setSiteSecret(ANTHROPIC_SECRET, key);
    return NextResponse.json({ ok: true, set: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (DEMO_MODE) return demoWriteBlocked({ set: false });
  try {
    await deleteSiteSecret(ANTHROPIC_SECRET);
    return NextResponse.json({ ok: true, set: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rimozione fallita" },
      { status: 502 },
    );
  }
}
