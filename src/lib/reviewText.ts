// Modulo PURO (nessun import server/client): usabile sia nei componenti client sia lato server.

/**
 * Normalizza il testo di una recensione per la visualizzazione. Le traduzioni automatiche
 * a volte introducono la sequenza LETTERALE `\n` (due caratteri: backslash + n) invece di
 * un vero a-capo: senza questa pulizia comparirebbe "\n" nel testo. Convertiamo quei `\n`
 * letterali in spazi e compattiamo gli spazi, così il testo scorre pulito sia in pagina sia
 * nel markup schema.org. (Il testo originale ne è privo; il problema è solo nelle traduzioni.)
 */
export function cleanReviewText(s: string): string {
  return s.replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
}
