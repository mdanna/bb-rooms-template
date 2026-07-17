import rawContent from "@/data/content.json";
import defaultsRaw from "@/data/defaults/content.json";
import type { LocaleCode } from "@/i18n/index";
import { PRIMARY_LANG } from "./l10n";

export type L10n = Record<LocaleCode, string>;

export interface MapBookmark {
  lat: number;
  lng: number;
  label: string;
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
  // Numero WhatsApp della struttura (formato internazionale, es. +39…). Se presente,
  // mostra i pulsanti "Contattaci su WhatsApp" su sito ed email. Vuoto = niente pulsanti.
  whatsappNumber?: string;
  email: string;
  bookingEmail: string;
  vatNumber: string;
  cin: string;
  metaDescription: string;
  hostName: string;
  airbnbUrl?: string; // legacy: l'URL annuncio Airbnb (canale di prenotazione) si gestisce ora in Impostazioni
  mapLat: number;
  mapLng: number;
  mapBookmarks: MapBookmark[];
  heroImage: string;
  galleryImages: string[];
  // Ordine unificato di TUTTE le immagini gestite (copertina inclusa), controllato
  // dall'admin. La galleria pubblica usa galleryImages (sottoinsieme ordinato); questo
  // serve al pannello per mantenere la disposizione scelta senza esiliare la copertina.
  imageOrder?: string[];
  // Copertina multipla (opt-in): se sono "in evidenza" più foto, l'hero dell'oggetto
  // (home o camera) diventa un carosello a dissolvenza. Retro-compatibile e opzionale:
  // assente ⇒ una sola copertina = hero statico identico a prima. INVARIANTE: `heroImage`
  // resta il PRIMO riferimento (per imageOrder) e continua a valere per ogni riferimento
  // ESTERNO (og:image, JSON-LD, teaser del portale, card camera), mai l'array.
  heroImages?: string[];
  heroIntervalSec?: number;
  amenities: L10n[];
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

/**
 * Lista ordinata delle foto di copertina per il carosello dell'hero. Segue l'ordine
 * scelto dall'admin (`imageOrder`): le foto "in evidenza" (`heroImages`) ordinate per
 * imageOrder, poi le eventuali non ancora ordinate. Fallback: se non c'è alcuna foto in
 * evidenza, usa il singolo `heroImage` (retro-compatibile). Quindi `heroImageList(c)[0]`
 * è SEMPRE la copertina primaria (= `heroImage`, l'invariante per og:image/JSON-LD/teaser).
 */
export function heroImageList(
  c: Pick<SiteContent, "heroImages" | "heroImage" | "imageOrder">,
): string[] {
  const stars = c.heroImages ?? [];
  if (stars.length === 0) return c.heroImage ? [c.heroImage] : [];
  const order = c.imageOrder ?? [];
  const ordered = order.filter((n) => stars.includes(n));
  const rest = stars.filter((n) => !ordered.includes(n));
  return [...ordered, ...rest];
}

// Placeholder di default della metaDescription (dal seed dei contenuti): se la
// struttura non l'ha personalizzata, resta questo testo generico.
const DEFAULT_META_DESCRIPTION = ((defaultsRaw as { metaDescription?: string }).metaDescription ?? "").trim();

// Numero WhatsApp della struttura per i pulsanti pubblici/email: il campo dedicato
// (whatsappNumber) se impostato, altrimenti il TELEFONO — ma solo se è un numero vero,
// non il segnaposto di default (così un'istanza appena creata non mostra un numero finto).
// "" = nessun pulsante.
const DEFAULT_PHONE = ((defaultsRaw as { phone?: string }).phone ?? "").trim();
export const HOST_WHATSAPP: string =
  (CONTENT.whatsappNumber ?? "").trim() ||
  ((CONTENT.phone ?? "").trim() && (CONTENT.phone ?? "").trim() !== DEFAULT_PHONE ? CONTENT.phone : "");

function firstL10n(m: L10n | undefined): string {
  if (!m) return "";
  return (m[PRIMARY_LANG] || m.it || Object.values(m).find(Boolean) || "").trim();
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
