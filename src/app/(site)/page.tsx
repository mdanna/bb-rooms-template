import HomeClient from "./HomeClient";
import { getUnitContent } from "@/lib/unitContent";
import { heroImageList } from "@/lib/siteContent";
import { bookableUnits, getUnit, isBookable, rootUnitId } from "@/lib/structure";

// Server component: precalcola la copertina (singola) di ogni camera per le card della
// home "solo camere". getUnitContent legge i contenuti dell'unità (GitHub/filesystem):
// server-only, quindi la parte interattiva della home è delegata a HomeClient.
export default async function Home() {
  const rootU = getUnit(rootUnitId());
  const wholeBookable = rootU ? isBookable(rootU) : true;
  const rooms = wholeBookable ? [] : bookableUnits().filter((u) => u.slug);
  // INVARIANTE: la card usa heroImageList(...)[0] = UNA foto (la copertina primaria),
  // mai il carosello. Il carosello è solo sull'hero della camera stessa.
  const entries = await Promise.all(
    rooms.map(async (u) => [u.id, heroImageList(await getUnitContent(u.id))[0] ?? null] as const),
  );
  const roomImages: Record<string, string | null> = Object.fromEntries(entries);

  return <HomeClient roomImages={roomImages} />;
}
