import { describe, it, expect } from "vitest";
import {
  computeContainedLayer,
  occupiedNights,
  stripContained,
} from "@/lib/unitAvailability";
import type { DayRate } from "@/data/availability";

// I test usano la struttura d'esempio (src/data/structure.json):
// appartamento (whole) → contains [camera-rosa, camera-blu].

function occ(map: Record<string, string[]>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [id, dates] of Object.entries(map)) out.set(id, new Set(dates));
  return out;
}

describe("computeContainedLayer — cascata di contenimento", () => {
  it("una camera prenotata blocca l'appartamento, non l'altra camera", () => {
    const res = computeContainedLayer(occ({ "camera-rosa": ["2026-01-01"] }));
    expect([...res.get("appartamento")!]).toEqual(["2026-01-01"]);
    expect([...res.get("camera-blu")!]).toEqual([]);
    expect([...res.get("camera-rosa")!]).toEqual([]); // niente auto-blocco
  });

  it("l'appartamento prenotato blocca entrambe le camere", () => {
    const res = computeContainedLayer(occ({ appartamento: ["2026-02-01"] }));
    expect([...res.get("camera-rosa")!]).toEqual(["2026-02-01"]);
    expect([...res.get("camera-blu")!]).toEqual(["2026-02-01"]);
    expect([...res.get("appartamento")!]).toEqual([]);
  });

  it("non c'è doppio blocco quando camera e appartamento occupano la stessa notte", () => {
    const res = computeContainedLayer(
      occ({ appartamento: ["2026-03-10"], "camera-rosa": ["2026-03-10"] })
    );
    // ognuno ha già la notte in proprio → nessun blocco "contained" aggiuntivo
    expect([...res.get("appartamento")!]).toEqual([]);
    expect([...res.get("camera-rosa")!]).toEqual([]);
    // la camera-blu però è bloccata dall'appartamento
    expect([...res.get("camera-blu")!]).toEqual(["2026-03-10"]);
  });

  it("due camere sulla stessa notte bloccano l'appartamento una sola volta", () => {
    const res = computeContainedLayer(
      occ({ "camera-rosa": ["2026-04-05"], "camera-blu": ["2026-04-05"] })
    );
    expect([...res.get("appartamento")!]).toEqual(["2026-04-05"]);
  });
});

describe("occupiedNights / stripContained", () => {
  const overrides: DayRate[] = [
    { date: "2026-01-01", price: 80, status: "booked", source: "app" },
    { date: "2026-01-02", price: 80, status: "booked", source: "contained" },
    { date: "2026-01-03", price: 90, status: "available" },
    { date: "2026-01-04", price: 80, status: "booked", source: "imported", blockedBy: ["airbnb"] },
  ];

  it("occupiedNights ignora i blocchi derivati 'contained' e le notti libere", () => {
    expect([...occupiedNights(overrides)].sort()).toEqual(["2026-01-01", "2026-01-04"]);
  });

  it("stripContained rimuove solo le voci 'contained'", () => {
    expect(stripContained(overrides).map((o) => o.date)).toEqual([
      "2026-01-01",
      "2026-01-03",
      "2026-01-04",
    ]);
  });
});
