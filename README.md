# Dimora Suite — Sito di prenotazione per B&B (template)

Sistema completo di prenotazione diretta per B&B e case vacanza. Sito pubblico multilingua, calendario con sincronizzazione multi‑OTA, pagamenti Stripe, email transazionali e pannello di amministrazione. Costruito con Next.js 16, React 19, TypeScript, Tailwind CSS v4, PostgreSQL, Stripe e Resend.

> **Onboarding passo‑passo.** Per attivare una nuova istanza da zero (dominio, DNS, email, deploy, pagamenti) esiste una **Guida al setup** dedicata, schematica e con screenshot del pannello: `Guida-Setup-Dimora-Suite.pdf`. Parte dal Passo 1 = registrazione del dominio su Cloudflare e caselle email. Questo README è il riferimento tecnico; la guida è il percorso operativo.

---

## Funzionalità

- **Sito pubblico multilingua** — 9 lingue (it, en, es, fr, de, pt, zh, ja, ko), lingua rilevata dal browser.
- **Calendario disponibilità** con **sincronizzazione multi‑OTA via iCal**: Airbnb + Booking.com + Vrbo, con rilevamento **overbooking** e promemoria delle notti da bloccare sulle altre piattaforme.
- **Flusso prenotazione**: richiesta → approvazione host → pagamento anticipo → saldo.
- **Pagamenti** con Stripe Checkout, con **switch test ↔ produzione protetto da autenticatore (TOTP)**.
- **Email transazionali** con Resend (auto‑reply ospite, notifica host, approvazione, conferma pagamento, ricevuta saldo, due promemoria saldo, cancellazione).
- **Login amministratore a due metodi**: GitHub OAuth **e** magic‑link via email.
- **Ricevuta PDF** scaricabile con dati fiscali del locatore e CIN.
- **Pannello admin** completo: calendario, policy, contenuti, immagini, tema colori, prenotazioni, dashboard, impostazioni, Stripe.
- **Tema colori personalizzabile** dal pannello, con controllo di contrasto.
- **Bottone “Prenota su…”** in home verso la piattaforma esterna preferita (Airbnb / Booking / Vrbo).
- **Tassa di soggiorno** calcolata automaticamente e mostrata in ricevuta.
- **Cancellazioni** con policy di rimborso configurabile.
- **Cron** giornaliero per i promemoria saldo (Vercel Cron).

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19 + Tailwind CSS v4 |
| Database | PostgreSQL (Neon) |
| Pagamenti | Stripe Checkout |
| Email | Resend |
| Auth | Auth.js (NextAuth) v5 — GitHub OAuth **+** magic‑link email (Resend) |
| Deploy | Vercel |
| PDF | pdf-lib |
| Test | Vitest |

---

## Struttura del progetto

```
src/
├── app/
│   ├── (site)/          # Pagine pubbliche (home, prenota, conferma, gestione, galleria, zona, …)
│   ├── admin/           # Pannello admin (calendario, policy, contenuti, immagini, tema, prenotazioni,
│   │                    #                 dashboard, impostazioni, stripe)
│   └── api/             # API routes (prenotazioni, pagamenti, webhook, cron, admin)
├── components/          # Componenti React (+ components/admin per il pannello)
├── data/                # File JSON di configurazione (versionati su GitHub)
│   ├── content.json     # Testi, foto, dati struttura
│   ├── policies.json    # Policy operative (prezzi, depositi, cancellazioni, calendari, URL annunci)
│   ├── availability.json# Prezzo base, prezzi per data, blocchi e prenotazioni (con origine OTA)
│   ├── theme.json       # 4 colori del tema
│   └── stripe.json      # Flag modalità pagamenti: { "mode": "test" | "live" }
├── i18n/                # Traduzioni pubbliche (9 lingue) + admin (it/en/es/fr)
├── lib/                 # Librerie condivise
└── tests/               # Test Vitest
```

---

## File di configurazione chiave

### `src/data/content.json`
Dati della struttura, editabili da **Contenuti**: `siteTitle` (9 lingue), `hostName`, `vatNumber` (P.IVA/CF, in ricevuta), `cin` (in footer), `address`, `phone`, `email`, `bookingEmail`, foto e testi. Le modifiche vengono committate su GitHub e ripubblicate da Vercel in 1‑2 minuti.

