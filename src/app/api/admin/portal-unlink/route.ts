import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";

// Scollegamento AVVIATO DALLA STRUTTURA (dalle sue Impostazioni). Usa il token di
// appartenenza salvato in portal-link-token.json per disiscriversi dal portale
// (/api/unregister), poi azzera entrambi i file. Auth-gated: admin di questo sito.
// Best-effort verso il portale: anche se non risponde, il sito si scollega comunque
// (così non resti bloccato se il portale è offline o eliminato).
const FILE = "src/data/portal-link.json";
const TOKEN_FILE = "src/data/portal-link-token.json";

async function readJson(path: string, token: string): Promise<Record<string, unknown>> {
  try {
    const { content } = await getFile(path, token);
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeJson(path: string, obj: unknown, message: string, token: string): Promise<void> {
  let sha = "";
  try {
    ({ sha } = await getFile(path, token));
  } catch {
    sha = "";
  }
  await putFile(path, JSON.stringify(obj, null, 2) + "\n", sha, message, token);
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = requireBotToken();
    const link = await readJson(FILE, token);
    const portal = String(link.url ?? "").trim().replace(/\/+$/, "");
    if (!portal) {
      return NextResponse.json({ ok: true, alreadyUnlinked: true });
    }
    const tokenFile = await readJson(TOKEN_FILE, token);
    const memberToken = String(tokenFile.token ?? "");

    // Avvisa il portale (best-effort) col token di appartenenza.
    let portalOk = false;
    let portalErr = "";
    if (memberToken) {
      try {
        const res = await fetch(`${portal}/api/unregister`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: memberToken }),
          signal: AbortSignal.timeout(10000),
        });
        portalOk = res.ok;
        if (!res.ok) portalErr = (await res.json().catch(() => ({})))?.error || `HTTP ${res.status}`;
      } catch (e) {
        portalErr = e instanceof Error ? e.message : "portale non raggiungibile";
      }
    } else {
      portalErr = "nessun token di appartenenza (scollega dal pannello del portale)";
    }

    // Azzera comunque il legame lato sito.
    await writeJson(FILE, { url: "", name: "" }, "Scollega dal portale", token);
    await writeJson(TOKEN_FILE, { token: "" }, "Rimuovi token portale", token);

    return NextResponse.json({ ok: true, portalOk, portalErr });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scollegamento fallito" },
      { status: 502 },
    );
  }
}
