import rawStructure from "@/data/structure.json";
import type { LocaleCode } from "@/i18n/types";
import { localeOrder } from "@/i18n/index";
import { CONTENT } from "./siteContent";

// ─────────────────────────────────────────────────────────────────────────────
// LA STRUTTURA CON CAMERE — il modello dell'oggetto.
//
// A differenza del "sito" (una sola unità affittabile) e del "portale" (una
// directory di URL), la struttura con camere è UNA SOLA app che modella più
// "unità" interne: l'appartamento intero + le singole camere. Tutte le unità
// condividono lo stesso deployment, lo stesso DB, lo stesso account Stripe e lo
// stesso pannello admin (con un selettore di unità). Ogni unità ha però un
// calendario, un prezzo, dei contenuti e un flusso di prenotazione PROPRI.
//
// Le unità formano un ALBERO DI CONTENIMENTO: l'appartamento "contiene" le
// camere. Da qui la regola di sincronizzazione dei calendari:
//   - se una camera è prenotata → l'appartamento intero non è prenotabile;
//   - se l'appartamento è prenotato → nessuna camera è prenotabile.
// Le camere sorelle sono invece INDIPENDENTI tra loro (prenotare Rosa non
// tocca Blu). Vedi relatedUnitIds(): self ∪ antenati ∪ discendenti, MAI i
// fratelli. Il modello è un albero generico (regge annidamenti più profondi),
// anche se lo use case e la UI assumono un livello: 1 intero → N camere.
// ─────────────────────────────────────────────────────────────────────────────

// Testo localizzato: mappa lingua → stringa (come CONTENT.siteTitle nei siti e
// L10n nel portale). Le lingue mancanti ricadono su defaultLocale (vedi pick()).
export type L10n = Partial<Record<LocaleCode, string>>;

// "whole" = un'unità che ne contiene altre (l'appartamento intero).
// "room"  = un'unità foglia affittabile (una camera).
export type UnitKind = "whole" | "room";

export interface Unit {
  // Identificatore stabile e immutabile: chiave per i calendari (availability/<id>.json),
  // per la colonna bookings.unit_id, per i feed iCal (/api/ical/<id>.ics) e per i
  // riferimenti tra unità. NON cambia se rinomini l'unità.
  id: string;
  kind: UnitKind;
  // Nome mostrato (localizzato): "Intero appartamento", "Camera Rosa"…
  name: L10n;
  // Rotta pubblica. "" = unità radice → "/". Altrimenti la camera vive su
  // "/camera/<slug>". Adatto a un URL (a-z, 0-9, trattini).
  slug: string;
  // Solo su kind "whole": gli id delle unità direttamente contenute.
  contains?: string[];
  // Se l'unità è affittabile (ha un suo flusso di prenotazione + pagamento).
  // Default true. Un "whole" con bookable:false è un mero CONTENITORE: non si
  // prenota, serve solo a raggruppare e a propagare i blocchi tra le camere.
  // In quel caso "/" non mostra il flusso dell'intero ma una landing che elenca
  // le camere. Le "room" sono sempre affittabili.
  bookable?: boolean;
}

export interface Structure {
  // Nome della struttura nel suo insieme (l'edificio/casa), mostrato nell'hub.
  structureTitle: L10n;
  // Lingua principale: punto di partenza server-side e fallback dei testi L10n.
  defaultLocale: LocaleCode;
  units: Unit[];
}

// --- Normalizzazione + retro-compatibilità -----------------------------------

function isLocale(v: unknown): v is LocaleCode {
  return typeof v === "string" && (localeOrder as string[]).includes(v);
}

/** Converte una stringa semplice o un oggetto {lingua:testo} in una mappa L10n. */
export function toL10n(v: unknown, base: LocaleCode): L10n {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: L10n = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (isLocale(k) && typeof val === "string") out[k] = val;
    }
    return out;
  }
  if (typeof v === "string" && v.trim()) return { [base]: v } as L10n;
  return {};
}

function normalizeUnit(raw: unknown, base: LocaleCode): Unit | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id) return null;
  const kind: UnitKind = r.kind === "whole" ? "whole" : "room";
  const contains =
    kind === "whole" && Array.isArray(r.contains)
      ? (r.contains as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim())
      : undefined;
  // Le camere sono sempre affittabili; un "whole" può essere un contenitore
  // (bookable:false esplicito). Default: affittabile.
  const bookable = kind === "room" ? true : r.bookable !== false;
  return {
    id,
    kind,
    name: toL10n(r.name, base),
    slug: typeof r.slug === "string" ? r.slug.trim() : "",
    bookable,
    ...(contains && contains.length ? { contains } : {}),
  };
}

export function normalizeStructure(raw: unknown): Structure {
  const r = (raw ?? {}) as Record<string, unknown>;
  const base: LocaleCode = isLocale(r.defaultLocale) ? r.defaultLocale : "it";
  const units = Array.isArray(r.units)
    ? (r.units.map((u) => normalizeUnit(u, base)).filter(Boolean) as Unit[])
    : [];
  return {
    structureTitle: toL10n(r.structureTitle, base),
    defaultLocale: base,
    units,
  };
}

