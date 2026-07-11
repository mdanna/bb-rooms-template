import { CONTENT } from "@/lib/siteContent";
import { POLICIES } from "@/lib/policies";
import type { OtaPlatform } from "@/data/availability";

const PLATFORM_NAME: Record<OtaPlatform, string> = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo" };

export interface BookingLink {
  platform: OtaPlatform;
  url: string;
  name: string;
}

// URL pubblici degli annunci OTA, tutti gestiti in Impostazioni (policies).
// `airbnb` legge in fallback il vecchio `content.airbnbUrl` finché non è salvato
// nei settings, così la migrazione è trasparente.
export function listingUrls(): Record<OtaPlatform, string> {
  return {
    airbnb: (POLICIES.airbnbUrl ?? CONTENT.airbnbUrl ?? "").trim(),
    booking: (POLICIES.bookingUrl ?? "").trim(),
    vrbo: (POLICIES.vrboUrl ?? "").trim(),
  };
}

// Risolve il bottone "Prenota su…" pubblico: la piattaforma di default (con URL
// impostato) come `primary`, le altre configurate come `others` (per i link "anche su").
export function getBookingLinks(): { primary: BookingLink | null; others: BookingLink[] } {
  const urls = listingUrls();
  const order: OtaPlatform[] = ["airbnb", "booking", "vrbo"];
  const def = POLICIES.defaultBookingPlatform ?? "airbnb";
  const primaryPlatform: OtaPlatform | null = urls[def] ? def : (order.find((p) => urls[p]) ?? null);
  const primary: BookingLink | null = primaryPlatform
    ? { platform: primaryPlatform, url: urls[primaryPlatform], name: PLATFORM_NAME[primaryPlatform] }
    : null;
  const others: BookingLink[] = order
    .filter((p) => p !== primaryPlatform && urls[p])
    .map((p) => ({ platform: p, url: urls[p], name: PLATFORM_NAME[p] }));
  return { primary, others };
}
