import { auth } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminNav from "@/components/admin/AdminNav";
import AdminUnitSwitcher from "@/components/admin/AdminUnitSwitcher";
import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import { getUnit, rootUnitId, isBookable, bookableUnits } from "@/lib/structure";
import type { AvailabilityData, DayRate } from "@/data/availability";
import { DEMO_MODE } from "@/lib/demo";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const session = await auth();
  if (!session) {
    return <AdminLogin demo={DEMO_MODE} />;
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
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const data = JSON.parse(content) as AvailabilityData;
    defaultPrice = data.defaultPrice;
    overrides = data.overrides ?? [];
  } catch {
    /* file non leggibile: si parte da un calendario vuoto */
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav userName={session.user?.name ?? session.user?.email} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <AdminUnitSwitcher activeUnitId={unitId} basePath="/admin" bookableOnly />
        <AdminEditor unitId={unitId} initialDefaultPrice={defaultPrice} initialOverrides={overrides} />
      </div>
    </div>
  );
}
