import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import TranslationsManager from "@/components/admin/TranslationsManager";

export default async function TranslationsPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <AdminShell userName={session.user?.name ?? session.user?.email} width="max-w-3xl">
      <TranslationsManager />
    </AdminShell>
  );
}
