import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import ThemeEditor from "@/components/admin/ThemeEditor";

export default async function ThemePage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-lg border border-gold/40 bg-card p-6">
          <ThemeEditor />
        </div>
      </div>
    </div>
  );
}
