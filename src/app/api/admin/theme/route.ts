import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { THEME, THEME_KEYS, isHex, type Theme } from "@/lib/theme";

const FILE_PATH = "src/data/theme.json";

function isValidTheme(body: unknown): body is Theme {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return THEME_KEYS.every((k) => isHex(b[k]));
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(THEME);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidTheme(body)) {
    return NextResponse.json({ error: "Colori non validi (formato esadecimale richiesto)" }, { status: 400 });
  }
  // Salva solo i 4 campi validi, normalizzati.
  const clean: Theme = {
    background: body.background.trim(),
    foreground: body.foreground.trim(),
    gold: body.gold.trim(),
    card: body.card.trim(),
  };

  try {
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(FILE_PATH, token));
    } catch {
      sha = "";
    }
    const content = JSON.stringify(clean, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update site theme colors", token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
