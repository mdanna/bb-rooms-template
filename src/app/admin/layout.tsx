import { cookies } from "next/headers";
import { AdminLanguageProvider } from "@/i18n/AdminLanguageContext";
import { resolveAdminLocale, ADMIN_LOCALES, ADMIN_LOCALE_COOKIE } from "@/lib/policies";
import type { AdminLocaleCode } from "@/i18n/admin";
import AdminFooter from "@/components/admin/AdminFooter";
import { DraftProvider } from "@/components/admin/DraftContext";

// Il pannello admin è sempre dinamico (auth + dati freschi): niente prerender statico.
// Serve anche perché AdminNav legge il parametro ?unit con useSearchParams (l'header
// mostra la struttura o la camera corrente) — richiederebbe un boundary Suspense se
// la pagina fosse statica.
export const dynamic = "force-dynamic";

// Lingua iniziale del pannello: se l'operatore l'ha già scelta in questo browser usa il
// COOKIE (effetto immediato al reload, senza aspettare il redeploy); altrimenti il default
// del sito (policies.adminLocale). Da lì in poi il cambio è istantaneo via context (vedi
// AdminLanguageProvider). Il footer (con link al Manuale) è montato qui → su ogni pagina admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieLoc = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = (cookieLoc && (ADMIN_LOCALES as readonly string[]).includes(cookieLoc)
    ? cookieLoc
    : resolveAdminLocale()) as AdminLocaleCode;
  return (
    <AdminLanguageProvider locale={locale}>
      {/* Bozze condivise (Salva/Pubblica) tra tutte le sezioni admin per-unità. */}
      <DraftProvider>
        {children}
        <AdminFooter />
      </DraftProvider>
    </AdminLanguageProvider>
  );
}
