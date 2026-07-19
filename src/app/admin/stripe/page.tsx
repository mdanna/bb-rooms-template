import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import StripeSettings from "@/components/admin/StripeSettings";

export default async function StripePage() {
  const session = await auth();
  if (!session) redirect("/admin");

  return (
    <AdminShell width="max-w-2xl">
        <StripeSettings />
    </AdminShell>
  );
}
