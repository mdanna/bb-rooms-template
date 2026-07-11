import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import ContentEditor from "@/components/admin/ContentEditor";
import AdminUnitSwitcher from "@/components/admin/AdminUnitSwitcher";
import { getUnit, rootUnitId } from "@/lib/structure";
import { resolveAdminLocale } from "@/lib/policies";
import { adminTranslations } from "@/i18n/admin";

export default async function ContenutiPage({
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
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <AdminUnitSwitcher activeUnitId={unitId} basePath="/admin/contenuti" />
        <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
          <p className="text-sm text-foreground/60">
            {t.contents.intro}
          </p>
          <ContentEditor unitId={unitId} />
        </div>
      </div>
    </div>
  );
}
