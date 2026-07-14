import { describe, it, expect } from "vitest";
import { quoteRefund } from "@/lib/refund";

// franchigia = 3,5% (da policies.json), applicata SOLO alla quota soggiorno su rimborso
// pieno da guest. La tassa di soggiorno incassata online è SEMPRE rimborsata al 100%.
const base = { cityTaxPaid: 0, hoursSinceBooking: 100, byHost: false };

describe("quoteRefund — flexible (pieno ≥1 giorno)", () => {
  it("pieno: franchigia 3,5% sul soggiorno", () => {
    const r = quoteRefund({ stayPaid: 1000, policy: "flexible", daysUntilCheckin: 3, ...base });
    expect(r.kind).toBe("full");
    expect(r.franchise).toBe(35);
    expect(r.stayRefund).toBe(965);
    expect(r.amount).toBe(965);
  });
  it("niente sotto le 24h", () => {
    expect(quoteRefund({ stayPaid: 1000, policy: "flexible", daysUntilCheckin: 0, ...base }).amount).toBe(0);
  });
});

describe("quoteRefund — moderate (pieno ≥5 giorni)", () => {
  it("pieno a 5 giorni", () => {
    expect(quoteRefund({ stayPaid: 1000, policy: "moderate", daysUntilCheckin: 5, ...base }).kind).toBe("full");
  });
  it("niente a 4 giorni", () => {
    expect(quoteRefund({ stayPaid: 1000, policy: "moderate", daysUntilCheckin: 4, ...base }).kind).toBe("none");
  });
});

describe("quoteRefund — strict (pieno ≥30, 50% 30-7, niente <7)", () => {
  it("pieno a 30 giorni (con franchigia)", () => {
    expect(quoteRefund({ stayPaid: 1000, policy: "strict", daysUntilCheckin: 30, ...base }).amount).toBe(965);
  });
  it("50% a 10 giorni SENZA franchigia", () => {
    const r = quoteRefund({ stayPaid: 1000, policy: "strict", daysUntilCheckin: 10, ...base });
    expect(r.kind).toBe("partial");
    expect(r.franchise).toBe(0);
    expect(r.amount).toBe(500);
  });
  it("niente a 6 giorni", () => {
    expect(quoteRefund({ stayPaid: 1000, policy: "strict", daysUntilCheckin: 6, ...base }).kind).toBe("none");
  });
});

describe("quoteRefund — tassa di soggiorno sempre 100% a parte", () => {
  it("soggiorno pieno + tassa 100%", () => {
    const r = quoteRefund({ stayPaid: 1000, cityTaxPaid: 42, policy: "flexible", daysUntilCheckin: 3, hoursSinceBooking: 100, byHost: false });
    expect(r.stayRefund).toBe(965);
    expect(r.cityTaxRefund).toBe(42);
    expect(r.amount).toBe(1007);
  });
  it("soggiorno NON rimborsabile ma tassa comunque rimborsata al 100%", () => {
    const r = quoteRefund({ stayPaid: 1000, cityTaxPaid: 42, policy: "flexible", daysUntilCheckin: 0, hoursSinceBooking: 100, byHost: false });
    expect(r.kind).toBe("none");
    expect(r.stayRefund).toBe(0);
    expect(r.cityTaxRefund).toBe(42);
    expect(r.amount).toBe(42);
  });
});

describe("quoteRefund — grazia 48h, host, paga-al-check-in", () => {
  it("grazia 48h: pieno su strict a 20 giorni se prenotato da poco e check-in lontano", () => {
    const r = quoteRefund({ stayPaid: 1000, cityTaxPaid: 0, policy: "strict", daysUntilCheckin: 20, hoursSinceBooking: 10, byHost: false });
    expect(r.amount).toBe(965);
  });
  it("host cancella → soggiorno 100% senza franchigia + tassa 100%", () => {
    const r = quoteRefund({ stayPaid: 1000, cityTaxPaid: 42, policy: "strict", daysUntilCheckin: 1, hoursSinceBooking: 999, byHost: true });
    expect(r.franchise).toBe(0);
    expect(r.amount).toBe(1042);
    expect(r.reason).toBe("host_cancel");
  });
  it("paga-al-check-in (niente incassato) → nessun rimborso", () => {
    const r = quoteRefund({ stayPaid: 0, cityTaxPaid: 0, policy: "flexible", daysUntilCheckin: 10, hoursSinceBooking: 1, byHost: true });
    expect(r.amount).toBe(0);
    expect(r.reason).toBe("nothing_paid");
  });
});
