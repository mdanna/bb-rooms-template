import { getFile, requireBotToken } from "./githubContent";
import { enumerateDateOnly } from "./dateOnly";
import { availPath, stripContained, syncContainedLayer } from "./unitAvailability";
import type { DayRate, AvailabilityData } from "@/data/availability";

// Notti di un soggiorno: dal check-in al check-out escluso (coerente con la semantica
// del calendario admin).
function nightsOf(checkin: string | Date, checkout: string | Date): string[] {
  const all = enumerateDateOnly(checkin, checkout);
  return all.length > 1 ? all.slice(0, -1) : all;
}

// Segna come "booked" (source "app") le notti di un soggiorno sull'unità indicata,
// poi RICALCOLA il layer "contained" di tutte le unità collegate (l'appartamento si
// blocca se prenoti una camera, e viceversa). Un solo punto di verità: lo stato
// "proprio" di ciascuna unità; i blocchi derivati sono sempre ricomputati.
export async function markNightsBooked(
  unitId: string,
  checkin: string | Date,
  checkout: string | Date,
  guestName?: string
) {
  const nights = nightsOf(checkin, checkout);
  if (nights.length === 0) return;

  const token = requireBotToken();
  const { content } = await getFile(availPath(unitId), token);
  const data = JSON.parse(content) as AvailabilityData;

  const own = stripContained(data.overrides ?? []).filter((o) => !nights.includes(o.date));
  for (const date of nights) {
    const existing = (data.overrides ?? []).find((o) => o.date === date);
    own.push({
      date,
      price: existing?.price ?? data.defaultPrice,
      status: "booked",
      source: "app",
      ...(guestName ? { note: guestName } : {}),
    } as DayRate);
  }
  own.sort((a, b) => a.date.localeCompare(b.date));

  await syncContainedLayer(token, "Block booked nights from confirmed reservation", {
    [unitId]: own,
  });
}

// Rimuove il blocco "booked" dalle notti di un soggiorno annullato sull'unità indicata
// (riportandole al prezzo di base o a un prezzo personalizzato già impostato), poi
// ricalcola il layer "contained" così i livelli collegati si liberano se non resta
// nessun'altra occupazione su quella notte.
export async function unmarkNightsBooked(
  unitId: string,
  checkin: string | Date,
  checkout: string | Date
) {
  const nights = nightsOf(checkin, checkout);
  if (nights.length === 0) return;

  const token = requireBotToken();
  const { content } = await getFile(availPath(unitId), token);
  const data = JSON.parse(content) as AvailabilityData;

  const own = stripContained(data.overrides ?? []).filter(
    (o) => !(nights.includes(o.date) && o.status === "booked")
  );
  own.sort((a, b) => a.date.localeCompare(b.date));

  await syncContainedLayer(token, "Unblock nights from cancelled reservation", {
    [unitId]: own,
  });
}
