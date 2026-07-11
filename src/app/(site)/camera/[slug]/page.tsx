import { notFound } from "next/navigation";
import { unitBySlug, isBookable } from "@/lib/structure";
import { getUnitContent } from "@/lib/unitContent";
import { POLICIES } from "@/lib/policies";
import CameraClient from "./CameraClient";

// Pagina pubblica di una singola camera: /camera/<slug>. Solo unità NON radice
// (slug non vuoto) e affittabili. Contenuti risolti per unità (base condivisa +
// sovrascritture della camera). Il flusso di prenotazione è legato all'unità.
export default async function CameraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const unit = unitBySlug(slug);
  if (!unit || !unit.slug || !isBookable(unit)) notFound();

  const content = getUnitContent(unit.id);
  return (
    <CameraClient
      unitId={unit.id}
      content={content}
      minAdvanceDays={POLICIES.minAdvanceBookingDays}
    />
  );
}