### `src/data/policies.json`
Policy operative, editabili da **Policy** e **Impostazioni**:
- `cityTaxPerPersonPerNight`, `cityTaxMaxNights` — tassa di soggiorno.
- `defaultDepositRate` (default `0.5`), `minDepositRate` — anticipo.
- `cancelFullRefundDays`, `cancelHalfRefundDays`, `cancelPartialRefundPct`, `cancelFeePercent` — cancellazioni.
- `balanceDueDays`, `balanceReminderDaysFirst`, `balanceReminderDaysSecond` — saldo e promemoria.
- `minAdvanceBookingDays`, `minNights`, `maxNights`, `maxGuests`, `checkinTime`, `checkoutTime`.
- `calendars: { airbnb, booking, vrbo }` — URL iCal per la sincronizzazione (impostati da **Impostazioni**). `airbnbIcalUrl` è un campo legacy di retrocompatibilità.
- `airbnbUrl`, `bookingUrl`, `vrboUrl`, `defaultBookingPlatform` — URL annuncio e piattaforma predefinita del bottone “Prenota su…”.

### `src/data/availability.json`
Prezzo base giornaliero e override per data (prezzi speciali, blocchi, prenotazioni). Ogni override porta la propria **origine** (`airbnb`/`booking`/`vrbo`/`app`/`direct`/blocco importato/blocco manuale) e i flag di conflitto per l'overbooking. Editabile da **Calendario** e aggiornato dalla sincronizzazione.

### `src/data/theme.json`
I 4 colori del tema (sfondo, testo, oro/accento, card), editabili da **Colori**.

### `src/data/stripe.json`
Flag `mode` (`"test"` o `"live"`) che seleziona test/produzione. Si commuta dalla pagina **Stripe** del pannello (protetta da TOTP); le chiavi restano solo nelle variabili d'ambiente.

---

## Flusso di una prenotazione

```
1. Ospite seleziona le date sul calendario
2. Compila il form → auto‑reply all'ospite + notifica all'host
3. Host va su /admin → approva (con prezzo, eventualmente personalizzato)
4. Ospite riceve email con link al pagamento dell'anticipo
5. Ospite paga l'anticipo via Stripe Checkout
6. Webhook Stripe → prenotazione "completed"
7. Ospite riceve conferma con ricevuta PDF e link di gestione
8. Il cron invia due promemoria saldo prima del check‑in
9. Ospite paga il saldo online o al check‑in
```

---

## Servizi esterni necessari

Riepilogo tecnico. Per il percorso ordinato e con screenshot, segui la **Guida al setup** (parte dal dominio su Cloudflare).

1. **Neon (Postgres)** — copia la connection string **pooled** (`?sslmode=require`) → `DATABASE_URL`. Lo schema si crea da solo al primo avvio (nessuna migrazione). Con l'integrazione Neon di Vercel viene iniettata `POSTGRES_URL`, che ha la precedenza.
2. **Cloudflare (dominio + DNS + email)** — registra il dominio, punta a Vercel con **A `@` → 76.76.21.21** e **CNAME `www` → cname.vercel-dns.com** (entrambi **DNS only**, proxy grigio), SSL/TLS **Full**; attiva Email Routing per `info@` e `prenotazioni@`.
3. **Resend (email)** — verifica il dominio (**SPF + DKIM + DMARC**), crea la API key → `RESEND_API_KEY`. Il mittente (`bookingEmail`) deve stare sul dominio verificato; mai `@gmail.com`.
4. **GitHub** — (a) **OAuth App** per il login → `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, callback `https://<dominio>/api/auth/callback/github`; (b) **Fine‑grained token** (Contents: Read/Write) per salvare i contenuti → `GITHUB_BOT_TOKEN` + `GITHUB_REPO_OWNER`/`NAME`/`DATA_BRANCH`.
5. **Vercel** — importa il repo, incolla le variabili, aggancia il dominio.
6. **Stripe** — chiavi test (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) e webhook su `https://<dominio>/api/stripe/webhook` (evento `checkout.session.completed`). Le chiavi live (`_LIVE`) si aggiungono al go‑live.
7. **Anthropic** *(opzionale)* — `ANTHROPIC_API_KEY` per la traduzione automatica dei contenuti.

Elenco completo e commentato delle variabili in **`.env.local.example`**.

---

## Deliverability email

SPF + DKIM **non bastano**: serve anche un record **DMARC** (`_dmarc` TXT → `v=DMARC1; p=none; …`). Il mittente deve essere sul dominio verificato in Resend. Il magic‑link di login usa lo stesso mittente (`bookingEmail`, override con `AUTH_EMAIL_FROM`). Verifica con **mail-tester.com** puntando a 10/10.

---

## Deploy su Vercel

1. **Add New → Project → Import** il repo (framework Next.js rilevato).
2. **Settings → Environment Variables** (Production): incolla tutte le variabili di `.env.local.example`. Genera `AUTH_SECRET`, `CRON_SECRET`, `TOTP_ENC_KEY` con `openssl rand -base64 33` (24 per il cron).
3. Deploy, poi **Settings → Domains** per agganciare il dominio.

