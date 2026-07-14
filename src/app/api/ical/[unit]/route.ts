import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import { buildUnitICal, icalStamp } from "@/lib/icalExport";
import { verifyIcalExportToken } from "@/lib/icalExportToken";
import { getUnit, rootUnitId } from "@/lib/structure";
import type { AvailabilityData } from "@/data/availability";

// Feed iCal di un'unità: /api/ical/<unit>?key=<token> (accetta anche <unit>.ics).
// Lo importano le OTA per bloccare le notti occupate — comprese quelle "contained"
// (bloccate a cascata da un'altra unità). Protetto da un token segreto stabile (l'occupazione
// non deve essere pubblica): l'URL completo, col token, si copia da Impostazioni → Calendari.
export async function GET(request: Request, { params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;

  // Token non valido → 404 (non 401), per non rivelare l'esistenza del feed.
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !verifyIcalExportToken(key)) {
    return new Response("Not found", { status: 404 });
  }

  const cleaned = unit.replace(/\.ics$/i, "");
  const unitId = getUnit(cleaned) ? cleaned : rootUnitId();

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const data = JSON.parse(content) as AvailabilityData;
    const body = buildUnitICal(unitId, data.overrides ?? [], icalStamp(new Date()));
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${unitId}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      `Errore generazione calendario: ${err instanceof Error ? err.message : "sconosciuto"}`,
      { status: 502 }
    );
  }
}
