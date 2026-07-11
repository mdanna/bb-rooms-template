import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import StripeSettings from "@/components/admin/StripeSettings";

export default async function StripePage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <StripeSettings />
      </div>
    </div>
  );
}
