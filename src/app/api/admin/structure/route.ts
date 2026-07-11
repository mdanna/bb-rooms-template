import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { STRUCTURE, normalizeStructure, rootUnits, allUnits } from "@/lib/structure";

const FILE_PATH = "src/data/structure.json";

// Legge/aggiorna il TIPO di struttura: se l'unità radice (l'appartamento intero) è
// prenotabile (`bookable`). false = "solo camere" (l'appartamento è un contenitore:
// niente calendario/prezzi/prenotazione propri, la home elenca le camere).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const s = normalizeStructure(JSON.parse(content));
    const root = rootUnits(s)[0];
    return NextResponse.json({
      rootBookable: root ? root.bookable !== false : true,
      hasRooms: s.units.length > 1,
    });
  } catch {
    const root = rootUnits(STRUCTURE)[0];
    return NextResponse.json({
      rootBookable: root ? root.bookable !== false : true,
      hasRooms: allUnits().length > 1,
    });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { rootBookable?: unknown } | null;
  if (!body || typeof body.rootBookable !== "boolean") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    const { content, sha } = await getFile(FILE_PATH, token);
    const raw = JSON.parse(content) as { units?: Array<{ id: string; bookable?: boolean }> };
    const rootId = rootUnits(normalizeStructure(raw))[0]?.id;
    const units = Array.isArray(raw.units) ? raw.units : [];
    const idx = units.findIndex((u) => u.id === rootId);
    if (idx < 0) {
      return NextResponse.json({ error: "Unità radice non trovata" }, { status: 400 });
    }
    units[idx].bookable = body.rootBookable;
    raw.units = units;
    const next = JSON.stringify(raw, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, next, sha, `Set structure type (rootBookable=${body.rootBookable})`, token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
