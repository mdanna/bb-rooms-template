import { describe, it, expect } from "vitest";
import { normalizeWaNumber, waLink } from "@/lib/whatsapp";

describe("normalizeWaNumber", () => {
  it("tiene solo le cifre e toglie + / spazi / trattini", () => {
    expect(normalizeWaNumber("+39 333 123 4567")).toBe("393331234567");
    expect(normalizeWaNumber("+39-333-1234567")).toBe("393331234567");
  });
  it("toglie il prefisso internazionale 00", () => {
    expect(normalizeWaNumber("0039 333 1234567")).toBe("393331234567");
  });
  it("gestisce vuoto/undefined", () => {
    expect(normalizeWaNumber("")).toBe("");
    expect(normalizeWaNumber(undefined)).toBe("");
  });
});

describe("waLink", () => {
  it("costruisce il link con testo url-encoded", () => {
    expect(waLink("+39 333 1234567", "Ciao mondo")).toBe(
      "https://wa.me/393331234567?text=Ciao%20mondo",
    );
  });
  it("senza testo → solo il numero", () => {
    expect(waLink("+393331234567")).toBe("https://wa.me/393331234567");
  });
  it("numero troppo corto o assente → stringa vuota (pulsante nascosto)", () => {
    expect(waLink("123")).toBe("");
    expect(waLink("")).toBe("");
    expect(waLink(null)).toBe("");
  });
});
