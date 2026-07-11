import { LanguageProvider } from "@/i18n/LanguageContext";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen flex-1 flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </div>
    </LanguageProvider>
  );
}
