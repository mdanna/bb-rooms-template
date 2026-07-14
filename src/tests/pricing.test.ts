import { describe, it, expect } from "vitest";
import {
  computePricingBreakdown,
  chargedAmount,
  CITY_TAX_PER_PERSON_PER_NIGHT,
  CITY_TAX_MAX_NIGHTS,
} from "@/lib/pricing";

// Modello a pagamento intero: il breakdown contiene solo { totalPrice, cityTax }.
// La logica di rimborso vive in refund.ts (vedi refund.test.ts).
describe("computePricingBreakdown", () => {
  it("restituisce il totalPrice invariato", () => {
    const result = computePricingBreakdown(350, 3, "2025-09-01", "2025-09-04");
    expect(result.totalPrice).toBe(350);
  });

  it("calcola la tassa di soggiorno: tariffa × ospiti × notti", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 2 * 2);
  });

  it("la tassa di soggiorno è limitata a cityTaxMaxNights per soggiorni lunghi", () => {
    const result = computePricingBreakdown(1500, 1, "2025-08-01", "2025-08-16");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 1 * CITY_TAX_MAX_NIGHTS);
  });

  it("gestisce un soggiorno di 1 notte", () => {
    const result = computePricingBreakdown(100, 1, "2025-08-01", "2025-08-02");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 1 * 1);
    expect(result.totalPrice).toBe(100);
  });

  it("gestisce più ospiti (rate-agnostico rispetto al valore in policies)", () => {
    const result = computePricingBreakdown(600, 4, "2025-07-10", "2025-07-13");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 4 * 3);
  });

  it("il breakdown non contiene più acconto/saldo", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03");
    expect(result).not.toHaveProperty("depositAmount");
    expect(result).not.toHaveProperty("balanceDue");
  });
});

describe("chargedAmount", () => {
  it("include la tassa di soggiorno quando è incassata online", () => {
    expect(chargedAmount(400, 24, true)).toBe(424);
  });

  it("esclude la tassa di soggiorno quando è riscossa al check-in", () => {
    expect(chargedAmount(400, 24, false)).toBe(400);
  });
});
