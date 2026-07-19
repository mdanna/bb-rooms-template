import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import RoomsManager from "@/components/admin/RoomsManager";
import { allUnits } from "@/lib/structure";

export const dynamic = "force-dynamic";

export default async function CamerePage() {
  const session = await auth();
  if (!session) redirect("/admin");
  // Pagina valida solo per le strutture con camere.
  if (!allUnits().some((u) => u.kind === "room")) notFound();

  return (
    <AdminShell width="max-w-3xl">
        <RoomsManager />
    </AdminShell>
  );
}
