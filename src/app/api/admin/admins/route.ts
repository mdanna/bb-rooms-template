import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { ADMIN_EMAILS, isValidEmail } from "@/lib/adminAccess";
import { DEMO_MODE } from "@/lib/demo";

const FILE_PATH = "src/data/admins.json";

// GET: le email attualmente autorizzate (file se presente, altrimenti env), così l'editor
// mostra gli accessi correnti anche prima della prima modifica.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  return NextResponse.json({ emails: ADMIN_EMAILS });
}

// POST: salva la nuova lista di email autorizzate su src/data/admins.json (commit su
// GitHub → redeploy). Valida, deduplica e impedisce di svuotare la lista (anti-lockout).
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true });

  const body = (await request.json().catch(() => null)) as { emails?: unknown } | null;
  if (!body || !Array.isArray(body.emails)) {
    return NextResponse.json({ error: "Elenco email non valido" }, { status: 400 });
  }

  const emails = Array.from(
    new Set(body.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)),
  );
  if (emails.some((e) => !isValidEmail(e))) {
    return NextResponse.json({ error: "Uno o più indirizzi non sono validi." }, { status: 400 });
  }
  if (emails.length === 0) {
    return NextResponse.json(
      { error: "Deve restare almeno un indirizzo autorizzato all'accesso." },
      { status: 400 },
    );
  }

  try {
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(FILE_PATH, token));
    } catch {
      sha = "";
    }
    const content = JSON.stringify({ emails }, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update admin access emails", token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 },
    );
  }
}
