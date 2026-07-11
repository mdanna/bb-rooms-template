# Architettura della flotta Dimora Suite

Come un unico core condiviso convive con tante personalizzazioni per-sito.

## Le tre zone di ogni sito

| Zona | Dove | Propagata dal template? |
|---|---|---|
| **Core** | `src/` (tutto tranne le due righe sotto) | **Sì** — è il prodotto comune, aggiornabile |
| **Config** | `src/data/*.json` (`content`, `policies`, `availability`, `theme`, `stripe`) + env Vercel | **No** — la cambia il proprietario dal pannello admin |
| **Override** | `src/custom/**` | **No** — codice su misura del singolo sito |

`src/data/*.json` e `src/custom/**` sono marcati `merge=local` in `.gitattributes`:
durante un update dal template si mantiene **sempre** la versione locale del sito.
Nota: `src/data/availability.ts` è **codice** (non `.json`) → fa parte del core e si propaga.

## Come nasce un sito

`bb-wizard` crea il repo del cliente dal template (`gh repo create --template`),
poi lo **collega** al template:

```
git config merge.local.driver true          # abilita il driver "keep-local"
git remote add upstream <bb-template>        # collega al template
git merge -s ours --allow-unrelated-histories upstream/main   # base di storia condivisa
```

Il merge `-s ours` **non cambia i file**: stabilisce solo una base comune, così i
futuri update sono merge a 3 vie puliti (applicano solo le novità del template).
Il cliente viene registrato in `bb-wizard/clients.json`.

Un sito già esistente si collega una volta con: `npm run link -- <cartella>` (in `bb-wizard`).

## Come si propaga una fix comune

1. Sviluppi la fix **nel template** (`bb-template`).
2. `bb-wizard update` la porta su ogni sito del manifest (fetch del template →
   merge del **core** → i path per-sito restano quelli locali → push → redeploy),
   in modo robusto: vedi «Requisiti del comando update».
3. I siti nuovi la ricevono già alla creazione.

Dove hai personalizzato le stesse righe del core, il merge segnala un **conflitto**
da risolvere invece di sovrascrivere: le modifiche locali non si perdono mai.

## Requisiti del comando `update` (per non perdere dati)

Il merge dal template ha spigoli precisi: il comando `update` DEVE, per ogni sito:

- **abilitare il driver prima del merge**: `git config merge.local.driver true`.
  È config **locale** (non si clona): un clone fresco senza questa riga scriverebbe
  marker di conflitto dentro i `.json` invece di tenere la versione del sito.
- **usare il ramo del template rilevato**, non `main` fisso (potrebbe essere `master`).
- fondere con **`-Xno-renames`**: un rename di un `*.json` nel template, altrimenti,
  sposterebbe i dati del sito su un path che l'app non legge → sito rotto.
- dopo il merge, **ripristinare esplicitamente** i path per-sito alla versione locale.
  Serve un **doppio passo** (né `git restore` né `git checkout HEAD --` da soli risolvono i
  conflitti *modify/delete*: se il sito ha rinominato le proprie foto, le demo che il template
  modifica diventano *deleted-by-us* e restano `unmerged`):

  ```
  git rm -rf --ignore-unmatch -- ':(glob)src/data/*.json' src/custom public/images
  git checkout HEAD             -- ':(glob)src/data/*.json' src/custom public/images
  ```

  Il primo azzera il pathspec (stage di conflitto + add del template + file nuovi), il secondo
  ripristina **solo** ciò che esiste in HEAD → le foto/`.json` d'esempio del template non restano
  nel sito. NB: solo `src/data/*.json` (non tutta `src/data/`), così `src/data/defaults/` e
  `src/data/availability.ts` (codice) continuano a propagarsi dal template.
- offrire **`--dry-run`** (diff/conflitti senza scrivere) e agire **per-sito**.

## Regole per non rompere la propagazione

- **Non rinominare né spostare** i file `src/data/*.json` nel template.
- **Non aggiungere** nuovi `src/data/*.json` di default nel core: verrebbero ereditati
  da tutti i siti col valore del template. Aggiungi i nuovi campi ai `.json` esistenti
  (protetti da `merge=local`), oppure materializza i default al `create`
  (es. da `src/data/defaults/`).
- Preferisci sempre **config-over-code**: se una variazione può diventare un campo in
  `src/data/*.json` (modificabile dal pannello), mettila lì, non in `src/custom/`.

## Regola d'oro

Una modifica **fatta dentro un sito** non risale al template. Solo ciò che scrivi
**nel template** è propagabile. Prima di forkare il codice in `src/custom/`,
chiediti se la variazione può diventare **configurazione** (`src/data/*.json`):
se sì, aggiungila al core come opzione — così la capacità arriva a tutta la flotta.