export const STRUCTURE: Structure = normalizeStructure(rawStructure);

// --- Accessori sulle unità ---------------------------------------------------

export function allUnits(s: Structure = STRUCTURE): Unit[] {
  return s.units;
}

/** Un'unità è affittabile se ha un suo flusso di prenotazione (bookable !== false). */
export function isBookable(u: Unit): boolean {
  return u.bookable !== false;
}

/**
 * Nome LOCALIZZATO di ciò che si sta prenotando (per le email): l'appartamento
 * intero o una camera. Ritorna "" per un sito a unità singola (niente da
 * disambiguare). unit_id NULL/ignoto ricade sull'unità radice.
 */
export function unitLabel(
  unitId: string | null | undefined,
  locale: LocaleCode,
  s: Structure = STRUCTURE
): string {
  if (s.units.length <= 1) return "";
  const u = getUnit(unitId ?? rootUnitId(s), s) ?? getUnit(rootUnitId(s), s);
  if (!u) return "";
  // Unità INTERA (radice): il nome è il TITOLO dell'appartamento (content.siteTitle), non
  // l'etichetta generica "Intero appartamento". Le camere usano il proprio nome. Così
  // "cosa prenoti" nelle email e lo switcher mostrano il nome vero dell'appartamento.
  if (u.id === rootUnitId(s)) {
    const title = CONTENT.siteTitle[locale] || CONTENT.siteTitle.it || Object.values(CONTENT.siteTitle).find(Boolean);
    if (title) return title;
  }
  return u.name[locale] || u.name.it || u.id;
}

/** Le sole unità affittabili: quelle con un flusso di prenotazione/pagamento. */
export function bookableUnits(s: Structure = STRUCTURE): Unit[] {
  return s.units.filter(isBookable);
}

export function getUnit(id: string, s: Structure = STRUCTURE): Unit | undefined {
  return s.units.find((u) => u.id === id);
}

/** Unità corrispondente a una rotta pubblica (slug ""=radice/appartamento intero). */
export function unitBySlug(slug: string, s: Structure = STRUCTURE): Unit | undefined {
  return s.units.find((u) => u.slug === slug);
}

/** Id dei figli diretti di un'unità (vuoto per le camere). */
export function childIds(id: string, s: Structure = STRUCTURE): string[] {
  return getUnit(id, s)?.contains ?? [];
}

/** Id del genitore diretto di un'unità (l'appartamento che la contiene), se esiste. */
export function parentId(id: string, s: Structure = STRUCTURE): string | undefined {
  return s.units.find((u) => u.contains?.includes(id))?.id;
}

/** Unità radice: quelle che nessun'altra contiene (di norma il solo appartamento intero). */
export function rootUnits(s: Structure = STRUCTURE): Unit[] {
  const contained = new Set(s.units.flatMap((u) => u.contains ?? []));
  return s.units.filter((u) => !contained.has(u.id));
}

/**
 * Id dell'unità radice: l'appartamento intero. Usato come default per le
 * prenotazioni prive di unità (retro-compatibilità) e per la rotta "/".
 */
export function rootUnitId(s: Structure = STRUCTURE): string {
  return (rootUnits(s)[0] ?? s.units[0])?.id ?? "";
}

/** Tutti gli antenati (genitore, nonno, …) risalendo l'albero. */
export function ancestorIds(id: string, s: Structure = STRUCTURE): string[] {
  const out: string[] = [];
  let cur = parentId(id, s);
  const guard = new Set<string>(); // anti-ciclo su dati malformati
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    out.push(cur);
    cur = parentId(cur, s);
  }
  return out;
}

/** Tutti i discendenti (figli, nipoti, …) scendendo l'albero. */
export function descendantIds(id: string, s: Structure = STRUCTURE): string[] {
  const out: string[] = [];
  const stack = [...childIds(id, s)];
  const guard = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (guard.has(cur)) continue; // anti-ciclo
    guard.add(cur);
    out.push(cur);
    stack.push(...childIds(cur, s));
  }
  return out;
}

/**
 * IL CUORE DELLA SINCRONIZZAZIONE. Insieme delle unità il cui calendario è
 * toccato quando `id` viene prenotato (direttamente o importato da una sua OTA):
 * l'unità stessa + i suoi antenati + i suoi discendenti — MAI i fratelli.
 * Ogni notte prenotata su `id` va riflessa come blocco derivato ("contained")
 * su tutte le ALTRE unità di questo insieme: alimenta il calendario pubblico e
 * l'export iCal degli altri livelli (così Airbnb della camera si blocca quando
 * l'appartamento è preso, e viceversa).
 */
export function relatedUnitIds(id: string, s: Structure = STRUCTURE): string[] {
  return [id, ...ancestorIds(id, s), ...descendantIds(id, s)];
}

/** Come relatedUnitIds ma senza l'unità stessa: gli id su cui propagare il blocco. */
export function unitsToBlockFrom(id: string, s: Structure = STRUCTURE): string[] {
  return [...ancestorIds(id, s), ...descendantIds(id, s)];
}
