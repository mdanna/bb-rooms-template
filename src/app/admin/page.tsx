import { auth, GOOGLE_ENABLED } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";
import AdminUnitSwitcher from "@/components/admin/AdminUnitSwitcher";
import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import { getUnit, rootUnitId, isBookable, bookableUnits } from "@/lib/structure";
import type { AvailabilityData, DayRate, StayRule } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const session = await auth();
  if (!session) {
    return <AdminLogin demo={DEMO_MODE} google={GOOGLE_ENABLED} />;
  }

  // Il calendario/prezzi riguarda solo le unità AFFITTABILI: se l'appartamento è "solo
  // camere" (non prenotabile) non ha un calendario proprio → default alla prima camera.
  const { unit } = await searchParams;
  const requested = unit ? getUnit(unit) : undefined;
  const rootU = getUnit(rootUnitId());
  const fallback = rootU && isBookable(rootU) ? rootUnitId() : bookableUnits()[0]?.id ?? rootUnitId();
  const unitId = requested && isBookable(requested) ? requested.id : fallback;

  // Carica il calendario dell'unità (fresco). Mostra TUTTO: le prenotazioni proprie
  // (colorate) e i blocchi "contained" (grigio, non prenotabile perché un'altra unità
  // collegata è prenotata) — così il calendario riflette davvero lo stato. I "contained"
  // non sono editabili e vengono comunque scartati/ricalcolati al salvataggio.
  let defaultPrice = 100;
  let overrides: DayRate[] = [];
  let stayRules: StayRule[] = [];
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const data = JSON.parse(content) as AvailabilityData;
    defaultPrice = data.defaultPrice;
    overrides = data.overrides ?? [];
    stayRules = data.stayRules ?? [];
  } catch {
    /* file non leggibile: si parte da un calendario vuoto */
  }

  return (
    <AdminShell userName={session.user?.name ?? session.user?.email} width="max-w-3xl">
        <AdminUnitSwitcher activeUnitId={unitId} basePath="/admin" bookableOnly />
        {/* key=unitId: rimonta l'editor al cambio unità (lo stato del calendario è in
            useState dalle props → altrimenti mostrerebbe i dati del tab precedente). */}
        <AdminEditor key={unitId} unitId={unitId} initialDefaultPrice={defaultPrice} initialOverrides={overrides} initialStayRules={stayRules} />
    </AdminShell>
  );
}
