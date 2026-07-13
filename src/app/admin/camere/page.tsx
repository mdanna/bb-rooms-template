import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import RoomsManager from "@/components/admin/RoomsManager";
import { allUnits } from "@/lib/structure";

export const dynamic = "force-dynamic";

export default async function CamerePage() {
  const session = await auth();
  if (!session) redirect("/admin");
  // Pagina valida solo per le strutture con camere.
  if (!allUnits().some((u) => u.kind === "room")) notFound();

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <RoomsManager />
      </div>
    </div>
  );
}
