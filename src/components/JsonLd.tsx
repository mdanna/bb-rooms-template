import { CONTENT, resolveDescription } from "@/lib/siteContent";
import { PRIMARY_LANG } from "@/lib/l10n";
import { POLICIES } from "@/lib/policies";
import { localeOrder } from "@/i18n/index";
import {
  buildVacationRentalJsonLd,
  serializeJsonLd,
  vacationRentalId,
  type VacationRentalInput,
} from "@/lib/vacationRentalJsonLd";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com").replace(/\/+$/, "");

/**
 * Dati strutturati schema.org/VacationRental generati dal modello dati DimoraSuite.
 * Rendono la pagina-struttura idonea al crawl di Google Vacation Rentals e leggibili
 * dai sistemi AI (Gemini/ChatGPT/Perplexity). Reso come <script application/ld+json>
 * server-side (pattern raccomandato da Next).
 *
 * IMPORTANTE (identità-only): questo blocco NON contiene aggregateRating/review.
 * Le recensioni entrano nel markup SOLO sulla pagina /recensioni, dove sono
 * visibili a schermo (policy Google: il markup deve riflettere il contenuto della
 * pagina). Qui c'è solo l'identità della struttura, condivisa via `@id`, iniettata
 * su tutte le pagine (SEO/AI). Nessun dato Airbnb/Booking/Vrbo entra nel markup.
 *
 * Nota realistica: questo markup è il prerequisito tecnico e dà valore SEO/AI
 * immediato, ma NON pubblica da solo la struttura su Google Vacation Rentals —
 * per i rich result di Google Travel serve l'ammissione a Hotel Center. Vedi
 * README del modulo.
 */
export default function JsonLd() {
  const images = [CONTENT.heroImage, ...CONTENT.galleryImages]
    .filter(Boolean)
    .map((img) => `${SITE_URL}/images/${img}`);

  // ID stabile e content-independent: preferisci il CIN, poi la P.IVA/CF, infine
  // l'host del dominio (fallback per istanze senza CIN configurato).
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const identifier = (CONTENT.cin || CONTENT.vatNumber || host).trim();

  // Indirizzo: `content.address` include già la città → la togliamo dallo
  // streetAddress per non duplicarla in addressLocality.
  const streetAddress = CONTENT.address.replace(new RegExp(`,?\\s*${CONTENT.city}\\s*$`, "i"), "").trim();

  const input: VacationRentalInput = {
    name: CONTENT.siteTitle[PRIMARY_LANG] || CONTENT.siteTitle.it,
    identifier,
    id: vacationRentalId(SITE_URL),
    url: SITE_URL,
    images,
    latitude: CONTENT.mapLat,
    longitude: CONTENT.mapLng,
    maxOccupancy: POLICIES.maxGuests,
    additionalType: "Apartment",
    description: resolveDescription(CONTENT),
    telephone: CONTENT.phone || undefined,
    email: CONTENT.email || undefined,
    address: {
      streetAddress: streetAddress || undefined,
      addressLocality: CONTENT.city || undefined,
      addressCountry: "IT",
    },
    checkinTime: POLICIES.checkinTime,
    checkoutTime: POLICIES.checkoutTime,
    knowsLanguage: [...localeOrder],
    accommodation: {
      additionalType: "EntirePlace",
      amenities: CONTENT.amenities.map((a) => a[PRIMARY_LANG] || a.it).filter(Boolean),
    },
  };

  const jsonLd = buildVacationRentalJsonLd(input);

  return (
    <script
      type="application/ld+json"
      // JSON-LD non è codice eseguibile: <script> nativo è corretto.
      // serializeJsonLd neutralizza '<' per prevenire injection via contenuti.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
    />
  );
}
