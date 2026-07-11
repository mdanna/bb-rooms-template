import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  nightsBetween,
  enumerateDateOnly,
  toDateOnlyString,
} from "@/lib/dateOnly";

describe("parseDateOnly", () => {
  it("parsa una stringa ISO YYYY-MM-DD senza deriva di fuso orario", () => {
    const d = parseDateOnly("2025-08-15");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(7); // agosto = 7 (0-indexed)
    expect(d.getDate()).toBe(15);
  });

  it("accetta un oggetto Date UTC (usa i primi 10 chars di toISOString)", () => {
    // parseDateOnly usa toISOString() su oggetti Date (interpretazione UTC):
    // creiamo una data UTC esplicita per evitare derive di fuso orario nei test
    const input = new Date(Date.UTC(2025, 0, 10)); // 10 gennaio 2025 UTC
    const d = parseDateOnly(input);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(10);
  });

  it("ignora la parte ora di una stringa ISO completa", () => {
    const d = parseDateOnly("2025-12-31T23:00:00.000Z");
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(11); // dicembre
  });
});

describe("nightsBetween", () => {
  it("calcola correttamente le notti", () => {
    expect(nightsBetween("2025-08-01", "2025-08-05")).toBe(4);
  });

  it("restituisce 1 per un soggiorno di una notte", () => {
    expect(nightsBetween("2025-08-01", "2025-08-02")).toBe(1);
  });

  it("restituisce 0 per stesse date", () => {
    expect(nightsBetween("2025-08-01", "2025-08-01")).toBe(0);
  });

  it("funziona con oggetti Date", () => {
    const from = new Date(2025, 7, 1);
    const to = new Date(2025, 7, 8);
    expect(nightsBetween(from, to)).toBe(7);
  });
});

describe("enumerateDateOnly", () => {
  it("elenca tutte le date incluse start ed end", () => {
    const dates = enumerateDateOnly("2025-08-01", "2025-08-03");
    expect(dates).toEqual(["2025-08-01", "2025-08-02", "2025-08-03"]);
  });

  it("restituisce un singolo elemento se start === end", () => {
    const dates = enumerateDateOnly("2025-08-01", "2025-08-01");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toBe("2025-08-01");
  });
});

describe("toDateOnlyString", () => {
  it("formatta la data come YYYY-MM-DD", () => {
    const d = new Date(2025, 0, 5); // 5 gennaio 2025
    expect(toDateOnlyString(d)).toBe("2025-01-05");
  });

  it("aggiunge lo zero per mesi e giorni < 10", () => {
    const d = new Date(2025, 8, 9); // 9 settembre 2025
    expect(toDateOnlyString(d)).toBe("2025-09-09");
  });
});
