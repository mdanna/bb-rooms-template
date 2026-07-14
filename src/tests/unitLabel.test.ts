import { describe, it, expect, vi } from "vitest";

// Il titolo del sito vive in content.json e VARIA per istanza (ogni cliente ha il suo).
// Per testare la LOGICA di unitLabel senza dipendere dai dati del singolo sito,
// mockiamo un titolo FISSO e passiamo una struttura FIXTURE esplicita (unitLabel
// accetta la Structure come 3° argomento). Così il test è deterministico ovunque.
vi.mock("@/lib/siteContent", () => ({
  CONTENT: { siteTitle: { it: "Titolo Struttura", en: "" } },
}));

import { unitLabel, type Structure } from "@/lib/structure";

// Struttura d'esempio indipendente da src/data/structure.json: appartamento + 2 camere.
const S: Structure = {
  structureTitle: { it: "Struttura di test" },
  defaultLocale: "it",
  units: [
    {
      id: "appartamento",
      kind: "whole",
      slug: "",
      name: { it: "Intero appartamento", en: "Whole apartment" },
      contains: ["camera-rosa", "camera-blu"],
    },
    { id: "camera-rosa", kind: "room", slug: "camera-rosa", name: { it: "Camera Rosa", en: "Rose Room" } },
    { id: "camera-blu", kind: "room", slug: "camera-blu", name: { it: "Camera Blu" } },
  ],
};

describe("unitLabel — nome dell'unità nelle email", () => {
  it("camera: nome localizzato", () => {
    expect(unitLabel("camera-rosa", "it", S)).toBe("Camera Rosa");
    expect(unitLabel("camera-rosa", "en", S)).toBe("Rose Room");
    expect(unitLabel("camera-blu", "it", S)).toBe("Camera Blu");
  });

  it("appartamento intero: il nome è il TITOLO (siteTitle), non l'etichetta generica", () => {
    // La radice ritorna il titolo del sito, NON il name generico "Intero appartamento".
    expect(unitLabel("appartamento", "it", S)).toBe("Titolo Struttura");
    expect(unitLabel("appartamento", "it", S)).not.toBe("Intero appartamento");
    // en è vuoto nel titolo mockato → fallback all'italiano.
    expect(unitLabel("appartamento", "en", S)).toBe("Titolo Struttura");
  });

  it("unit_id nullo o ignoto ricade sull'unità radice (→ titolo)", () => {
    expect(unitLabel(null, "it", S)).toBe("Titolo Struttura");
    expect(unitLabel(undefined, "it", S)).toBe("Titolo Struttura");
    expect(unitLabel("inesistente", "it", S)).toBe("Titolo Struttura");
  });

  it("lingua mancante nel nome → fallback all'italiano", () => {
    // camera-blu ha solo it nel fixture: una lingua senza traduzione ricade su it.
    expect(unitLabel("camera-blu", "fr", S)).toBe("Camera Blu");
  });
});
