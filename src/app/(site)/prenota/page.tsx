import { redirect } from "next/navigation";
import { CONTENT } from "@/lib/siteContent";
import { POLICIES } from "@/lib/policies";
import { listingUrls } from "@/lib/bookingLinks";
import { getUnit, rootUnitId, isBookable } from "@/lib/structure";
import PrenotaClient from "./PrenotaClient";

export default function PrenotaPage() {
  // "/prenota" è il flusso dell'appartamento INTERO. Se la struttura è "solo camere"
  // (intero non prenotabile) non ha senso: rimanda alla home, che elenca le camere.
  const rootU = getUnit(rootUnitId());
  if (rootU && !isBookable(rootU)) redirect("/");

  return (
    <PrenotaClient
      airbnbUrl={listingUrls().airbnb}
      airbnbRating={CONTENT.airbnbRating}
      minAdvanceDays={POLICIES.minAdvanceBookingDays}
    />
  );
}
