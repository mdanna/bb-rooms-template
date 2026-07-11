import { getFile, putFile } from "./githubContent";
import type { DayRate, AvailabilityData } from "@/data/availability";
import { allUnits, unitsToBlockFrom } from "./structure";

// Disponibilità PER UNITÀ. Ogni unità (appartamento intero + camere) ha il suo file
// src/data/availability/<id>.json con lo stesso schema di sempre (defaultPrice +
// overrides). Sopra questo, il "layer contained": i blocchi DERIVATI dal contenimento
// (una notte occupata su un'unità collegata rende questa non prenotabile). Il layer è
// SEMPRE ricalcolato dallo stato reale delle unità collegate, mai incrementato per
// prenotazione: così se due camere occupano la stessa notte, l'appartamento resta
// bloccato finché entrambe non si liberano (niente doppio conteggio).

/** Percorso del file di disponibilità di un'unità. */
export function availPath(unitId: string): string {
  return `src/data/availability/${unitId}.json`;
}

/** Overrides senza i blocchi derivati "contained" (i dati "propri" dell'unità). */
export function stripContained(overrides: DayRate[]): DayRate[] {
  return overrides.filter((o) => o.source !== "contained");
}

/**
 * Notti "occupate" di un'unità che si propagano per contenimento: qualunque notte
 * prenotata o bloccata (status "booked"), esclusi i blocchi derivati "contained"
 * (che NON devono ri-cascatare). Include prenotazioni proprie, import OTA e blocchi manuali.
 */
export function occupiedNights(overrides: DayRate[]): Set<string> {
  const out = new Set<string>();
  for (const o of overrides) {
    if (o.status === "booked" && o.source !== "contained") out.add(o.date);
  }
  return out;
}

/**
 * IL CUORE DELLA CASCATA. Dato lo stato di occupazione "proprio" di ogni unità,
 * calcola le notti "contained" di ciascuna: l'unione delle notti occupate sulle
 * unità collegate (antenati ∪ discendenti, MAI i fratelli), meno le notti già
 * occupate in proprio (che sono già bloccate senza bisogno del derivato).
 */
export function computeContainedLayer(
  occupancyByUnit: Map<string, Set<string>>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const u of allUnits()) {
    const related = unitsToBlockFrom(u.id); // antenati ∪ discendenti
    const own = occupancyByUnit.get(u.id) ?? new Set<string>();
    const contained = new Set<string>();
    for (const otherId of related) {
      const otherNights = occupancyByUnit.get(otherId);
      if (!otherNights) continue;
      for (const night of otherNights) {
        if (!own.has(night)) contained.add(night);
      }
    }
    result.set(u.id, contained);
  }
  return result;
}

/** Costruisce le voci override "contained" (ordinate) per un insieme di notti. */
function containedEntries(nights: Set<string>, price: number): DayRate[] {
  return [...nights]
    .sort()
    .map((date) => ({ date, price, status: "booked" as const, source: "contained" as const }));
}

function mergeOwnAndContained(own: DayRate[], contained: DayRate[]): DayRate[] {
  return [...own, ...contained].sort((a, b) => a.date.localeCompare(b.date));
}

/** Confronto stabile di due liste di override (per evitare commit inutili). */
function sameOverrides(a: DayRate[], b: DayRate[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Ricalcola il layer "contained" di TUTTE le unità e scrive su GitHub solo i file
 * effettivamente cambiati. `mutatedOwn` permette di passare gli override "propri"
 * appena modificati di un'unità (es. una prenotazione appena confermata), evitando
 * una lettura-dopo-scrittura e usandoli come sorgente al posto del file su GitHub.
 */
export interface SyncContainedResult {
  // Override finali (proprio + contained) di ogni unità, per id.
  overrides: Record<string, DayRate[]>;
  // Commit sha per le sole unità effettivamente riscritte (per il toast di deploy).
  commitSha: Record<string, string | undefined>;
}

export async function syncContainedLayer(
  token: string,
  message: string,
  mutatedOwn: Record<string, DayRate[]> = {},
  defaultPriceOverride: Record<string, number> = {}
): Promise<SyncContainedResult> {
  const units = allUnits();

  // Carica lo stato corrente di ogni unità.
  const loaded = new Map<string, { defaultPrice: number; overrides: DayRate[]; sha: string }>();
  for (const u of units) {
    const { content, sha } = await getFile(availPath(u.id), token);
    const data = JSON.parse(content) as AvailabilityData;
    loaded.set(u.id, { defaultPrice: data.defaultPrice, overrides: data.overrides ?? [], sha });
  }

  // Override "propri" (con le eventuali mutazioni passate), senza il layer contained.
  const ownByUnit = new Map<string, DayRate[]>();
  const occ = new Map<string, Set<string>>();
  for (const u of units) {
    const raw = mutatedOwn[u.id] ?? loaded.get(u.id)!.overrides;
    const own = stripContained(raw);
    ownByUnit.set(u.id, own);
    occ.set(u.id, occupiedNights(own));
  }

  const contained = computeContainedLayer(occ);

  // Scrivi solo i file cambiati; restituisci gli override finali + i commit sha.
  const overrides: Record<string, DayRate[]> = {};
  const commitSha: Record<string, string | undefined> = {};
  for (const u of units) {
    const cur = loaded.get(u.id)!;
    const dp = defaultPriceOverride[u.id] ?? cur.defaultPrice;
    const own = ownByUnit.get(u.id)!;
    const next = mergeOwnAndContained(own, containedEntries(contained.get(u.id)!, dp));
    overrides[u.id] = next;
    if (dp === cur.defaultPrice && sameOverrides(next, cur.overrides)) continue;
    const { commitSha: sha } = await putFile(
      availPath(u.id),
      JSON.stringify({ defaultPrice: dp, overrides: next }, null, 2),
      cur.sha,
      `${message} — ${u.id}`,
      token
    );
    commitSha[u.id] = sha;
  }
  return { overrides, commitSha };
}
