import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import { buildUnitICal, icalStamp } from "@/lib/icalExport";
import { getUnit, rootUnitId } from "@/lib/structure";
import type { AvailabilityData } from "@/data/availability";

// Feed iCal PUBBLICO di un'unità: /api/ical/<unit> (accetta anche <unit>.ics).
// Lo importano le OTA per bloccare le notti occupate — comprese quelle "contained"
// (bloccate a cascata da un'altra unità). Nessuna autenticazione: sono date, non dati
// sensibili, e le OTA lo scaricano senza credenziali.
export async function GET(request: Request, { params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
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
