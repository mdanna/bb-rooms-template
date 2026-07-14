import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runCalendarSync } from "@/lib/runCalendarSync";
import { setAppState } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo";

// Il tipo resta importabile da questo percorso (retrocompat con SettingsManager).
export type { CalendarSyncResult } from "@/lib/runCalendarSync";

export const CALENDAR_LAST_SYNC_KEY = "calendar_last_sync";

// Sincronizzazione MANUALE di UNA unità (?unit=<id>, default radice) dal pannello.
// La logica vive in runCalendarSync, condivisa con il cron automatico.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  // In demo non si sincronizza nulla (nessun URL reale, nessuna scrittura).
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const unit = new URL(request.url).searchParams.get("unit");
  const outcome = await runCalendarSync(unit);
  if (!outcome.ok) {
    const msg = outcome.reason === "no-calendars"
      ? "Nessun calendario iCal configurato per questa unità"
      : "Impostazioni calendari non leggibili";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await setAppState(CALENDAR_LAST_SYNC_KEY, new Date().toISOString()).catch(() => {});
  return NextResponse.json(outcome.result);
}
