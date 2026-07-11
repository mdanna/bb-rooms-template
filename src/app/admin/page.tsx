import { auth } from "@/auth";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminNav from "@/components/admin/AdminNav";
import AdminUnitSwitcher from "@/components/admin/AdminUnitSwitcher";
import { getFile } from "@/lib/githubContent";
import { availPath, stripContained } from "@/lib/unitAvailability";
import { getUnit, rootUnitId } from "@/lib/structure";
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

  const { unit } = await searchParams;
  const unitId = unit && getUnit(unit) ? unit : rootUnitId();

  // Carica il calendario dell'unità (fresco). Mostra all'admin solo il layer "proprio":
  // i blocchi derivati "contained" non sono modificabili qui, sono ricalcolati al salvataggio.
  let defaultPrice = 100;
  let overrides: DayRate[] = [];
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const data = JSON.parse(content) as AvailabilityData;
    defaultPrice = data.defaultPrice;
    overrides = stripContained(data.overrides ?? []);
  } catch {
    /* file non leggibile: si parte da un calendario vuoto */
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav userName={session.user?.name ?? session.user?.email} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <AdminUnitSwitcher activeUnitId={unitId} basePath="/admin" />
        <AdminEditor unitId={unitId} initialDefaultPrice={defaultPrice} initialOverrides={overrides} />
      </div>
    </div>
  );
}
