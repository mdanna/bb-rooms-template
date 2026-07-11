import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { calendarUrlsForUnit, type Policies } from "@/lib/policies";
import { getUnit, rootUnitId } from "@/lib/structure";
import { CONTENT } from "@/lib/siteContent";
import type { OtaPlatform } from "@/data/availability";

const FILE_PATH = "src/data/policies.json";
const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // ?unit=<id>: gli URL iCal sono per-unità (default radice). Gli altri campi
  // (annunci esterni, lingua) restano a livello struttura.
  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    const p: Policies = JSON.parse(content);
    return NextResponse.json({
      unitId,
      calendars: calendarUrlsForUnit(p, unitId, rootUnitId()),
      airbnbUrl: p.airbnbUrl ?? CONTENT.airbnbUrl ?? "", // fallback dal vecchio content.airbnbUrl
      bookingUrl: p.bookingUrl ?? "",
      vrboUrl: p.vrboUrl ?? "",
      defaultBookingPlatform: p.defaultBookingPlatform ?? "airbnb",
      adminLocale: p.adminLocale ?? "it",
    });
  } catch {
    return NextResponse.json({ unitId, calendars: { airbnb: "", booking: "", vrbo: "" }, airbnbUrl: "", bookingUrl: "", vrboUrl: "", defaultBookingPlatform: "airbnb", adminLocale: "it" });
  }
}

// Costruisce un update parziale validato: aggiorna solo i campi presenti nel body.
function buildUpdate(body: unknown): Partial<Policies> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const update: Partial<Policies> = {};

  if ("calendars" in b) {
    const c = b.calendars;
    if (!c || typeof c !== "object") return null;
    const cal = c as Record<string, unknown>;
    if (!PLATFORMS.every((p) => cal[p] === undefined || typeof cal[p] === "string")) return null;
    update.calendars = { airbnb: String(cal.airbnb ?? "").trim(), booking: String(cal.booking ?? "").trim(), vrbo: String(cal.vrbo ?? "").trim() };
  }
  if ("airbnbUrl" in b) {
    if (typeof b.airbnbUrl !== "string") return null;
    update.airbnbUrl = b.airbnbUrl.trim();
  }
  if ("bookingUrl" in b) {
    if (typeof b.bookingUrl !== "string") return null;
    update.bookingUrl = b.bookingUrl.trim();
  }
  if ("vrboUrl" in b) {
    if (typeof b.vrboUrl !== "string") return null;
    update.vrboUrl = b.vrboUrl.trim();
  }
  if ("defaultBookingPlatform" in b) {
    if (!PLATFORMS.includes(b.defaultBookingPlatform as OtaPlatform)) return null;
    update.defaultBookingPlatform = b.defaultBookingPlatform as OtaPlatform;
  }
  if ("adminLocale" in b) {
    if (!(["it", "en", "es", "fr"] as string[]).includes(b.adminLocale as string)) return null;
    update.adminLocale = b.adminLocale as Policies["adminLocale"];
  }
  return Object.keys(update).length > 0 ? update : null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  // ?unit / body.unit: gli URL iCal di una CAMERA vanno in unitCalendars[unit]; l'unità
  // radice (o assente) usa il `calendars` legacy, così i siti a unità singola non cambiano.
  const unit = body && typeof body === "object" && typeof (body as Record<string, unknown>).unit === "string"
    ? String((body as Record<string, unknown>).unit)
    : undefined;
  const update = buildUpdate(body);
  if (!update) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  try {
    const token = requireBotToken();
    let sha: string;
    let currentPolicies: Policies;
    try {
      const { content, sha: fileSha } = await getFile(FILE_PATH, token);
      sha = fileSha;
      currentPolicies = JSON.parse(content);
    } catch {
      sha = "";
      const { POLICIES } = await import("@/lib/policies");
      currentPolicies = POLICIES;
    }
    const updated: Policies = { ...currentPolicies, ...update };
    const isRoomCalendar = !!update.calendars && !!unit && !!getUnit(unit) && unit !== rootUnitId();
    if (isRoomCalendar) {
      // Non toccare il `calendars` della radice: instrada gli URL nella mappa per-unità.
      updated.calendars = currentPolicies.calendars;
      updated.unitCalendars = { ...(currentPolicies.unitCalendars ?? {}), [unit!]: update.calendars! };
    } else if (update.calendars) {
      delete updated.airbnbIcalUrl; // radice: migra via dal campo legacy
    }
    const content = JSON.stringify(updated, null, 2) + "\n";
    await putFile(FILE_PATH, content, sha, "Update settings", token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
