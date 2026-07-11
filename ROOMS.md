# Struttura con camere — specifica

Terzo tipo di oggetto oltre a **sito** (una sola unità affittabile) e **portale**
(directory di URL). Modella un appartamento che contiene uno spazio comune e delle
camere, affittabili **sia singolarmente sia come intero**.

## Decisioni fondanti (confermate)

1. **App unica con unità interne.** Un solo deployment / DB / account Stripe / pannello
   admin. Appartamento e camere sono "unità" interne, ciascuna con calendario, prezzi,
   contenuti e flusso di prenotazione propri. Il blocco reciproco dei calendari è
   **atomico** su un solo DB — niente sincronizzazione distribuita tra deployment.
2. **Repo dedicato** `bb-rooms-template` (derivato da `bb-template`). Fuori dalla
   propagazione rsync della flotta → le modifiche comuni vanno coordinate a mano.
3. **Camere indipendenti tra loro**, bloccano solo ↔ appartamento. Albero di
   contenimento a 1 livello (1 intero → N camere); il codice regge alberi generici.
4. **Policy/deposito/tassa di soggiorno condivise** a livello struttura (un set unico).
5. **Ogni unità ha inserzioni OTA proprie** → import iCal per unità **e** export iCal
   per unità con **blocco a cascata** (se l'appartamento è preso, la camera risulta
   occupata sul suo Airbnb, e viceversa).
6. **Nel portale = una scheda** che apre l'hub della struttura (il portale resta una
   directory di URL; non conosce la gerarchia interna).

## Modello dati

- `src/data/structure.json` + `src/lib/structure.ts` — l'oggetto (**solo topologia**,
  niente contenuti). `Unit { id, kind ("whole"|"room"), name: L10n, slug, bookable?,
  contains? }`. Helper di contenimento: `relatedUnitIds(id)` = `self ∪ antenati ∪
  discendenti` (mai i fratelli) — il cuore della sincronizzazione dei calendari.
  `bookable` (default true): un "whole" con `bookable:false` è un mero **contenitore**
  (non prenotabile, serve solo a raggruppare/propagare i blocchi). Le "room" sono
  sempre affittabili.
- **Contenuti**: `src/data/content/<id>.json` per ogni unità (riusa lo schema
  `content.json`: titolo, galleria, servizi, prezzo, capienza…) + `content-shared.json`
  per la struttura (città, indirizzo, zona/mappa, host, P.IVA/CIN, email di prenotazione).
- **Calendario per unità**: `src/data/availability/<id>.json` (schema invariato:
  `defaultPrice` + `overrides`), uno per unità invece del singolo `availability.json`.
- **DB**: `bookings` guadagna `unit_id TEXT`. `hasOverlappingBooking()` diventa
  consapevole del contenimento: conflitto se una notte è occupata sull'unità **o su un
  suo antenato/discendente** (`relatedUnitIds`).
- **Blocco a cascata**: nuova `DaySource "contained"` — blocco derivato, non editabile,
  ricalcolato quando cambia un'unità collegata. Alimenta calendario pubblico ed export iCal.

## Ripartizione condiviso / per-unità

| Ambito | Livello |
|---|---|
| Stripe, tema, accessi admin, email (modello D), policy/deposito/tassa | **Struttura** (condiviso) |
| Calendario, prezzi, contenuti/foto, URL iCal OTA, flusso prenotazione | **Per-unità** |

## Rotte pubbliche

- `/` → dipende dal flag `bookable` dell'unità radice (l'intero):
  - intero **prenotabile** → flusso dell'appartamento intero, con in cima un
    selettore "oppure prenota una singola camera";
  - intero **contenitore** (`bookable:false`) → landing che presenta la casa ed
    elenca solo le camere (nessun flusso "intero").
- `/camera/<slug>` → flusso singola camera.
- `/api/ical/<id>.ics` → export iCal per unità (con blocchi "contained").

## Ordine di costruzione

