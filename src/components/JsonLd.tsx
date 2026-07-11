import { CONTENT } from "@/lib/siteContent";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com").replace(/\/+$/, "");

/**
 * Dati strutturati schema.org (BedAndBreakfast) generati da content.json.
 * Dicono ai motori di ricerca che questa è una struttura ricettiva, con
 * indirizzo, mappa, valutazione, servizi e foto → schede ricche nei risultati.
 * Reso come <script type="application/ld+json"> nell'HTML server-side
 * (pattern raccomandato dalla guida Next su JSON-LD). Componente server:
 * niente hook, si limita a leggere CONTENT e l'URL del sito.
 */
export default function JsonLd() {
  const images = [CONTENT.heroImage, ...CONTENT.galleryImages]
    .filter(Boolean)
    .map((img) => `${SITE_URL}/images/${img}`);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BedAndBreakfast",
    name: CONTENT.siteTitle.it,
    description: CONTENT.metaDescription,
    url: SITE_URL,
    image: images,
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTENT.address,
      addressLocality: CONTENT.city,
      addressCountry: "IT",
    },
  };

  if (CONTENT.mapLat && CONTENT.mapLng) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: CONTENT.mapLat,
      longitude: CONTENT.mapLng,
    };
  }
  if (CONTENT.phone) jsonLd.telephone = CONTENT.phone;
  if (CONTENT.email) jsonLd.email = CONTENT.email;

  if (CONTENT.airbnbRating > 0 && CONTENT.airbnbReviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: CONTENT.airbnbRating,
      reviewCount: CONTENT.airbnbReviewCount,
      bestRating: 5,
    };
  }

  const amenityFeature = CONTENT.amenities
    .map((a) => a.it)
    .filter(Boolean)
    .map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true }));
  if (amenityFeature.length) jsonLd.amenityFeature = amenityFeature;

  if (CONTENT.alternateNames && CONTENT.alternateNames.length > 0) {
    jsonLd.alternateName = CONTENT.alternateNames;
  }

  return (
    <script
      type="application/ld+json"
      // JSON-LD non è codice eseguibile: <script> nativo è corretto.
      // replace('<' → '<') previene injection via i contenuti (guida Next).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
