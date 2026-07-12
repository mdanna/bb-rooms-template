/**
 * Generatore JSON-LD schema.org/VacationRental — funzione PURA e testabile.
 *
 * Riceve un oggetto "struttura" già normalizzato (VacationRentalInput) e produce
 * l'oggetto JSON-LD da iniettare nel <head> della pagina-struttura. Non legge dal
 * filesystem né dal DB: chi lo chiama (JsonLd.tsx / lib/reviews.ts) fa il mapping
 * dal modello dati DimoraSuite a questo input, così il generatore resta puro.
 *
 * Fonte dei campi (required vs recommended): documentazione ufficiale Google
 * https://developers.google.com/search/docs/appearance/structured-data/vacation-rental
 *
 * Vincoli importanti implementati qui:
 *  - `identifier`, `name`, `image`, `latitude`, `longitude` e
 *    `containsPlace.occupancy.value` sono REQUIRED → se mancano si solleva un
 *    errore in fase di build (messaggio che indica il campo e la struttura).
 *  - `checkinTime`/`checkoutTime` normalizzati a ISO 8601 `HH:MM:SS` ("15:00" →
 *    "15:00:00"); formati non riconoscibili (es. "3:00 PM") sollevano errore.
 *  - `latitude`/`longitude` passati con piena precisione (nessun arrotondamento).
 *  - `aggregateRating` e `review[]` provengono ESCLUSIVAMENTE da recensioni di
 *    fonte propria (raccolte dal sistema recensioni di DimoraSuite). Nessun dato
 *    OTA (Airbnb/Booking/Vrbo) entra qui.
 *  - `ratingValue` serializzato con separatore decimale a PUNTO ("4.94"), mai
 *    virgola, indipendentemente dal locale del server.
 *  - Campi opzionali assenti vengono OMESSI (mai null/stringa vuota).
 */

/** Una recensione di fonte propria, già validata (author + data + voto). */
export interface VacationRentalReview {
  /** Nome pubblico dell'autore (mai l'email). */
  author: string;
  /** Data di pubblicazione ISO 8601 `YYYY-MM-DD` — OBBLIGATORIA per ogni review. */
  datePublished: string;
  /** Voto 1–5 dato dall'ospite. */
  ratingValue: number;
  /** Testo della recensione (nella lingua richiesta o originale). */
  body: string;
}

/** Livello Accommodation annidato dentro `containsPlace`. */
export interface AccommodationInput {
  /** Tipo camera lato Google: "EntirePlace" | "PrivateRoom" | "SharedRoom". */
  additionalType?: string;
  numberOfBedrooms?: number;
  numberOfBathroomsTotal?: number;
  numberOfRooms?: number;
  /** Superficie: valore + unitCode UN/CEFACT (MTK = m², FTK = ft²). */
  floorSize?: { value: number; unitCode?: string };
  /** Letti: tipo + quantità → schema.org BedDetails. */
  beds?: { typeName: string; count: number }[];
  /** Servizi (nomi) → LocationFeatureSpecification con value:true. */
  amenities?: string[];
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
}

export interface PostalAddressInput {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  /** Codice paese ISO 3166-1 alpha-2 (es. "IT"). Richiesto se address è presente. */
  addressCountry: string;
}

export interface VacationRentalInput {
  // ---- REQUIRED ----
  /** Nome della listing. */
  name: string;
  /** ID stabile, content-independent, uguale tra le lingue (es. il CIN). */
  identifier: string;
  /** URL assoluti delle foto (≥8 raccomandate; <8 → warning; 0 → errore). */
  images: string[];
  /** Latitudine con piena precisione (non arrotondata). */
  latitude: number;
  /** Longitudine con piena precisione (non arrotondata). */
  longitude: number;
  /** Capienza massima ospiti → containsPlace.occupancy.value. */
  maxOccupancy: number;

  // ---- RECOMMENDED (omessi se assenti) ----
  /** `@id` stabile dell'entità: lega tra loro i blocchi VacationRental su pagine
   * diverse (identità nel layout, recensioni sulla pagina dove sono visibili). */
  id?: string;
  /** URL canonico della pagina-struttura. */
  url?: string;
  /** Categoria proprietà a livello VacationRental (es. "Apartment", "House"). */
  additionalType?: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: PostalAddressInput;
  /** Orario check-in ("HH:MM" o "HH:MM:SS", con eventuale offset). */
  checkinTime?: string;
  /** Orario check-out ("HH:MM" o "HH:MM:SS", con eventuale offset). */
  checkoutTime?: string;
  /** Lingue parlate dall'host, tag BCP-47 (es. "it", "en-US"). */
  knowsLanguage?: string[];
  /** Dettagli alloggio (containsPlace → Accommodation). */
  accommodation?: AccommodationInput;
  /** Recensioni di fonte propria (con datePublished). */
  reviews?: VacationRentalReview[];
  /** Rating aggregato di fonte propria (media + conteggio). */
  aggregateRating?: { ratingValue: number; reviewCount: number };
}