- [x] **0. Oggetto**: `structure.json` + `structure.ts` (modello + contenimento). ✅ verificato.
- [x] **1. Calendari per unità**: `availability/<id>.json`, `unitAvailability.ts` (path +
      layer "contained"), `syncAvailability.ts` unit-aware, API `/api/availability?unit=<id>`. ✅
- [x] **2. DB + overlap con contenimento**: colonna `bookings.unit_id`,
      `hasOverlappingBooking` esteso a `relatedUnitIds`, creazione prenotazione + tutti i
      chiamanti (approve/cancel/guest-cancel/confirm-session/webhook) passano l'unità;
      il blocco "contained" è ricalcolato a cascata da `syncContainedLayer`. ✅ tsc 0, 195 test verdi.
- [x] **3. Import + export iCal per unità**: URL OTA per-unità in `policies.unitCalendars`
      (`calendarUrlsForUnit`, fallback radice→`calendars`); `/api/admin/calendar-sync?unit=<id>`
      riusa `reconcile` (stessa logica dei siti) sul calendario dell'unità, poi
      `syncContainedLayer` applica la cascata (una prenotazione OTA su una camera blocca
      l'appartamento). Export pubblico `/api/ical/<id>` (+ `.ics`) = notti occupate
      **incluse le "contained"** → l'inserzione della camera si blocca quando l'intero è
      preso. ✅ tsc 0, 199 test (nuovo `icalExport.test.ts`), route verificate live.
      *Resta l'UI admin* per editare gli URL per-unità e mostrare il link di export → liv.5.
- [x] **4. Pubblico**: contenuti per unità (`content/<id>.json` + `unitContent.ts`,
      base condivisa + override camera); `AvailabilityCalendar`/`BookingForm` con prop
      `unitId`; `UnitSwitcher` su home/prenota/camera; pagina `/camera/[slug]`. ✅
      Verificato live (curl SSR+API): home mostra il selettore, camere 200 con contenuti
      propri, slug inesistente 404, `/api/availability?unit=` per-unità corretto. tsc 0, 195 test.
      *Nota:* la mappa camere in `unitContent.ts` è per ora esplicita (2 camere d'esempio);
      il wizard la genererà. Variante "landing sole camere" (root `bookable:false`) non
      ancora resa sulla home (la home assume intero prenotabile).
- [x] **5. Admin (essenziale)**: `AdminUnitSwitcher` (schede unità, `?unit=<id>`);
      calendario/prezzi per unità (`/admin?unit=`, `AdminEditor` unit-aware, `/api/admin/save?unit=`
      scrive il layer proprio + ricalcola la cascata); OTA per unità in Impostazioni
      (`SettingsManager` con selettore, `/api/admin/settings?unit=`, sync `?unit=`, link di
      export `/api/ical/<id>`); etichetta unità sulle prenotazioni (`BookingsManager`).
      Condivisi restano struttura-level: Stripe/tema/accessi/policy. ✅ tsc 0, 199 test;
      pagine admin renderizzano (login/redirect corretti), API guardate (401).
      *Click-through completo dell'admin non fatto (auth-gated) → fase di revisione.*
- [x] **5b. Contenuti + Immagini per unità**: selettore unità in `/admin/contenuti` e
      `/admin/immagini`. Appartamento (radice) → `content.json`, tutte le schede. Camera →
      solo Testi+Servizi su `content/<id>.json` (API `/api/admin/content?unit=` con vista
      merge in GET e salvataggio del solo sottoinsieme in POST). Copertina/galleria/ordine
      per-unità; pool immagini condiviso; la delete immagine ripulisce i riferimenti in
      TUTTE le unità. ✅ tsc 0, lint 0, build, 199 test; pagine 307/redirect corrette.
      *Rimandato:* home "sola landing camere" quando la radice è `bookable:false`.
- [ ] **6. Portale**: assegnazione di una struttura a un portale come singola scheda (hub).
- [ ] **7. Wizard**: `bb-wizard` crea una struttura con camere (numero camere, slug, provisioning).
- [ ] **8. Sito d'esempio**: istanza dimostrativa completa.
