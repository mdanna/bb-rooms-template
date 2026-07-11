import { AdminLanguageProvider } from "@/i18n/AdminLanguageContext";
import { resolveAdminLocale } from "@/lib/policies";
import AdminFooter from "@/components/admin/AdminFooter";
import { DraftProvider } from "@/components/admin/DraftContext";

// Il pannello admin è sempre dinamico (auth + dati freschi): niente prerender statico.
// Serve anche perché AdminNav legge il parametro ?unit con useSearchParams (l'header
// mostra la struttura o la camera corrente) — richiederebbe un boundary Suspense se
// la pagina fosse statica.
export const dynamic = "force-dynamic";

// La lingua del pannello viene dalla configurazione del sito (policies.adminLocale,
// default "it"), letta lato server e passata al provider. Cambiabile da Impostazioni.
// Il footer (con link al Manuale) è montato qui → compare su ogni pagina admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLanguageProvider locale={resolveAdminLocale()}>
      {/* Bozze condivise (Salva/Pubblica) tra tutte le sezioni admin per-unità. */}
      <DraftProvider>
        {children}
        <AdminFooter />
      </DraftProvider>
    </AdminLanguageProvider>
  );
}
