import { NextResponse } from "next/server";
import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import { getUnit, rootUnitId } from "@/lib/structure";

// Legge la disponibilità di UNA unità direttamente da GitHub, così la risposta riflette
// sempre l'ultimo salvataggio senza attendere un rebuild di Vercel. `?unit=<id>` sceglie
// l'unità (appartamento intero o singola camera); assente o non valida → unità radice.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("unit");
  const unitId = requested && getUnit(requested) ? requested : rootUnitId();
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const data = JSON.parse(content);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore lettura disponibilità" },
      { status: 502 }
    );
  }
}
