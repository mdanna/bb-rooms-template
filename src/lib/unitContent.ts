import { CONTENT, type SiteContent } from "./siteContent";
import { rootUnitId, getUnit } from "./structure";
import rosaRaw from "@/data/content/camera-rosa.json";
import bluRaw from "@/data/content/camera-blu.json";

// Contenuti PER UNITÀ. content.json resta la base CONDIVISA + l'appartamento intero
// (unità radice): luogo, indirizzo, host, zona, mappa, recensioni, contatti… I file
// content/<id>.json contengono solo i campi SPECIFICI di ogni camera (titolo, foto,
// sottotitolo, descrizione, servizi), sovrapposti alla base. Così una camera eredita
// tutto ciò che è condiviso e ridefinisce solo ciò che le è proprio.
//
// NB: la mappa qui è specifica dell'istanza (le camere di QUESTA struttura). Il wizard
// che crea una struttura con camere genererà questo elenco insieme a structure.json.
const UNIT_OVERRIDES: Record<string, Partial<SiteContent>> = {
  "camera-rosa": rosaRaw as Partial<SiteContent>,
  "camera-blu": bluRaw as Partial<SiteContent>,
};

/**
 * Contenuti effettivi di un'unità: la base condivisa (l'appartamento) con sopra le
 * sovrascritture specifiche dell'unità. L'unità radice usa direttamente content.json.
 */
export function getUnitContent(unitId: string): SiteContent {
  if (unitId === rootUnitId() || !getUnit(unitId)) return CONTENT;
  const override = UNIT_OVERRIDES[unitId];
  if (!override) return CONTENT;
  return { ...CONTENT, ...override };
}
