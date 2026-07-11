import { describe, it, expect } from "vitest";
import {
  computePricingBreakdown,
  computeRefund,
  CITY_TAX_PER_PERSON_PER_NIGHT,
  CITY_TAX_MAX_NIGHTS,
  DEFAULT_DEPOSIT_RATE,
  CANCEL_FULL_REFUND_DAYS,
  CANCEL_HALF_REFUND_DAYS,
  CANCEL_FEE_PERCENT,
  CANCEL_PARTIAL_REFUND_PCT,
} from "@/lib/pricing";

describe("computePricingBreakdown", () => {
  it("calcola l'anticipo al tasso di default (DEFAULT_DEPOSIT_RATE)", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03");
    expect(result.depositAmount).toBe(Math.round(200 * DEFAULT_DEPOSIT_RATE));
  });

  it("calcola l'anticipo con tasso esplicito al 50%", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03", 0.5);
    expect(result.depositAmount).toBe(100);
  });

  it("calcola la tassa di soggiorno: tariffa × ospiti × notti", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 2 * 2);
  });

  it("il saldo dovuto è (totale - anticipo), senza tassa di soggiorno (riscossa al check-in)", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03");
    const expectedDeposit = Math.round(200 * DEFAULT_DEPOSIT_RATE);
    expect(result.balanceDue).toBe(200 - expectedDeposit);
  });

  it("il saldo dovuto con tasso esplicito 50%", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03", 0.5);
    expect(result.balanceDue).toBe(100);
  });

  it("la tassa di soggiorno è limitata a cityTaxMaxNights per soggiorni lunghi", () => {
    const result = computePricingBreakdown(1500, 1, "2025-08-01", "2025-08-16");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 1 * CITY_TAX_MAX_NIGHTS);
  });

  it("gestisce un soggiorno di 1 notte", () => {
    const result = computePricingBreakdown(100, 1, "2025-08-01", "2025-08-02");
    expect(result.depositAmount).toBe(Math.round(100 * DEFAULT_DEPOSIT_RATE));
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 1 * 1);
    expect(result.totalPrice).toBe(100);
  });

  it("gestisce più ospiti", () => {
    // tariffa × 4 ospiti × 3 notti (rate-agnostico: non dipende dal valore in policies)
    const result = computePricingBreakdown(600, 4, "2025-07-10", "2025-07-13");
    expect(result.cityTax).toBe(CITY_TAX_PER_PERSON_PER_NIGHT * 4 * 3);
  });

  it("restituisce il totalPrice invariato", () => {
    const result = computePricingBreakdown(350, 3, "2025-09-01", "2025-09-04");
    expect(result.totalPrice).toBe(350);
  });

  it("l'anticipo viene arrotondato all'intero più vicino", () => {
    const result = computePricingBreakdown(101, 1, "2025-08-01", "2025-08-02");
    expect(result.depositAmount).toBe(Math.round(101 * DEFAULT_DEPOSIT_RATE));
  });

  it("il depositRate restituito non scende sotto DEFAULT_DEPOSIT_RATE (tasso minimo)", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03", 0.01);
    expect(result.depositRate).toBe(DEFAULT_DEPOSIT_RATE);
  });

  it("il depositRate restituito non supera 1.0", () => {
    const result = computePricingBreakdown(200, 2, "2025-08-01", "2025-08-03", 2.0);
    expect(result.depositRate).toBe(1.0);
  });
});

