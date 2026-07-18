import { describe, it, expect } from "vitest";
import {
  stayLimitsFor,
  availableGapNights,
  makeDayRateFn,
  type StayRule,
  type DayRate,
} from "@/data/availability";

const defaults = { min: 2, max: 30 };

describe("stayLimitsFor", () => {
  it("nessuna regola → default", () => {
    expect(stayLimitsFor("2026-07-10", [], defaults)).toEqual({ min: 2, max: 30 });
  });

  it("una regola che combacia sovrascrive min/max; fuori intervallo → default", () => {
    const rules: StayRule[] = [{ from: "2026-08-01", to: "2026-08-31", minStay: 5, maxStay: 14 }];
    expect(stayLimitsFor("2026-08-15", rules, defaults)).toEqual({ min: 5, max: 14 });
    expect(stayLimitsFor("2026-09-01", rules, defaults)).toEqual({ min: 2, max: 30 });
  });

  it("campi parziali della regola cadono sul default", () => {
    const rules: StayRule[] = [{ from: "2026-08-01", to: "2026-08-31", minStay: 7 }];
    expect(stayLimitsFor("2026-08-10", rules, defaults)).toEqual({ min: 7, max: 30 });
  });

  it("last-match-wins su intervalli sovrapposti", () => {
    const rules: StayRule[] = [
      { from: "2026-08-01", to: "2026-08-31", minStay: 3 },
      { from: "2026-08-10", to: "2026-08-20", minStay: 6, maxStay: 10 },
    ];
    // 2026-08-15 combacia con entrambe: vince l'ultima
    expect(stayLimitsFor("2026-08-15", rules, defaults)).toEqual({ min: 6, max: 10 });
    // 2026-08-05 combacia solo con la prima
    expect(stayLimitsFor("2026-08-05", rules, defaults)).toEqual({ min: 3, max: 30 });
  });

  it("estremi from/to inclusi", () => {
    const rules: StayRule[] = [{ from: "2026-08-01", to: "2026-08-01", minStay: 4 }];
    expect(stayLimitsFor("2026-08-01", rules, defaults).min).toBe(4);
  });
});

describe("availableGapNights", () => {
  const overrides: DayRate[] = [
    { date: "2026-07-10", price: 100, status: "booked", source: "app" },
    { date: "2026-07-13", price: 100, status: "booked", source: "app" },
  ];
  const getRate = makeDayRateFn(100, overrides);

  it("conta le notti libere consecutive fino alla prima occupata", () => {
    // check-in 2026-07-11: 11 e 12 liberi, 13 occupato → gap 2
    expect(availableGapNights("2026-07-11", getRate)).toBe(2);
  });

  it("ritorna 0 se il check-in stesso è occupato", () => {
    expect(availableGapNights("2026-07-10", getRate)).toBe(0);
  });

  it("gap più piccolo del minimo: il riempimento esatto resta selezionabile", () => {
    const gap = availableGapNights("2026-07-11", getRate); // 2
    const { min } = stayLimitsFor("2026-07-11", [], { min: 3, max: 30 }); // 3
    // effective min lato client = Math.min(min, gap) → consente il buco esatto
    expect(Math.min(min, gap)).toBe(2);
  });

  it("guardia su data malformata → 0", () => {
    expect(availableGapNights("not-a-date", getRate)).toBe(0);
  });
});
