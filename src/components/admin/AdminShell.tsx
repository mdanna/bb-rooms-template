import AdminSidebar from "@/components/admin/AdminSidebar";

// Guscio del pannello: sidebar a sinistra + area contenuto. Sostituisce il vecchio
// wrapper per-pagina (min-h-screen + AdminNav in cima + div centrato). `width` = la
// larghezza massima del contenuto della pagina (default max-w-5xl).
export default function AdminShell({
  userName,
  width = "max-w-5xl",
  children,
}: {
  userName?: string | null;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <AdminSidebar userName={userName} />
      <main className="min-w-0 flex-1">
        <div className={`mx-auto ${width} px-6 py-12`}>{children}</div>
      </main>
    </div>
  );
}
