import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { CONTENT, type SiteContent } from "@/lib/siteContent";
import { getUnit, rootUnitId } from "@/lib/structure";
import { notifyPortalCard } from "@/lib/portalSync";

const FILE_PATH = "src/data/content.json";
const roomContentPath = (id: string) => `src/data/content/${id}.json`;

// Campi di contenuto PROPRI di una camera: tutto il resto (città, indirizzo, host,
// zona, mappa, recensioni, SEO) resta a livello struttura nel content.json condiviso.
// Testi in `content/<id>.json`; immagini (copertina/galleria/ordine) idem.
const ROOM_CONTENT_KEYS = [
  "siteTitle", "heroSubtitle", "storyTitle", "storyParagraphs", "amenities",
  "heroImage", "heroImages", "heroIntervalSec", "galleryImages", "imageOrder",
] as const;

function extractRoomContent(body: SiteContent): Partial<SiteContent> {
  const src = body as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ROOM_CONTENT_KEYS) {
    if (k in src && src[k] !== undefined) out[k] = src[k];
  }
  return out as Partial<SiteContent>;
}

function isValidContent(body: unknown): body is SiteContent {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.locationDisplay === "string" &&
    typeof b.address === "string" &&
    typeof b.phone === "string" &&
    typeof b.email === "string" &&
    typeof b.hostName === "string" &&
    (!("airbnbUrl" in b) || typeof b.airbnbUrl === "string") &&
    typeof b.mapLat === "number" &&
    typeof b.mapLng === "number" &&
    Array.isArray(b.mapBookmarks) &&
    typeof b.heroImage === "string" &&
    Array.isArray(b.galleryImages) &&
    (!("imageOrder" in b) || Array.isArray(b.imageOrder)) &&
    (!("heroImages" in b) || (Array.isArray(b.heroImages) && b.heroImages.every((n) => typeof n === "string"))) &&
    (!("heroIntervalSec" in b) || typeof b.heroIntervalSec === "number") &&
    Array.isArray(b.amenities) &&
    (!("heroSubtitle" in b) || typeof b.heroSubtitle === "object") &&
    (!("storyTitle" in b) || typeof b.storyTitle === "object") &&
    (!("storyParagraphs" in b) || Array.isArray(b.storyParagraphs)) &&
    (!("areaDescription" in b) || typeof b.areaDescription === "object") &&
    (!("areaPlaces" in b) || Array.isArray(b.areaPlaces)) &&
    (!("siteTitle" in b) || typeof b.siteTitle === "object") &&
    (!("details" in b) || typeof b.details === "object") &&
    (!("metaDescription" in b) || typeof b.metaDescription === "string") &&
    (!("alternateNames" in b) || (Array.isArray(b.alternateNames) && b.alternateNames.every((n) => typeof n === "string"))) &&
    (!("seoTitleSuffix" in b) || typeof b.seoTitleSuffix === "string") &&
    (!("whatsappNumber" in b) || typeof b.whatsappNumber === "string")
  );
}

// GET ?unit=<id>: contenuti di UNA unità. L'appartamento (radice) usa content.json;
// una camera riceve la VISTA MERGE (condiviso content.json + override camera), così
// l'editor ha sempre tutti i campi. Letto fresco da GitHub (riflette l'ultimo salvataggio).
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();
  const isRoom = unitId !== rootUnitId();

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const base = JSON.parse(content) as SiteContent;
    if (!isRoom) return NextResponse.json(base);
    // Camera: sovrapponi gli override propri (se il file esiste) alla base condivisa.
    let override: Partial<SiteContent> = {};
    try {
      const { content: rc } = await getFile(roomContentPath(unitId), token);
      override = JSON.parse(rc) as Partial<SiteContent>;
    } catch { /* nessun override camera ancora: usa la base */ }
    return NextResponse.json({ ...base, ...override });
  } catch {
    return NextResponse.json(CONTENT);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();
  const isRoom = unitId !== rootUnitId();

  const body = await request.json().catch(() => null);
  if (!isValidContent(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();

    // Camera: salva SOLO il sottoinsieme proprio in content/<id>.json (i campi
    // condivisi restano nel content.json della struttura). Nessun teaser di portale.
    if (isRoom) {
      const path = roomContentPath(unitId);
      let sha = "";
      let current: Partial<SiteContent> = {};
      try {
        const { content: cur, sha: fileSha } = await getFile(path, token);
        sha = fileSha;
        current = JSON.parse(cur) as Partial<SiteContent>;
      } catch { sha = ""; }
      const merged = { ...current, ...extractRoomContent(body) };
      const json = JSON.stringify(merged, null, 2) + "\n";
      const { commitSha } = await putFile(path, json, sha, `Update room content (${unitId})`, token);
      return NextResponse.json({ ok: true, commitSha });
    }

    // Struttura (radice): merge completo sul content.json condiviso.
    let sha: string;
    let current: SiteContent = CONTENT;
    try {
      const { content: cur, sha: fileSha } = await getFile(FILE_PATH, token);
      sha = fileSha;
      current = JSON.parse(cur);
    } catch {
      sha = "";
    }
    // Merge: preserva i campi non inviati dall'editor (es. `airbnbUrl`, ora gestito
    // nelle Impostazioni) invece di sovrascrivere l'intero file.
    const merged: SiteContent = { ...current, ...body };
    const content = JSON.stringify(merged, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update site content", token);
    // Se la struttura è collegata a un portale, aggiorna subito il suo teaser con i
    // meta freschi (best-effort: non blocca la risposta se il portale non risponde).
    await notifyPortalCard(merged);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
