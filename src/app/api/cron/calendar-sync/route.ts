import { NextResponse } from "next/server";
import { runCalendarSync } from "@/lib/runCalendarSync";
import { setAppState } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";
import { allUnits } from "@/lib/structure";
import { CALENDAR_LAST_SYNC_KEY } from "@/app/api/admin/calendar-sync/route";

// Sincronizzazione AUTOMATICA (Vercel Cron, vedi vercel.json): itera su TUTTE le unità
// della struttura (appartamento + camere) e sincronizza il calendario OTA di ciascuna.
export async function GET(request: Request) {
  // Vercel Cron invia CRON_SECRET come Authorization: Bearer <secret>.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true });

  const units: { unitId: string; changed: boolean; skipped?: string }[] = [];
  for (const u of allUnits()) {
    const outcome = await runCalendarSync(u.id);
    if (!outcome.ok) {
      units.push({ unitId: u.id, changed: false, skipped: outcome.reason });
    } else {
      units.push({ unitId: u.id, changed: outcome.result.changed });
    }
  }

  await setAppState(CALENDAR_LAST_SYNC_KEY, new Date().toISOString()).catch(() => {});
  return NextResponse.json({ ok: true, units });
}
