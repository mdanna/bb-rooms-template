import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminAccessEditor from "@/components/admin/AdminAccessEditor";

export default async function AccessPage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <AdminShell width="max-w-3xl">
        <div className="rounded-lg border border-gold/40 bg-card p-6">
          <AdminAccessEditor />
        </div>
    </AdminShell>
  );
}
