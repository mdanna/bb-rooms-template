import { describe, it, expect } from "vitest";
import { buildUnitICal } from "@/lib/icalExport";
import type { DayRate } from "@/data/availability";

const STAMP = "20260101T000000Z";

describe("buildUnitICal — export iCal per unità", () => {
  it("raggruppa notti contigue in un solo VEVENT (DTEND esclusivo)", () => {
    const overrides: DayRate[] = [
      { date: "2026-01-01", price: 80, status: "booked", source: "app" },
      { date: "2026-01-02", price: 80, status: "booked", source: "app" },
      { date: "2026-01-03", price: 80, status: "booked", source: "app" },
    ];
    const ics = buildUnitICal("camera-rosa", overrides, STAMP);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260101");
    expect(ics).toContain("DTEND;VALUE=DATE:20260104"); // check-out esclusivo
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it("esporta anche i blocchi derivati 'contained' (cascata verso le OTA)", () => {
    const overrides: DayRate[] = [
      { date: "2026-02-10", price: 180, status: "booked", source: "contained" },
    ];
    const ics = buildUnitICal("camera-blu", overrides, STAMP);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260210");
    expect(ics).toContain("DTEND;VALUE=DATE:20260211");
  });

  it("intervalli separati → VEVENT separati; ignora le notti libere", () => {
    const overrides: DayRate[] = [
      { date: "2026-03-01", price: 80, status: "booked", source: "airbnb" },
      { date: "2026-03-05", price: 80, status: "available" },
      { date: "2026-03-10", price: 80, status: "booked", source: "app" },
    ];
    const ics = buildUnitICal("camera-rosa", overrides, STAMP);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260301");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260310");
    expect(ics).not.toContain("20260305");
  });

  it("nessuna notte occupata → VCALENDAR valido senza eventi", () => {
    const ics = buildUnitICal("appartamento", [], STAMP);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
