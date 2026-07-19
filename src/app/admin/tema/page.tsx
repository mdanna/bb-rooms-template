import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ThemeEditor from "@/components/admin/ThemeEditor";

export default async function ThemePage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <AdminShell width="max-w-3xl">
        <div className="rounded-lg border border-gold/40 bg-card p-6">
          <ThemeEditor />
        </div>
    </AdminShell>
  );
}
