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

  it("appartamento intero (unità radice)", () => {
    expect(unitLabel("appartamento", "it")).toBe("Intero appartamento");
    expect(unitLabel("appartamento", "en")).toBe("Whole apartment");
  });

  it("unit_id nullo o ignoto ricade sull'unità radice", () => {
    expect(unitLabel(null, "it")).toBe("Intero appartamento");
    expect(unitLabel(undefined, "it")).toBe("Intero appartamento");
    expect(unitLabel("inesistente", "it")).toBe("Intero appartamento");
  });

  it("lingua mancante nel nome → fallback all'italiano", () => {
    // camera-blu ha solo it/en nell'esempio: una lingua senza traduzione ricade su it.
    expect(unitLabel("camera-blu", "fr")).toBe("Camera Blu");
  });
});
