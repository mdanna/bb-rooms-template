import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";

// Completa l'associazione/disassociazione al portale DAL LATO SITO (auth-gated:
// admin di QUESTA struttura). Scrive src/data/portal-link.json (di proprietà del
// sito, letto dal footer) e src/data/portal-link-token.json (SOLO server: il token
// di appartenenza restituito dal portale, per il sync del teaser e lo scollega),
// poi notifica il portale (register/unregister) inoltrando il token dell'handshake.
//
// INVARIANTE «un solo portale»: se il sito è già collegato a un portale DIVERSO, il
// collegamento a un nuovo portale viene RIFIUTATO (409): l'host deve prima scollegarsi.
const FILE = "src/data/portal-link.json";
const TOKEN_FILE = "src/data/portal-link-token.json";

async function readLinkUrl(token: string): Promise<string> {
  try {
    const { content } = await getFile(FILE, token);
    const j = JSON.parse(content) as { url?: string };
    return (j.url || "").trim().replace(/\/+$/, "");
  } catch {
    return "";
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const portal = String(body.portal ?? "").trim().replace(/\/+$/, "");
  const name = String(body.name ?? "").trim();
  const t = String(body.token ?? "");
  const action = body.action === "unlink" ? "unlink" : "link";
  if (!/^https?:\/\//i.test(portal)) {
    return NextResponse.json({ error: "URL del portale non valido" }, { status: 400 });
  }

  try {
    const token = requireBotToken();

    if (action === "link") {
      // Invariante: già collegato a un portale diverso → blocca.
      const current = await readLinkUrl(token);
      if (current && current !== portal) {
        return NextResponse.json(
          {
            error: `Questo sito è già collegato a un altro portale (${current}). Scollegati prima da quello — dalle Impostazioni del tuo sito o dal pannello di quel portale — poi riprova.`,
            currentPortal: current,
          },
          { status: 409 },
        );
      }

      // 1) Notifica il portale (register) e ricevi il token di appartenenza.
      let portalOk = false;
      let portalErr = "";
      let memberToken = "";
      try {
        const res = await fetch(`${portal}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json().catch(() => ({}));
        portalOk = res.ok;
        if (res.ok) memberToken = typeof data.memberToken === "string" ? data.memberToken : "";
        else portalErr = data?.error || `HTTP ${res.status}`;
      } catch (e) {
        portalErr = e instanceof Error ? e.message : "portale non raggiungibile";
      }

      // 2) Scrivi il link (il footer lo mostra) + il token di appartenenza (solo server).
      await writeJson(FILE, { url: portal, name }, `Collega al portale ${name}`, token);
      await writeJson(TOKEN_FILE, { token: memberToken }, "Aggiorna token portale", token);

      return NextResponse.json({ ok: true, action, portalOk, portalErr });
    }

    // action === "unlink": handshake avviato dal portale.
    let portalOk = false;
    let portalErr = "";
    try {
      const res = await fetch(`${portal}/api/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
        signal: AbortSignal.timeout(10000),
      });
      portalOk = res.ok;
      if (!res.ok) portalErr = (await res.json().catch(() => ({})))?.error || `HTTP ${res.status}`;
    } catch (e) {
      portalErr = e instanceof Error ? e.message : "portale non raggiungibile";
    }
    await writeJson(FILE, { url: "", name: "" }, "Scollega dal portale", token);
    await writeJson(TOKEN_FILE, { token: "" }, "Rimuovi token portale", token);

    return NextResponse.json({ ok: true, action, portalOk, portalErr });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 },
    );
  }
}
