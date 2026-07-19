import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import SettingsManager from "@/components/admin/SettingsManager";

export default async function ImpostazioniPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <AdminShell width="max-w-3xl">
        <SettingsManager />
    </AdminShell>
  );
}
