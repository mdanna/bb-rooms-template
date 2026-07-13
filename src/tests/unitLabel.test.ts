import { describe, it, expect } from "vitest";
import { unitLabel } from "@/lib/structure";

// Nome localizzato di "che cosa si prenota" per le email (struttura d'esempio:
// appartamento + camera-rosa + camera-blu).
describe("unitLabel — nome dell'unità nelle email", () => {
  it("camera: nome localizzato", () => {
    expect(unitLabel("camera-rosa", "it")).toBe("Camera Rosa");
    expect(unitLabel("camera-rosa", "en")).toBe("Rose Room");
    expect(unitLabel("camera-blu", "it")).toBe("Camera Blu");
  });

  it("appartamento intero: il nome è il TITOLO (siteTitle), non l'etichetta generica", () => {
    // siteTitle dell'esempio: it "Villa dei Tigli", en "" (vuoto → fallback all'italiano).
    expect(unitLabel("appartamento", "it")).toBe("Villa dei Tigli");
    expect(unitLabel("appartamento", "en")).toBe("Villa dei Tigli");
  });

  it("unit_id nullo o ignoto ricade sull'unità radice (→ titolo)", () => {
    expect(unitLabel(null, "it")).toBe("Villa dei Tigli");
    expect(unitLabel(undefined, "it")).toBe("Villa dei Tigli");
    expect(unitLabel("inesistente", "it")).toBe("Villa dei Tigli");
  });

  it("lingua mancante nel nome → fallback all'italiano", () => {
    // camera-blu ha solo it/en nell'esempio: una lingua senza traduzione ricade su it.
    expect(unitLabel("camera-blu", "fr")).toBe("Camera Blu");
  });
});
