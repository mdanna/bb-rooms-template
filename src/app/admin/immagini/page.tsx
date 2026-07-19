import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ImageManager from "@/components/admin/ImageManager";
import AdminUnitSwitcher from "@/components/admin/AdminUnitSwitcher";
import { getUnit, rootUnitId } from "@/lib/structure";
import { resolveAdminLocale } from "@/lib/policies";
import { adminTranslations } from "@/i18n/admin";

export default async function ImmaginiPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/admin");
  const t = adminTranslations[resolveAdminLocale()];
  const { unit } = await searchParams;
  const unitId = unit && getUnit(unit) ? unit : rootUnitId();

  return (
    <AdminShell width="max-w-3xl">
        <AdminUnitSwitcher activeUnitId={unitId} basePath="/admin/immagini" />
        <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
          <p className="text-sm text-foreground/60">
            {t.images.intro}
          </p>
          <ImageManager unitId={unitId} />
        </div>
    </AdminShell>
  );
}
