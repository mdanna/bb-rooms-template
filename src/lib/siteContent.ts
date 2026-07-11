import rawContent from "@/data/content.json";
import defaultsRaw from "@/data/defaults/content.json";
import type { LocaleCode } from "@/i18n/index";

export type L10n = Record<LocaleCode, string>;

export interface MapBookmark {
  lat: number;
  lng: number;
  label: string;
}

export interface Review {
  text: L10n;
  author: string;
}

export interface AreaPlace {
  name: L10n;
  comment: L10n;
}

export interface Details {
  entirePlace: L10n;
  quietCourtyard: L10n;
  roomInfo: L10n;
  maxGuests: L10n;
  neighborhood: L10n;
}

export interface SiteContent {
  siteTitle: L10n;
  locationDisplay: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  bookingEmail: string;
  vatNumber: string;
  cin: string;
  metaDescription: string;
  hostName: string;
  airbnbUrl?: string; // legacy: l'URL annuncio Airbnb si gestisce ora in Impostazioni
  airbnbRating: number;
  airbnbReviewCount: number;
  mapLat: number;
  mapLng: number;
  mapBookmarks: MapBookmark[];
  heroImage: string;
  galleryImages: string[];
  // Ordine unificato di TUTTE le immagini gestite (copertina inclusa), controllato
  // dall'admin. La galleria pubblica usa galleryImages (sottoinsieme ordinato); questo
  // serve al pannello per mantenere la disposizione scelta senza esiliare la copertina.
  imageOrder?: string[];
  amenities: L10n[];
  reviews: Review[];
  heroSubtitle: L10n;
  storyTitle: L10n;
  storyParagraphs: L10n[];
  areaDescription: L10n;
  areaPlaces: AreaPlace[];
  details: Details;
  // SEO (opzionali): nomi alternativi con cui la struttura viene cercata — nome
  // accorciato, titolo dell'annuncio Airbnb, ecc. → schema.org `alternateName`.
  alternateNames?: string[];
  // Suffisso del <title> per zona/landmark (es. "a due passi dal Vaticano").
  seoTitleSuffix?: string;
}

export const CONTENT: SiteContent = rawContent as SiteContent;

// Placeholder di default della metaDescription (dal seed dei contenuti): se la
// struttura non l'ha personalizzata, resta questo testo generico.
const DEFAULT_META_DESCRIPTION = ((defaultsRaw as { metaDescription?: string }).metaDescription ?? "").trim();

function firstL10n(m: L10n | undefined): string {
  if (!m) return "";
  return (m.it || Object.values(m).find(Boolean) || "").trim();
}

/**
 * Descrizione breve del sito: la metaDescription se l'host l'ha davvero scritta,
 * altrimenti (vuota o ancora il placeholder di default) il SOTTOTITOLO dell'hero.
 * Usata sia per og:description/SEO sia per il teaser nel portale, così coincidono
 * con ciò che si vede sul sito.
 */
export function resolveDescription(
  content: Pick<SiteContent, "metaDescription" | "heroSubtitle">,
): string {
  const md = (content.metaDescription ?? "").trim();
  if (md && md !== DEFAULT_META_DESCRIPTION) return md;
  return firstL10n(content.heroSubtitle) || md;
}
