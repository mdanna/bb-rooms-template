import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SettingsManager from "@/components/admin/SettingsManager";

export default async function ImpostazioniPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <SettingsManager />
      </div>
    </div>
  );
}
