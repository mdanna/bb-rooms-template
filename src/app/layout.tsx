import type { Metadata } from "next";
import { PRIMARY_LANG } from "@/lib/l10n";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { CONTENT, resolveDescription } from "@/lib/siteContent";
import { themeCss } from "@/lib/theme";
import DemoBanner from "@/components/DemoBanner";
import JsonLd from "@/components/JsonLd";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com";
const SITE_TITLE = CONTENT.siteTitle[PRIMARY_LANG] || CONTENT.siteTitle.it;
const SITE_DESCRIPTION = resolveDescription(CONTENT);
const TITLE_SUFFIX = CONTENT.seoTitleSuffix ? ` · ${CONTENT.seoTitleSuffix}` : "";

export const metadata: Metadata = {
  title: {
    default: `${SITE_TITLE} — ${CONTENT.locationDisplay}${TITLE_SUFFIX}`,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "it_IT",
    alternateLocale: ["en_US", "fr_FR", "de_DE", "es_ES", "pt_PT", "zh_CN", "ja_JP", "ko_KR"],
    type: "website",
    images: [{ url: `/images/${CONTENT.heroImage}`, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`/images/${CONTENT.heroImage}`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${playfair.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Tema del cliente: sovrascrive le variabili colore di globals.css */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <JsonLd />
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
