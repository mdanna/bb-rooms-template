import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/prenota`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/recensioni`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/galleria`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/servizi`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/zona`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/gestione-prenotazione`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
