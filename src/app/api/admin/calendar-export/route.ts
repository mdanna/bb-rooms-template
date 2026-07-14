import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { icalExportToken } from "@/lib/icalExportToken";
import { getAppState } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { bookableUnits, unitLabel, rootUnitId } from "@/lib/structure";
import { CONTENT } from "@/lib/siteContent";
import { CALENDAR_LAST_SYNC_KEY } from "@/app/api/admin/calendar-sync/route";

// Fornisce al pannello un feed iCal di export PER OGNI unità affittabile (appartamento intero
// + eventuali camere), da incollare nel rispettivo annuncio OTA, e l'ultima sync automatica.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let token = "";
  try { token = icalExportToken(); } catch { token = ""; }

  const units = !base || !token ? [] : bookableUnits().map((u) => {
    const label = unitLabel(u.id, "it") || CONTENT.siteTitle.it || u.id;
    return { unitId: u.id, label, url: `${base}/api/ical/${encodeURIComponent(u.id)}.ics?key=${token}` };
  });

  const lastSyncAt = DEMO_MODE ? null : await getAppState(CALENDAR_LAST_SYNC_KEY).catch(() => null);

  // `single`: struttura a unità singola → un solo feed, UX identica ai siti senza camere.
  return NextResponse.json({ units, single: bookableUnits().length <= 1, rootUnitId: rootUnitId(), lastSyncAt });
}
