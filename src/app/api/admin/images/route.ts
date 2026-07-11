import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, deleteFile, requireBotToken } from "@/lib/githubContent";
import { DEMO_MODE, demoWriteBlocked } from "@/lib/demo";
import type { SiteContent } from "@/lib/siteContent";
import { notifyPortalCard } from "@/lib/portalSync";
import contentData from "@/data/content.json";

const IMAGES_DIR = "public/images";
const CONTENT_PATH = "src/data/content.json";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // In demo la lista arriva dai file già presenti nel repo (referenziati in content.json),
  // non da GitHub: l'upload/delete sono poi gestiti in modo effimero lato client.
  if (DEMO_MODE) {
    const c = contentData as { heroImage?: string; galleryImages?: string[] };
    const names = [c.heroImage, ...(c.galleryImages ?? [])].filter(Boolean) as string[];
    const files = [...new Set(names)].map((name) => ({ name, sha: "demo" }));
    return NextResponse.json({ files });
  }

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const res = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO_OWNER ?? "your-github-username"}/${process.env.GITHUB_REPO_NAME ?? "your-repo-name"}/contents/${IMAGES_DIR}?ref=${process.env.GITHUB_DATA_BRANCH ?? "main"}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as Array<{ name: string; type: string; sha: string }>;
    const files = data
      .filter((f) => f.type === "file")
      .map((f) => ({ name: f.name, sha: f.sha }));
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || typeof body.base64 !== "string") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const name = body.name as string;
  const base64 = body.base64 as string;
  const path = `${IMAGES_DIR}/${name}`;

  if (DEMO_MODE) return demoWriteBlocked();

  try {
    const token = requireBotToken();
    let sha = "";
    try {
      ({ sha } = await getFile(path, token));
    } catch {
      sha = "";
    }
    // putFile encodes utf-8 content to base64, but we already have binary base64.
    // Use raw GitHub API call instead.
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "your-github-username";
    const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "your-repo-name";
    const DATA_BRANCH = process.env.GITHUB_DATA_BRANCH ?? "main";
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload image: ${name}`,
          content: base64,
          ...(sha ? { sha } : {}),
          branch: DATA_BRANCH,
        }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload fallito" },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const name = body.name as string;
  const path = `${IMAGES_DIR}/${name}`;

  if (DEMO_MODE) return demoWriteBlocked();

  try {
    const token = requireBotToken();

    // Radice del problema: PRIMA di rimuovere il file, togli ogni riferimento a
    // questa immagine da content.json (hero + galleria), così il dato non resta
    // mai a puntare a un file inesistente (galleria, hero e JsonLd inclusi).
    // Ordine: content.json prima, immagine dopo — lo stato intermedio (ref già
    // rimosso, file ancora presente) è innocuo. Best-effort: se la ripulitura
    // fallisce si procede comunque con la delete (il filtro build-time della
    // galleria fa da rete di sicurezza).
    let contentUpdated = false;
    let commitSha: string | undefined;
    try {
      const { content: cur, sha: contentSha } = await getFile(CONTENT_PATH, token);
      const current = JSON.parse(cur) as SiteContent;
      const nextHero = current.heroImage === name ? "" : current.heroImage;
      const nextGallery = (current.galleryImages ?? []).filter((n) => n !== name);
      const nextOrder = (current.imageOrder ?? []).filter((n) => n !== name);
      const changed =
        nextHero !== current.heroImage ||
        nextGallery.length !== (current.galleryImages ?? []).length ||
        nextOrder.length !== (current.imageOrder ?? []).length;
      if (changed) {
        const merged: SiteContent = { ...current, heroImage: nextHero, galleryImages: nextGallery, imageOrder: nextOrder };
        const json = JSON.stringify(merged, null, 2) + "\n";
        ({ commitSha } = await putFile(CONTENT_PATH, json, contentSha, `Remove image reference: ${name}`, token));
        contentUpdated = true;
        // Aggiorna il teaser del portale se collegato (best-effort, non blocca).
        try { await notifyPortalCard(merged); } catch { /* ignora */ }
      }
    } catch {
      // Ripulitura non riuscita: procedi comunque con l'eliminazione del file.
    }

    const { sha } = await getFile(path, token);
    await deleteFile(path, sha, `Delete image: ${name}`, token);
    return NextResponse.json({ ok: true, contentUpdated, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Eliminazione fallita" },
      { status: 502 }
    );
  }
}
