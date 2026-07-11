import { describe, it, expect } from "vitest";
import { reconcile, type FetchedFeed } from "@/lib/calendarSync";
import type { DayRate } from "@/data/availability";

const TODAY = "2026-01-01"; // tutte le date di test sono nel futuro

function res(platform: FetchedFeed["platform"], dates: string[], note = "Reserved"): FetchedFeed {
  return { platform, reservations: dates.map((d) => ({ date: d, note })), blocks: [] };
}
function block(platform: FetchedFeed["platform"], dates: string[]): FetchedFeed {
  return { platform, reservations: [], blocks: dates };
}
function run(current: DayRate[], fetched: FetchedFeed[]) {
  return reconcile({ defaultPrice: 100, currentOverrides: current, fetched, todayISO: TODAY });
}
const at = (r: { overrides: DayRate[] }, date: string) => r.overrides.find((o) => o.date === date);

describe("reconcile", () => {
  it("importa le prenotazioni OTA su notti libere", () => {
    const r = run([], [res("airbnb", ["2026-07-10", "2026-07-11"])]);
    expect(at(r, "2026-07-10")?.source).toBe("airbnb");
    expect(at(r, "2026-07-11")?.status).toBe("booked");
    expect(r.perPlatform[0]).toMatchObject({ platform: "airbnb", reservations: 2 });
  });

  it("de-dup: un blocco che coincide con una prenotazione viene scartato", () => {
    const r = run([], [res("airbnb", ["2026-07-10"]), block("booking", ["2026-07-10"])]);
    const o = at(r, "2026-07-10");
    expect(o?.source).toBe("airbnb");
    expect(o?.blockedBy).toBeUndefined();
    expect(r.overrides.filter((x) => x.date === "2026-07-10")).toHaveLength(1);
  });

  it("fail-safe: una piattaforma non fetchata conserva i suoi dati (notte non liberata)", () => {
    const current: DayRate[] = [{ date: "2026-07-10", price: 100, status: "booked", source: "airbnb" }];
    const r = run(current, [block("booking", ["2026-08-01"])]); // airbnb NON rifetchato
    expect(at(r, "2026-07-10")?.source).toBe("airbnb"); // resta
    expect(at(r, "2026-08-01")?.source).toBe("imported");
  });

  it("overbooking OTA + prenotazione propria: non sovrascrive la propria, segnala il conflitto", () => {
    const current: DayRate[] = [{ date: "2026-07-10", price: 100, status: "booked", source: "app", note: "Mario" }];
    const r = run(current, [res("airbnb", ["2026-07-10"])]);
    const o = at(r, "2026-07-10");
    expect(o?.source).toBe("app"); // la propria resta
    expect(o?.conflict).toBe(true);
    expect(o?.conflictWith).toContain("airbnb");
    expect(r.conflicts).toHaveLength(1);
  });

  it("overbooking OTA + OTA", () => {
    const r = run([], [res("airbnb", ["2026-07-10"]), res("booking", ["2026-07-10"])]);
    const o = at(r, "2026-07-10");
    expect(o?.conflict).toBe(true);
    expect(o?.conflictWith).toContain("booking");
    expect(r.bookingDisclaimer).toBe(true);
  });

  it("blocco imported accumula blockedBy da più piattaforme", () => {
    const r = run([], [block("airbnb", ["2026-07-15"]), block("booking", ["2026-07-15"])]);
    const o = at(r, "2026-07-15");
    expect(o?.source).toBe("imported");
    expect(o?.blockedBy).toEqual(["airbnb", "booking"]);
  });

  it("il blocco manuale persiste e de-duplica il blocco importato", () => {
    const current: DayRate[] = [{ date: "2026-07-20", price: 100, status: "booked", source: "blocked" }];
    const r = run(current, [block("booking", ["2026-07-20"])]);
    const o = at(r, "2026-07-20");
    expect(o?.source).toBe("blocked"); // resta manuale, non diventa imported
  });

  it("legacy airbnb-blocked → imported, e viene rimosso se airbnb è rifetchato senza quella notte", () => {
    const current: DayRate[] = [{ date: "2026-07-25", price: 100, status: "booked", source: "airbnb-blocked" }];
    const r = run(current, [res("airbnb", ["2026-07-10"])]); // airbnb fetchato, ma non ha più 07-25
    expect(at(r, "2026-07-25")).toBeUndefined(); // liberata correttamente
  });

  it("reverse-gap: prenotazione propria non coperta su una OTA viene segnalata", () => {
    const current: DayRate[] = [{ date: "2026-07-10", price: 100, status: "booked", source: "app", note: "Mario" }];
    const r = run(current, [res("airbnb", ["2026-09-01"])]); // airbnb non copre 07-10
    expect(r.reverseGaps).toHaveLength(1);
    expect(r.reverseGaps[0]).toMatchObject({ label: "Mario", missingOn: ["airbnb"] });
  });

  it("nessun reverse-gap se la OTA blocca già la notte della prenotazione propria", () => {
    const current: DayRate[] = [{ date: "2026-07-10", price: 100, status: "booked", source: "app" }];
    const r = run(current, [block("airbnb", ["2026-07-10"])]);
    expect(r.reverseGaps).toHaveLength(0);
    expect(at(r, "2026-07-10")?.source).toBe("app"); // il blocco airbnb è de-duplicato
  });
});
