import { AdminLanguageProvider } from "@/i18n/AdminLanguageContext";
import { resolveAdminLocale } from "@/lib/policies";
import AdminFooter from "@/components/admin/AdminFooter";

// La lingua del pannello viene dalla configurazione del sito (policies.adminLocale,
// default "it"), letta lato server e passata al provider. Cambiabile da Impostazioni.
// Il footer (con link al Manuale) è montato qui → compare su ogni pagina admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLanguageProvider locale={resolveAdminLocale()}>
      {children}
      <AdminFooter />
    </AdminLanguageProvider>
  );
}
