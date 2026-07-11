import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { CONTENT, type SiteContent } from "@/lib/siteContent";
import { notifyPortalCard } from "@/lib/portalSync";

const FILE_PATH = "src/data/content.json";

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
    typeof b.airbnbRating === "number" &&
    typeof b.airbnbReviewCount === "number" &&
    typeof b.mapLat === "number" &&
    typeof b.mapLng === "number" &&
    Array.isArray(b.mapBookmarks) &&
    typeof b.heroImage === "string" &&
    Array.isArray(b.galleryImages) &&
    (!("imageOrder" in b) || Array.isArray(b.imageOrder)) &&
    Array.isArray(b.amenities) &&
    Array.isArray(b.reviews) &&
    (!("heroSubtitle" in b) || typeof b.heroSubtitle === "object") &&
    (!("storyTitle" in b) || typeof b.storyTitle === "object") &&
    (!("storyParagraphs" in b) || Array.isArray(b.storyParagraphs)) &&
    (!("areaDescription" in b) || typeof b.areaDescription === "object") &&
    (!("areaPlaces" in b) || Array.isArray(b.areaPlaces)) &&
    (!("siteTitle" in b) || typeof b.siteTitle === "object") &&
    (!("details" in b) || typeof b.details === "object") &&
    (!("metaDescription" in b) || typeof b.metaDescription === "string") &&
    (!("alternateNames" in b) || (Array.isArray(b.alternateNames) && b.alternateNames.every((n) => typeof n === "string"))) &&
    (!("seoTitleSuffix" in b) || typeof b.seoTitleSuffix === "string")
  );
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(CONTENT);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidContent(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
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
