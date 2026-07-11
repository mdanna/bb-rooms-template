import raw from "@/data/portal-link.json";

// Appartenenza a un portale multi-struttura. Scritta da src/data/portal-link.json
// (impostato dall'handshake in /admin/collega-portale, di proprietà del sito).
// Fallback all'env NEXT_PUBLIC_PORTAL_URL/_NAME per i setup manuali precedenti.
// Vuoto = struttura singola → nessun link al portale.
export interface PortalLink {
  url: string;
  name: string;
}

const data = raw as Partial<PortalLink>;

export const PORTAL_LINK: PortalLink = {
  url: (data.url && data.url.trim()) || process.env.NEXT_PUBLIC_PORTAL_URL || "",
  name: (data.name && data.name.trim()) || process.env.NEXT_PUBLIC_PORTAL_NAME || "",
};
