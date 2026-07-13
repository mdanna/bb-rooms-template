import { CONTENT, type SiteContent } from "./siteContent";
import { rootUnitId, getUnit } from "./structure";
import { getFile, requireBotToken } from "./githubContent";

// Contenuti PER UNITÀ. content.json resta la base CONDIVISA + l'appartamento intero
// (unità radice): luogo, indirizzo, host, zona, mappa, recensioni, contatti… I file
// content/<id>.json contengono solo i campi SPECIFICI di ogni camera (titolo, foto,
// sottotitolo, descrizione, servizi), sovrapposti alla base. Così una camera eredita
// tutto ciò che è condiviso e ridefinisce solo ciò che le è proprio.
//
// I contenuti della camera si leggono DINAMICAMENTE per path (come la disponibilità in
// unitAvailability), non da import statici: l'insieme delle camere NON è cablato nel
// codice, quindi aggiungere o togliere una camera dal pannello non richiede modifiche qui.

/**
 * Contenuti effettivi di un'unità: la base condivisa (l'appartamento) con sopra le
 * sovrascritture specifiche dell'unità. L'unità radice usa direttamente content.json.
 * Async: legge content/<id>.json via getFile (GitHub in prod, filesystem in demo).
 */
export async function getUnitContent(unitId: string): Promise<SiteContent> {
  if (unitId === rootUnitId() || !getUnit(unitId)) return CONTENT;
  try {
    const { content } = await getFile(`src/data/content/${unitId}.json`, requireBotToken());
    if (!content) return CONTENT;
    const override = JSON.parse(content) as Partial<SiteContent>;
    return { ...CONTENT, ...override };
  } catch {
    // File assente (camera senza contenuti propri) o illeggibile → usa la base condivisa.
    return CONTENT;
  }
}
