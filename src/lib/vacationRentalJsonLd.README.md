# Dati strutturati VacationRental + Sistema recensioni proprio

Rende ogni pagina-struttura DimoraSuite idonea al crawl di **Google Vacation
Rentals** e leggibile dai sistemi AI (Gemini, ChatGPT, Perplexity) tramite markup
`schema.org/VacationRental`, alimentato da un **sistema di recensioni di fonte
propria** (gli ospiti inviano le recensioni dal sito, l'host le modera).

> **Aspettativa realistica (non aggirarla).** Il markup è il *prerequisito
> tecnico* e dà valore SEO/AI immediato, ma **da solo NON pubblica la struttura su
> Google Vacation Rentals**. Per comparire nei rich result di Google Travel/Hotels
> serve comunque l'ammissione a **Hotel Center** con un Technical Account Manager
> di Google. Modulo di interesse Vacation Rentals:
> https://developers.google.com/hotels/hotel-prices/dev-guide/vacation-rentals-onboarding
> (o il form partner Google Travel). Fonte di verità dei campi:
> https://developers.google.com/search/docs/appearance/structured-data/vacation-rental

## Componenti

| File | Ruolo |
|---|---|
| `src/lib/vacationRentalJsonLd.ts` | Generatore **puro** e tipizzato: input normalizzato → oggetto JSON-LD. Nessun I/O. |
| `src/components/JsonLd.tsx` | Integrazione **identità-only** (nome, indirizzo, geo, containsPlace, orari, lingue) → `<script>` nel `<head>` via root layout, su **tutte** le pagine. NON contiene recensioni. |
| `src/app/(site)/recensioni/page.tsx` (`buildReviewMarkup`) | Emette un secondo blocco con `aggregateRating`+`review[]`, riferito alla stessa entità via `@id`, **solo su /recensioni** dove le recensioni sono visibili (policy Google). |
| `src/lib/reviews.ts` | Lettura recensioni pubblicate (cache `unstable_cache`, tag `reviews`) + calcolo `aggregateRating` + mapping al generatore. |
| `src/lib/db.ts` → `reviews` | Tabella Postgres delle recensioni proprie (schema idempotente). |
| `src/app/api/reviews` | Invio pubblico (form ospite) → riga `pending`. |
| `src/app/api/admin/reviews` | Moderazione (GET/PATCH/DELETE) + traduzione all'approvazione. |
| `src/app/(site)/recensioni` | Pagina pubblica: recensioni pubblicate + form di invio. |
| `src/app/admin/recensioni` | Coda di moderazione. |

## Mappatura campi: modello dati DimoraSuite → schema.org/VacationRental

Stato = classificazione **doc ufficiale Google** (può divergere da schema.org).

| Proprietà | Stato | Sorgente | Note |
|---|---|---|---|
| `name` | Required | `content.siteTitle.it` | |
| `identifier` | Required | `content.cin` → fallback `vatNumber` → host dominio | ID stabile, uguale tra lingue |
| `image[]` | Required | `heroImage` + `galleryImages` → URL assoluti | ≥8 raccomandate; <8 → warning in build; 0 → **build fallisce**. Nessun watermark/branding. |
| `latitude` / `longitude` | Required | `content.mapLat` / `mapLng` | piena precisione, non arrotondata (Google chiede ≥5 decimali) |
| `containsPlace.occupancy.value` | Required | `policies.maxGuests` | |
| `additionalType` (VacationRental) | Recommended | `"Apartment"` | categoria proprietà |
| `address` (PostalAddress) | Recommended | `content.address` (street, città rimossa), `content.city`, country `IT` | `postalCode`/`addressRegion` assenti → omessi |
| `checkinTime` / `checkoutTime` | Recommended | `policies.checkinTime` / `checkoutTime` | normalizzati a ISO 8601 `HH:MM:SS` |
| `description` | Recommended | `resolveDescription(content)` | |
| `telephone` / `email` | Recommended | `content.phone` / `content.email` | |
| `knowsLanguage[]` | Recommended | le 9 lingue del sito | |
| `containsPlace.additionalType` | Recommended | `"EntirePlace"` | |
| `containsPlace.amenityFeature[]` | Recommended | `content.amenities` → LocationFeatureSpecification | |
| `containsPlace.numberOfBedrooms` / `numberOfBathroomsTotal` / `bed` / `floorSize` | Recommended | **assenti come dati numerici strutturati** | oggi solo testo libero `details.roomInfo` → omessi. *Follow-up: aggiungere campi numerici a `content.json`.* |
| `aggregateRating` | Recommended | **calcolato dalle sole recensioni proprie pubblicate** | `ratingValue` con `.toFixed(2)` (punto, mai virgola) |
| `review[]` | Recommended | **solo recensioni proprie pubblicate** | ogni review con `datePublished` (obbligatorio), `author.name`, `reviewRating` |

### Divergenze dalla doc segnalate
- `identifier` è **Required** nella doc Google (spesso dimenticato): qui = CIN.
- `address` e `additionalType` sono **Recommended** (non Required): implementati comunque.
- `latitude/longitude`: doc chiede ≥5 decimali; usiamo piena precisione.

## Vincoli sulle recensioni (tassativi)

- **Solo fonte propria.** Le recensioni provengono esclusivamente dagli ospiti,
  raccolte dal form del sito con **consenso** (checkbox obbligatoria). **Nessun
  import/scraping/widget** da Airbnb, Booking, Vrbo o altre OTA: vietato dai loro
  termini e il testo è copyright dell'ospite/piattaforma. I vecchi campi
  `airbnbRating`/`airbnbReviewCount`/`reviews[]` di `content.json` sono stati
  **rimossi** e non entrano più nel markup.
- **`datePublished` obbligatorio** per ogni review (per VacationRental non è un
  semplice warning): le review senza data vengono scartate dal generatore.
- **`aggregateRating`** riferito **solo** alle recensioni proprie; `ratingValue`
  con separatore **punto** (`"4.94"`), mai virgola (normalizzato via `.toFixed(2)`
  a prescindere dal locale del server).
- **Consapevolezza "self-serving" (non un bug).** Le recensioni della propria
  struttura sul proprio sito sono *self-serving* per Google (VacationRental è
  sottotipo di LocalBusiness): **non** produrranno le stelle nei rich result della
  ricerca organica. Restano preziose come contenuto di pagina e per i sistemi AI.
  Le recensioni OTA possono comparire su GVR **solo** tramite l'aggregazione
  ufficiale di un connectivity partner/Hotel Center, non via questo markup.

## Flusso recensione

1. Ospite → form su `/recensioni` (nome, stelle 1–5, testo, mese soggiorno,
   codice prenotazione opzionale, email opzionale privata, **consenso**).
2. `POST /api/reviews`: validazione + rate-limit; se il codice prenotazione
   combacia con una prenotazione reale (stessa email) → `verified=true`. Salvata
   come `pending`. Notifica email all'host. In demo: no-op.
3. Host → `/admin/recensioni`: **Pubblica** (traduce nelle 9 lingue e fissa
   `published_at`), **Rifiuta**, **Elimina**.
4. Solo le `published` compaiono in pagina e nel markup.

## Conformità legale (UE / Italia)

Il sistema è pensato perché le recensioni siano **pubblicabili in regola**:
- **Consenso** (GDPR): checkbox obbligatoria; il testo dichiara la pubblicazione
  sul sito **e nei motori di ricerca** (visibilità a terzi). Solo `consent=true`
  viene pubblicato. L'ospite può revocare → **cancellazione** dall'admin (oblio).
- **Email privata**: usata solo per la verifica del soggiorno, mai pubblica né nel
  markup.
- **Trasparenza (dir. Omnibus / Cod. Consumo art. 22-bis)**: nota in pagina
  (`t.reviews.transparency`) che spiega che le recensioni vengono da ospiti reali,
  moderate manualmente, senza recensioni acquistate/OTA e senza rimuovere i
  negativi autentici.
- **Privacy policy**: sezione «Recensioni» descrive dati, base giuridica (consenso)
  e diritto di cancellazione.
- **Moderazione**: rifiutare **solo** spam/offese/fuori-tema. Nascondere
  selettivamente le recensioni negative autentiche è **vietato** dall'Omnibus
  (avviso ripetuto nell'intro del pannello `/admin/recensioni`).
- **No markup dove non visibile**: le recensioni entrano nel markup solo sulla
  pagina dove sono a schermo (`/recensioni`), non site-wide (policy Google).

## Parità prezzo pagina ↔ dati (Price Accuracy Score)

Il prezzo notte deriva da `availability.json` (`defaultPrice` + override) ed è la
**stessa** sorgente usata da calendario/preventivo pubblico e dalle email. Il
markup VacationRental **non** dichiara un prezzo (evita disallineamenti); quando
Google introdurrà il Price Accuracy Score, il prezzo on-page combacia già con i
dati perché ha un'unica sorgente.

## Checklist di validazione

1. **Rich Results Test** — https://search.google.com/test/rich-results su una
   pagina-struttura in produzione: 0 errori. (In locale: copia l'output di
   `buildVacationRentalJsonLd` o il `<script>` renderizzato.)
2. **URL Inspection** in Search Console sulla pagina reale (indicizzabilità).
3. **Report "Vacation rental"** dei rich result in Search Console (monitoraggio).
4. **robots.txt Tester** di Google: Googlebot e Googlebot-Image non bloccati.
5. **Parità prezzo** pagina ↔ dati (unica sorgente `availability.json`).
6. **Invio sitemap** in Search Console (vedi sotto).
7. Ricorda: l'apparizione su **GVR richiede Hotel Center + TAM** (link in cima).

## Sitemap

`src/app/sitemap.ts` genera una **sitemap di URL** (non un sitemap index) che
include la pagina-struttura (radice) come URL principale. Invio manuale: Search
Console → *Sitemap* → `https://<dominio>/sitemap.xml`. Per l'hub multi-struttura
(portale) la sitemap enumera un URL per struttura.

## Test

`src/tests/vacationRentalJsonLd.test.ts` (generatore: required, annidamento
containsPlace→Accommodation, ISO 8601, min immagini, `datePublished` per review,
punto decimale, snapshot) e `src/tests/crawlability.test.ts` (robots non blocca
Googlebot/-Image, nessun `noindex` sulle pagine-struttura). Esegui: `npm test`.