/** Errore sollevato quando manca un campo REQUIRED: interrompe il build della pagina. */
export class VacationRentalMarkupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VacationRentalMarkupError";
  }
}

// "15:00" → "15:00:00" ; "15:00:00" → invariato ; "15:00+02:00" → "15:00:00+02:00".
// Formati non riconoscibili (es. "3:00 PM", "9:5") → errore.
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?([+-]([01]\d|2[0-3]):[0-5]\d|Z)?$/;

function normalizeTime(raw: string, field: string, structure: string): string {
  const value = raw.trim();
  const m = TIME_RE.exec(value);
  if (!m) {
    throw new VacationRentalMarkupError(
      `[${structure}] ${field} non è un orario ISO 8601 valido: "${raw}". ` +
        `Usa "HH:MM" o "HH:MM:SS" (24h), es. "15:00:00".`,
    );
  }
  const [, hh, mm, , ss, offset = ""] = m;
  const seconds = ss ?? "00";
  return `${hh}:${mm}:${seconds}${offset}`;
}

/** Serializza un rating col PUNTO come separatore decimale, mai virgola. */
function ratingToString(value: number): string {
  return value.toFixed(2);
}

type JsonLd = Record<string, unknown>;

/**
 * Costruisce l'oggetto JSON-LD VacationRental. Puro: nessun I/O.
 * @throws VacationRentalMarkupError se manca un campo required.
 */
export function buildVacationRentalJsonLd(input: VacationRentalInput): JsonLd {
  const structure = input.name?.trim() || input.identifier?.trim() || "(struttura senza nome)";

  // ---- Validazione dei REQUIRED ----
  const missing: string[] = [];
  if (!input.name?.trim()) missing.push("name");
  if (!input.identifier?.trim()) missing.push("identifier");
  if (!Number.isFinite(input.latitude)) missing.push("latitude");
  if (!Number.isFinite(input.longitude)) missing.push("longitude");
  if (!Number.isFinite(input.maxOccupancy) || input.maxOccupancy <= 0)
    missing.push("maxOccupancy (containsPlace.occupancy.value)");
  const images = (input.images ?? []).filter((u) => typeof u === "string" && u.trim().length > 0);
  if (images.length === 0) missing.push("image");
  if (missing.length > 0) {
    throw new VacationRentalMarkupError(
      `[${structure}] Impossibile generare il markup VacationRental: campi obbligatori ` +
        `mancanti → ${missing.join(", ")}. La doc Google li richiede.`,
    );
  }

  // Immagini: sotto le 8 la listing è debole; sotto le 5 Google la blocca. Non
  // fallisce il build (image è presente), ma avvisa chi genera il sito.
  if (images.length < 8) {
    console.warn(
      `[VacationRental] "${structure}" ha solo ${images.length} immagini: Google ne ` +
        `raccomanda almeno 8 (sotto le 5 la listing viene bloccata). Aggiungine altre.`,
    );
  }
  if (input.latitude === 0 && input.longitude === 0) {
    console.warn(`[VacationRental] "${structure}" ha coordinate 0,0: verifica latitudine/longitudine.`);
  }

  // ---- containsPlace → Accommodation (costruito separatamente, poi linkato) ----
  const accommodation: JsonLd = {
    "@type": "Accommodation",
    occupancy: {
      "@type": "QuantitativeValue",
      value: input.maxOccupancy,
    },
  };
  const acc = input.accommodation;
  if (acc) {
    if (acc.additionalType) accommodation.additionalType = acc.additionalType;
    if (Number.isFinite(acc.numberOfBedrooms)) accommodation.numberOfBedrooms = acc.numberOfBedrooms;
    if (Number.isFinite(acc.numberOfBathroomsTotal))
      accommodation.numberOfBathroomsTotal = acc.numberOfBathroomsTotal;
    if (Number.isFinite(acc.numberOfRooms)) accommodation.numberOfRooms = acc.numberOfRooms;
    if (acc.floorSize && Number.isFinite(acc.floorSize.value)) {
      accommodation.floorSize = {
        "@type": "QuantitativeValue",
        value: acc.floorSize.value,
        unitCode: acc.floorSize.unitCode ?? "MTK",
      };
    }
    if (acc.beds && acc.beds.length > 0) {
      accommodation.bed = acc.beds
        .filter((b) => b && b.typeName && Number.isFinite(b.count) && b.count > 0)
        .map((b) => ({ "@type": "BedDetails", typeOfBed: b.typeName, numberOfBeds: b.count }));
    }
    const amenities = (acc.amenities ?? []).filter((a) => typeof a === "string" && a.trim());
    if (amenities.length > 0) {
      accommodation.amenityFeature = amenities.map((name) => ({
        "@type": "LocationFeatureSpecification",
        name,
        value: true,
      }));
    }
    if (typeof acc.petsAllowed === "boolean") accommodation.petsAllowed = acc.petsAllowed;
    if (typeof acc.smokingAllowed === "boolean") accommodation.smokingAllowed = acc.smokingAllowed;
  }

  // ---- VacationRental (livello superiore) ----
  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: input.name.trim(),
    identifier: input.identifier.trim(),
    image: images,
    latitude: input.latitude,
    longitude: input.longitude,
    containsPlace: accommodation,
  };

  if (input.id) jsonLd["@id"] = input.id;
  if (input.url) jsonLd.url = input.url;
  if (input.additionalType) jsonLd.additionalType = input.additionalType;
  if (input.description?.trim()) jsonLd.description = input.description.trim();
  if (input.telephone?.trim()) jsonLd.telephone = input.telephone.trim();
  if (input.email?.trim()) jsonLd.email = input.email.trim();

  if (input.address) {
    const a = input.address;
    const address: JsonLd = { "@type": "PostalAddress", addressCountry: a.addressCountry };
    if (a.streetAddress?.trim()) address.streetAddress = a.streetAddress.trim();
    if (a.addressLocality?.trim()) address.addressLocality = a.addressLocality.trim();
    if (a.addressRegion?.trim()) address.addressRegion = a.addressRegion.trim();
    if (a.postalCode?.trim()) address.postalCode = a.postalCode.trim();
    jsonLd.address = address;
  }

  if (input.checkinTime?.trim())
    jsonLd.checkinTime = normalizeTime(input.checkinTime, "checkinTime", structure);
  if (input.checkoutTime?.trim())
    jsonLd.checkoutTime = normalizeTime(input.checkoutTime, "checkoutTime", structure);

  const languages = (input.knowsLanguage ?? []).filter((l) => typeof l === "string" && l.trim());
  if (languages.length > 0) jsonLd.knowsLanguage = languages;

  // ---- Recensioni di fonte propria: aggregateRating + review[] ----
  // Ogni review DEVE avere datePublished (obbligatorio per VacationRental): le
  // recensioni prive di data vengono scartate a monte.
  const reviewNodes = buildReviewNodes(input.reviews);
  if (reviewNodes.length > 0) jsonLd.review = reviewNodes;
  const aggregate = buildAggregateNode(input.aggregateRating);
  if (aggregate) jsonLd.aggregateRating = aggregate;

  return jsonLd;
}