describe("computeRefund", () => {
  const deposit = 200;

  it("rimborso completo se check-in è lontano più di CANCEL_FULL_REFUND_DAYS giorni", () => {
    const { eligible, reason } = computeRefund(deposit, CANCEL_FULL_REFUND_DAYS + 1);
    expect(eligible).toBe(true);
    expect(reason).toBe("full");
  });

  it("rimborso completo: importo = deposito meno trattenuta", () => {
    const fee = Math.round(deposit * CANCEL_FEE_PERCENT) / 100;
    const { amount } = computeRefund(deposit, CANCEL_FULL_REFUND_DAYS + 1);
    expect(amount).toBe(deposit - fee);
  });

  it("rimborso parziale se check-in è tra CANCEL_HALF_REFUND_DAYS e CANCEL_FULL_REFUND_DAYS", () => {
    const { eligible, reason } = computeRefund(deposit, CANCEL_HALF_REFUND_DAYS);
    expect(eligible).toBe(true);
    expect(reason).toBe("half");
  });

  it("rimborso parziale: importo = percentuale parametrica meno trattenuta", () => {
    const fee = Math.round(deposit * CANCEL_FEE_PERCENT) / 100;
    const partial = Math.round(deposit * CANCEL_PARTIAL_REFUND_PCT) / 100;
    const { amount } = computeRefund(deposit, CANCEL_HALF_REFUND_DAYS);
    expect(amount).toBe(partial - fee);
  });

  it("la trattenuta si applica sia al rimborso completo sia a quello parziale", () => {
    const fee = Math.round(deposit * CANCEL_FEE_PERCENT) / 100;
    const { amount: amountFull } = computeRefund(deposit, CANCEL_FULL_REFUND_DAYS + 1);
    const { amount: amountHalf } = computeRefund(deposit, CANCEL_HALF_REFUND_DAYS);
    expect(amountFull).toBe(deposit - fee);
    expect(amountHalf).toBeLessThan(deposit - fee); // partial < full
    expect(amountHalf).toBeGreaterThan(0);
  });

  it("nessun rimborso se check-in è entro CANCEL_HALF_REFUND_DAYS giorni", () => {
    const { eligible, amount, reason } = computeRefund(deposit, CANCEL_HALF_REFUND_DAYS - 1);
    expect(eligible).toBe(false);
    expect(amount).toBe(0);
    expect(reason).toBe("none");
  });

  it("nessun rimborso con check-in già passato (giorni negativi)", () => {
    const { eligible } = computeRefund(deposit, -5);
    expect(eligible).toBe(false);
  });

  it("senza cityTax il comportamento è invariato (backward compatible)", () => {
    const { cityTaxRefund } = computeRefund(deposit, CANCEL_FULL_REFUND_DAYS + 1);
    expect(cityTaxRefund).toBe(0);
  });

  it("con cityTax online: rimborso completo = anticipo meno trattenuta PIÙ tassa intera", () => {
    const cityTax = 12;
    const fee = Math.round(deposit * CANCEL_FEE_PERCENT) / 100;
    const { eligible, amount, cityTaxRefund } = computeRefund(
      deposit,
      CANCEL_FULL_REFUND_DAYS + 1,
      cityTax
    );
    expect(eligible).toBe(true);
    expect(cityTaxRefund).toBe(cityTax);
    expect(amount).toBe(deposit - fee + cityTax);
  });

  it("con cityTax online: rimborso parziale include comunque la tassa intera", () => {
    const cityTax = 12;
    const fee = Math.round(deposit * CANCEL_FEE_PERCENT) / 100;
    const partial = Math.round(deposit * CANCEL_PARTIAL_REFUND_PCT) / 100;
    const { amount, cityTaxRefund } = computeRefund(deposit, CANCEL_HALF_REFUND_DAYS, cityTax);
    expect(cityTaxRefund).toBe(cityTax);
    expect(amount).toBe(partial - fee + cityTax);
  });

  it("con cityTax online: anche fuori finestra rimborso anticipo, la tassa è rimborsata", () => {
    const cityTax = 12;
    const { eligible, amount, reason, cityTaxRefund } = computeRefund(
      deposit,
      CANCEL_HALF_REFUND_DAYS - 1,
      cityTax
    );
    expect(reason).toBe("none"); // nessun rimborso anticipo
    expect(eligible).toBe(true); // ma c'è comunque la tassa da rimborsare
    expect(cityTaxRefund).toBe(cityTax);
    expect(amount).toBe(cityTax);
  });
});
