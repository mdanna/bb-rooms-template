import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireBotToken } from "@/lib/githubContent";
import { stripContained, syncContainedLayer } from "@/lib/unitAvailability";
import { getUnit, rootUnitId } from "@/lib/structure";
import type { DayRate, DaySource } from "@/data/availability";

// Sorgenti valide in un override "proprio" salvato dall'admin (il layer derivato
// "contained" NON è salvabile: è ricalcolato, quindi lo scartiamo qui).
const OWN_SOURCES: DaySource[] = [
  "airbnb", "booking", "vrbo", "app", "direct", "blocked", "imported", "airbnb-blocked",
];

interface SavePayload {
  defaultPrice: number;
  overrides: DayRate[];
}

function isValidPayload(body: unknown): body is SavePayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.defaultPrice !== "number" || b.defaultPrice <= 0) return false;
  if (!Array.isArray(b.overrides)) return false;
  return b.overrides.every((o) => {
    if (!o || typeof o !== "object") return false;
    const r = o as Record<string, unknown>;
    return (
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
      typeof r.price === "number" &&
      r.price > 0 &&
      (r.status === "available" || r.status === "booked") &&
      (r.source === undefined || r.source === "contained" || OWN_SOURCES.includes(r.source as DaySource)) &&
      (r.note === undefined || typeof r.note === "string") &&
      (r.conflict === undefined || typeof r.conflict === "boolean")
    );
  });
}

// Salva il calendario/prezzi di UNA unità (?unit=<id>, default radice). Scrive solo il
// layer "proprio" (i blocchi "contained" sono scartati) e RICALCOLA la cascata su tutte
// le unità collegate, così un blocco/prenotazione su una camera aggiorna l'appartamento.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    const own = stripContained(body.overrides).sort((a, b) => a.date.localeCompare(b.date));
    const { commitSha } = await syncContainedLayer(
      token,
      "Update availability and pricing from admin panel",
      { [unitId]: own },
      { [unitId]: body.defaultPrice }
    );
    return NextResponse.json({ ok: true, commitSha: commitSha[unitId] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