// Nodi Review (con datePublished obbligatorio, author.name, reviewRating).
function buildReviewNodes(reviews: VacationRentalReview[] | undefined): JsonLd[] {
  return (reviews ?? [])
    .filter((r) => r && r.author?.trim() && r.datePublished?.trim() && Number.isFinite(r.ratingValue))
    .map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author.trim() },
      datePublished: r.datePublished.trim(),
      reviewRating: { "@type": "Rating", ratingValue: r.ratingValue, bestRating: 5, worstRating: 1 },
      ...(r.body?.trim() ? { reviewBody: r.body.trim() } : {}),
    }));
}

function buildAggregateNode(
  agg: { ratingValue: number; reviewCount: number } | undefined,
): JsonLd | null {
  if (!agg || !Number.isFinite(agg.ratingValue) || !Number.isFinite(agg.reviewCount) || agg.reviewCount <= 0) {
    return null;
  }
  return {
    "@type": "AggregateRating",
    ratingValue: ratingToString(agg.ratingValue),
    reviewCount: agg.reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

/**
 * Blocco JSON-LD che porta SOLO aggregateRating + review[], riferito alla stessa
 * entità VacationRental tramite `@id`/`url`. Da iniettare esclusivamente nelle
 * pagine dove le recensioni sono VISIBILI (policy Google: il markup deve riflettere
 * il contenuto della pagina). Ritorna null se non ci sono recensioni pubblicate.
 */
export function buildReviewMarkup(params: {
  id: string;
  url?: string;
  name: string;
  reviews?: VacationRentalReview[];
  aggregateRating?: { ratingValue: number; reviewCount: number };
}): JsonLd | null {
  const reviewNodes = buildReviewNodes(params.reviews);
  const aggregate = buildAggregateNode(params.aggregateRating);
  if (reviewNodes.length === 0 && !aggregate) return null;

  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    "@id": params.id,
    name: params.name,
  };
  if (params.url) node.url = params.url;
  if (aggregate) node.aggregateRating = aggregate;
  if (reviewNodes.length > 0) node.review = reviewNodes;
  return node;
}

/** Serializza in stringa sicura per <script type="application/ld+json">. */
export function serializeJsonLd(jsonLd: JsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

/** `@id` stabile dell'entità VacationRental, condiviso tra i blocchi su pagine diverse. */
export function vacationRentalId(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/#vacation-rental`;
}