Il cron in `vercel.json` esegue `/api/cron/balance-reminder` ogni giorno alle **09:00 UTC** (protetto da `CRON_SECRET`).

> `AUTH_SECRET` firma sia le sessioni admin sia i link di pagamento/gestione inviati agli ospiti: **generalo una volta e non ruotarlo**, altrimenti invalidi i link in circolazione.

---

## Pannello admin (`/admin`)

Login con **GitHub OAuth** o **magic‑link via email** (allowlist `ADMIN_GITHUB_LOGINS` e `ADMIN_EMAILS`). Sezioni (nell'ordine del menu):

- **Calendario** (`/admin`) — prezzo base, prezzi per data, blocchi, prenotazioni manuali → `availability.json`.
- **Policy** — tasse, depositi, cancellazioni, orari → `policies.json`.
- **Contenuti** — testi, contatti, recensioni (9 lingue, traduzione automatica) → `content.json`.
- **Immagini** — foto, hero e galleria → `public/images` + `content.json`.
- **Colori** — palette e 4 colori del tema, con contrasto → `theme.json`.
- **Prenotazioni** — approva, rifiuta, cancella, archivia (database).
- **Dashboard** — totali e incassi per trimestre (sola lettura, database).
- **Impostazioni** — sincronizzazione calendari OTA + URL annunci/piattaforma predefinita → `policies.json`.
- **Stripe** — switch test ↔ produzione, protetto da TOTP → `stripe.json`. *(Nascosta in modalità demo.)*

Ogni salvataggio di contenuto è un commit su GitHub che innesca il redeploy Vercel.

---

## Sincronizzazione calendari (multi‑OTA)

Configura gli URL iCal di **Airbnb / Booking.com / Vrbo** in **Impostazioni** e premi **Sincronizza ora**: le prenotazioni importate bloccano il calendario ed evitano doppie prenotazioni. Colori:

- Airbnb `#FF5A5F` · Booking.com `#003580` · Vrbo `#0D9488`
- Prenotazione dal sito (app) azzurro · diretta/manuale `#A78BFA` · blocco manuale `#DDD6FE`
- Blocco importato da un'altra OTA: grigio · **overbooking (conflitto): rosso pieno `#B3122B`**

Nota: l'iCal di Booking.com spesso non distingue prenotazione da blocco; alcuni conflitti che lo coinvolgono possono sfuggire (avviso dedicato nel pannello).

---

## Pagamenti (test ↔ produzione)

La modalità attiva è il flag `mode` in `stripe.json`, commutato dalla pagina **/admin/stripe** protetta da **TOTP** (registrazione una tantum dell'authenticator). Le chiavi vivono solo nelle env: test (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) e live (`STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`). Il passaggio a live richiede health‑check verde, spunta di conferma e un codice a 6 cifre monouso. Il webhook è unico e verifica la firma di entrambe le modalità. Carta di test: `4242 4242 4242 4242`.

---

## Ricevuta PDF

Generata da `/api/bookings/[code]/receipt` (richiede token firmato, solo per prenotazioni `completed`; per gli altri casi mostra una pagina d'errore brandizzata). Contiene dati del locatore e dell'immobile da `content.json`. Disponibile in 6 lingue (per zh/ja/ko si usa l'inglese per compatibilità font). Libreria: `pdf-lib`.

---

## Sicurezza

- Link email firmati con HMAC‑SHA256 (`AUTH_SECRET`), con scadenza.
- Webhook Stripe verificato con firma.
- Rate limiting sulle API pubbliche.
- Admin protetto da Auth.js con allowlist (GitHub username + email); magic‑link inviato solo agli indirizzi autorizzati (anti‑enumeration).
- Pagina Stripe protetta da TOTP, con codice monouso (anti‑replay) e segreto cifrabile a riposo (`TOTP_ENC_KEY`).
- Cron protetto da `CRON_SECRET`.

---

## Localizzazione

Traduzioni pubbliche in `src/i18n/locales/[locale].ts` (9 lingue); admin in `src/i18n/admin.ts` (it/en/es/fr). I contenuti pubblici provengono da `content.json` (`CONTENT.*`). I campi `L10n` sono traducibili automaticamente dal pannello via Claude AI (`ANTHROPIC_API_KEY` opzionale).

---

## Modalità demo

Impostando `DEMO_MODE=true` (+ `NEXT_PUBLIC_DEMO_MODE=true`) l'istanza diventa una demo pubblica **stateless**: nessuna scrittura su DB o GitHub (no‑op), prenotazioni finte, login con un solo pulsante. Le istanze di produzione lasciano queste variabili non impostate.

---

## Sviluppo locale

```bash
npm install
cp .env.local.example .env.local     # compila le credenziali
npm run dev
npm test                             # Vitest
```
