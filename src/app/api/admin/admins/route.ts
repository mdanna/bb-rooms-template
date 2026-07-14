import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { ADMIN_EMAILS, ADMIN_GITHUB_LOGINS, isValidEmail, isValidGithubLogin } from "@/lib/adminAccess";
import { DEMO_MODE } from "@/lib/demo";

const FILE_PATH = "src/data/admins.json";

// GET: identità attualmente autorizzate — email (magic-link + Google) e username GitHub
// (file se presente, altrimenti env), così l'editor mostra gli accessi correnti anche
// prima della prima modifica.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  return NextResponse.json({ emails: ADMIN_EMAILS, githubLogins: ADMIN_GITHUB_LOGINS });
}

// POST: salva le liste autorizzate su src/data/admins.json (commit su GitHub → redeploy).
// Valida, deduplica e impedisce di restare senza NESSUNA identità (anti-lockout): deve
// rimanere almeno un'email O uno username GitHub.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true });

  const body = (await request.json().catch(() => null)) as {
    emails?: unknown;
    githubLogins?: unknown;
  } | null;
  if (!body || !Array.isArray(body.emails) || !Array.isArray(body.githubLogins)) {
    return NextResponse.json({ error: "Elenco accessi non valido" }, { status: 400 });
  }

  const emails = Array.from(
    new Set(body.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)),
  );
  if (emails.some((e) => !isValidEmail(e))) {
    return NextResponse.json({ error: "Uno o più indirizzi non sono validi." }, { status: 400 });
  }

  const githubLogins = Array.from(
    new Set(body.githubLogins.map((g) => String(g).trim().toLowerCase()).filter(Boolean)),
  );
  if (githubLogins.some((g) => !isValidGithubLogin(g))) {
    return NextResponse.json({ error: "Uno o più username GitHub non sono validi." }, { status: 400 });
  }

  if (emails.length === 0 && githubLogins.length === 0) {
    return NextResponse.json(
      { error: "Deve restare almeno un accesso autorizzato (email o GitHub)." },
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
    const content = JSON.stringify({ emails, githubLogins }, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update admin access list", token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 },
    );
  }
}
