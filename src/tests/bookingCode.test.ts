import { describe, it, expect } from "vitest";
import { generateBookingCode } from "@/lib/bookingCode";

describe("generateBookingCode", () => {
  it("ha il prefisso CM-", () => {
    const code = generateBookingCode();
    expect(code).toMatch(/^CM-/);
  });

  it("ha esattamente 9 caratteri (CM- + 6 alfanumerici)", () => {
    const code = generateBookingCode();
    expect(code).toHaveLength(9);
  });

  it("usa solo caratteri non ambigui (no 0, O, 1, I)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBookingCode();
      const suffix = code.slice(3);
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });

  it("genera codici unici in 1000 iterazioni", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateBookingCode));
    expect(codes.size).toBe(1000);
  });

  it("contiene solo lettere maiuscole e cifre nella parte random", () => {
    for (let i = 0; i < 50; i++) {
      const suffix = generateBookingCode().slice(3);
      expect(suffix).toMatch(/^[A-Z2-9]{6}$/);
    }
  });
});
