import ScriviClient from "./ScriviClient";

// Pagina dedicata alla scrittura di una recensione. Resta crawlabile come tutte le altre
// pagine pubbliche (site), senza metadata robots (invariante di crawlability del progetto).
// Il link dall'email post-soggiorno porta ?code=<prenotazione>&t=<token firmato>: precompiliamo
// il codice e passiamo il token, così la recensione risulta "soggiorno verificato".
export default async function ScriviRecensionePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; t?: string }>;
}) {
  const { code, t } = await searchParams;
  return <ScriviClient prefillCode={code ?? null} token={t ?? null} />;
}
