// ⚠️ SOLO SERVER — non importare da componenti client.
// Contiene il TOKEN DI APPARTENENZA al portale (portal-link-token.json), che NON
// deve mai finire nel bundle client. Lo importano soltanto le route server
// (api/admin/content, api/admin/portal-link, api/admin/portal-unlink).
//
// Al salvataggio dei contenuti la struttura notifica il portale con i META FRESCHI
// della propria scheda (nome/città/descrizione/copertina), così il teaser nel portale
// si aggiorna SUBITO — senza che il portale rilegga il sito (che sarebbe ancora al
// deployment precedente). Best-effort: non blocca né fa fallire il salvataggio.

import { resolveDescription, type SiteContent } from "@/lib/siteContent";
import { PORTAL_LINK } from "@/lib/portalLink";
import tokenData from "@/data/portal-link-token.json";

const MEMBER_TOKEN = ((tokenData as { token?: string }).token ?? "").trim();
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

function pickL10n(m: unknown): string {
  if (m && typeof m === "object") {
    const o = m as Record<string, string>;
    return (o.it || Object.values(o).find(Boolean) || "").trim();
  }
  return typeof m === "string" ? m.trim() : "";
}

/** Meta della scheda-portale calcolati dai contenuti della struttura (come gli og:). */
export function cardMeta(content: SiteContent): {
  name: string;
  city: string;
  description: string;
  image: string;
} {
  const name = pickL10n(content.siteTitle) || SITE_URL;
  const city = typeof content.city === "string" ? content.city.trim() : "";
  const description = resolveDescription(content);
  const image = content.heroImage && SITE_URL ? `${SITE_URL}/images/${content.heroImage}` : "";
  return { name, city, description, image };
}

/**
 * Notifica il portale (se la struttura è collegata E ha un token di appartenenza)
 * con i meta freschi della scheda. Silenziosa e non bloccante: se il portale non
 * risponde, il teaser si aggiornerà al prossimo salvataggio o via "↻ dal sito".
 */
export async function notifyPortalCard(content: SiteContent): Promise<void> {
  const portal = PORTAL_LINK.url.replace(/\/+$/, "");
  if (!portal || !MEMBER_TOKEN) return;
  try {
    await fetch(`${portal}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: MEMBER_TOKEN, meta: cardMeta(content) }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* portale non raggiungibile ora: nessun problema, riprova al prossimo salvataggio */
  }
}
