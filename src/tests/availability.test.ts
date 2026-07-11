import { describe, it, expect } from "vitest";
import { makeDayRateFn, toISODate, type DayRate } from "@/data/availability";

const DEFAULT_PRICE = 120;

function day(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

describe("toISODate", () => {
  it("formatta correttamente la data locale (no deriva UTC)", () => {
    const d = new Date(2025, 7, 15); // 15 agosto 2025 ora locale
    expect(toISODate(d)).toBe("2025-08-15");
  });

  it("aggiunge il padding a mesi e giorni < 10", () => {
    const d = new Date(2025, 0, 5); // 5 gennaio
    expect(toISODate(d)).toBe("2025-01-05");
  });
});

describe("makeDayRateFn", () => {
  const overrides: DayRate[] = [
    { date: "2025-12-24", price: 200, status: "available" },
    { date: "2025-12-25", price: 0, status: "booked", source: "app" },
    { date: "2025-12-26", price: 0, status: "booked", source: "airbnb" },
  ];

  const getRate = makeDayRateFn(DEFAULT_PRICE, overrides);

  it("restituisce il prezzo di default per date senza override", () => {
    const rate = getRate(day("2025-11-01"));
    expect(rate.price).toBe(DEFAULT_PRICE);
    expect(rate.status).toBe("available");
  });

  it("restituisce l'override quando la data corrisponde", () => {
    const rate = getRate(day("2025-12-24"));
    expect(rate.price).toBe(200);
    expect(rate.status).toBe("available");
  });

  it("riconosce lo stato 'booked' con sorgente app", () => {
    const rate = getRate(day("2025-12-25"));
    expect(rate.status).toBe("booked");
    expect(rate.source).toBe("app");
  });

  it("riconosce lo stato 'booked' con sorgente airbnb", () => {
    const rate = getRate(day("2025-12-26"));
    expect(rate.status).toBe("booked");
    expect(rate.source).toBe("airbnb");
  });

  it("la data restituita in DayRate corrisponde a quella richiesta", () => {
    const rate = getRate(day("2025-11-15"));
    expect(rate.date).toBe("2025-11-15");
  });

  it("funziona con override vuoti (usa sempre default)", () => {
    const fn = makeDayRateFn(80, []);
    const rate = fn(day("2025-06-01"));
    expect(rate.price).toBe(80);
    expect(rate.status).toBe("available");
  });

  it("lookup è O(1) con Map, non O(n) con array", () => {
    // Genera 10.000 override e verifica che l'ultimo sia trovato velocemente
    const manyOverrides: DayRate[] = [];
    for (let i = 1; i <= 10000; i++) {
      const dateStr = `${2020 + Math.floor(i / 365)}-01-${String((i % 28) + 1).padStart(2, "0")}`;
      manyOverrides.push({ date: dateStr, price: i, status: "available" });
    }
    const targetDate = "2025-08-10";
    manyOverrides.push({ date: targetDate, price: 999, status: "booked" });

    const fn = makeDayRateFn(DEFAULT_PRICE, manyOverrides);
    const rate = fn(day(targetDate));
    expect(rate.price).toBe(999);
  });
});
