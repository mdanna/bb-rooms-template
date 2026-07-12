import { describe, it, expect, vi } from "vitest";
import {
  buildVacationRentalJsonLd,
  buildReviewMarkup,
  vacationRentalId,
  serializeJsonLd,
  VacationRentalMarkupError,
  type VacationRentalInput,
} from "@/lib/vacationRentalJsonLd";

// Fixture realistica: appartamento a Roma, 2 camere, 4 ospiti, 8 foto, rating proprio 4.94.
function fixture(): VacationRentalInput {
  return {
    name: "Appartamento dei Fiori",
    identifier: "IT058091C2KPSZELUL",
    url: "https://esempio.dimorasuite.it",
    images: Array.from({ length: 8 }, (_, i) => `https://esempio.dimorasuite.it/images/casa-0${i + 1}.jpg`),
    latitude: 41.909069038726436,
    longitude: 12.459875591084225,
    maxOccupancy: 4,
    additionalType: "Apartment",
    description: "Elegante appartamento nel cuore di Prati, a due passi dal Vaticano.",
    telephone: "+39 335 7573294",
    email: "info@esempio.it",
    address: {
      streetAddress: "Via degli Scipioni 145",
      addressLocality: "Roma",
      addressRegion: "Lazio",
      postalCode: "00192",
      addressCountry: "IT",
    },
    checkinTime: "15:00",
    checkoutTime: "10:00",
    knowsLanguage: ["it", "en", "fr"],
    accommodation: {
      additionalType: "EntirePlace",
      numberOfBedrooms: 2,
      numberOfBathroomsTotal: 1,
      numberOfRooms: 3,
      floorSize: { value: 75, unitCode: "MTK" },
      beds: [
        { typeName: "Queen", count: 1 },
        { typeName: "Single", count: 2 },
      ],
      amenities: ["Wi-Fi ad alta velocità", "Aria condizionata", "Cucina completa"],
    },
    reviews: [
      { author: "Antonella", datePublished: "2026-05-14", ratingValue: 5, body: "Soggiorno perfetto." },
      { author: "Yiqi", datePublished: "2026-04-02", ratingValue: 5, body: "Pulitissimo e ben posizionato." },
      { author: "Valerie", datePublished: "2026-03-20", ratingValue: 4, body: "Ottima esperienza." },
    ],
    aggregateRating: { ratingValue: 4.94, reviewCount: 217 },
  };
}

describe("buildVacationRentalJsonLd — proprietà required", () => {
  it("emette @type VacationRental e tutti i campi obbligatori", () => {
    const ld = buildVacationRentalJsonLd(fixture());
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("VacationRental");
    expect(ld.name).toBe("Appartamento dei Fiori");
    expect(ld.identifier).toBe("IT058091C2KPSZELUL");
    expect(Array.isArray(ld.image)).toBe(true);
    expect((ld.image as string[]).length).toBe(8);
    expect(ld.latitude).toBeTypeOf("number");
    expect(ld.longitude).toBeTypeOf("number");
    expect(ld.containsPlace).toBeDefined();
  });

  it("solleva errore (non warning) se manca un campo required, indicando campo e struttura", () => {
    const bad = { ...fixture(), latitude: NaN } as unknown as VacationRentalInput;
    expect(() => buildVacationRentalJsonLd(bad)).toThrow(VacationRentalMarkupError);
    expect(() => buildVacationRentalJsonLd(bad)).toThrow(/latitude/);
    expect(() => buildVacationRentalJsonLd(bad)).toThrow(/Appartamento dei Fiori/);
  });

  it("solleva errore se non ci sono immagini", () => {
    expect(() => buildVacationRentalJsonLd({ ...fixture(), images: [] })).toThrow(/image/);
  });
});

describe("buildVacationRentalJsonLd — containsPlace → Accommodation", () => {
  it("annida correttamente occupancy e i dettagli alloggio", () => {
    const ld = buildVacationRentalJsonLd(fixture());
    const place = ld.containsPlace as Record<string, unknown>;
    expect(place["@type"]).toBe("Accommodation");
    const occ = place.occupancy as Record<string, unknown>;
    expect(occ["@type"]).toBe("QuantitativeValue");
    expect(occ.value).toBe(4);
    expect(place.additionalType).toBe("EntirePlace");
    expect(place.numberOfBedrooms).toBe(2);
    expect(place.numberOfBathroomsTotal).toBe(1);
    const floor = place.floorSize as Record<string, unknown>;
    expect(floor.value).toBe(75);
    expect(floor.unitCode).toBe("MTK");
    const beds = place.bed as Array<Record<string, unknown>>;
    expect(beds).toHaveLength(2);
    expect(beds[0]).toMatchObject({ "@type": "BedDetails", typeOfBed: "Queen", numberOfBeds: 1 });
    const amen = place.amenityFeature as Array<Record<string, unknown>>;
    expect(amen[0]).toMatchObject({ "@type": "LocationFeatureSpecification", value: true });
  });

  it("emette occupancy anche senza blocco accommodation (solo required)", () => {
    const input = { ...fixture() };
    delete input.accommodation;
    const place = buildVacationRentalJsonLd(input).containsPlace as Record<string, unknown>;
    expect((place.occupancy as Record<string, unknown>).value).toBe(4);
    expect(place.numberOfBedrooms).toBeUndefined();
  });
});

describe("buildVacationRentalJsonLd — orari ISO 8601", () => {
  it("normalizza HH:MM a HH:MM:SS", () => {
    const ld = buildVacationRentalJsonLd(fixture());
    expect(ld.checkinTime).toBe("15:00:00");
    expect(ld.checkoutTime).toBe("10:00:00");
  });

  it("mantiene i secondi e l'offset se già presenti", () => {
    const ld = buildVacationRentalJsonLd({ ...fixture(), checkinTime: "14:30:00+02:00" });
    expect(ld.checkinTime).toBe("14:30:00+02:00");
  });

  it("rifiuta formati non ISO come '3:00 PM'", () => {
    expect(() => buildVacationRentalJsonLd({ ...fixture(), checkinTime: "3:00 PM" })).toThrow(
      /ISO 8601/,
    );
  });
});

describe("buildVacationRentalJsonLd — coordinate e immagini", () => {
  it("non arrotonda latitudine/longitudine", () => {
    const ld = buildVacationRentalJsonLd(fixture());
    expect(ld.latitude).toBe(41.909069038726436);
    expect(ld.longitude).toBe(12.459875591084225);
  });

  it("logga un warning se le immagini sono meno di 8, senza fallire", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ld = buildVacationRentalJsonLd({
      ...fixture(),
      images: ["https://esempio.it/a.jpg", "https://esempio.it/b.jpg"],
    });
    expect((ld.image as string[]).length).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/almeno 8/));
    warn.mockRestore();
  });
});

describe("buildVacationRentalJsonLd — recensioni di fonte propria", () => {
  it("ogni review ha datePublished, author.name e reviewRating", () => {
    const reviews = buildVacationRentalJsonLd(fixture()).review as Array<Record<string, unknown>>;
    expect(reviews).toHaveLength(3);
    for (const r of reviews) {
      expect(r["@type"]).toBe("Review");
      expect(typeof r.datePublished).toBe("string");
      expect((r.datePublished as string).length).toBeGreaterThan(0);
      expect((r.author as Record<string, unknown>).name).toBeTruthy();
      expect((r.reviewRating as Record<string, unknown>).ratingValue).toBeDefined();
    }
  });

  it("scarta le review senza datePublished", () => {
    const input = fixture();
    input.reviews = [
      { author: "SenzaData", datePublished: "", ratingValue: 5, body: "x" },
      { author: "ConData", datePublished: "2026-01-01", ratingValue: 5, body: "y" },
    ];
    const reviews = buildVacationRentalJsonLd(input).review as Array<Record<string, unknown>>;
    expect(reviews).toHaveLength(1);
    expect((reviews[0]!.author as Record<string, unknown>).name).toBe("ConData");
  });

  it("aggregateRating usa il PUNTO come separatore decimale (mai virgola)", () => {
    const agg = buildVacationRentalJsonLd(fixture()).aggregateRating as Record<string, unknown>;
    expect(agg.ratingValue).toBe("4.94");
    expect(agg.ratingValue).not.toContain(",");
    expect(agg.reviewCount).toBe(217);
  });

  it("omette aggregateRating e review quando non ci sono recensioni proprie", () => {
    const input = fixture();
    delete input.reviews;
    delete input.aggregateRating;
    const ld = buildVacationRentalJsonLd(input);
    expect(ld.review).toBeUndefined();
    expect(ld.aggregateRating).toBeUndefined();
  });
});

describe("buildVacationRentalJsonLd — omissione graceful e serializzazione", () => {
  it("omette i campi opzionali assenti invece di emettere null/stringhe vuote", () => {
    const minimal: VacationRentalInput = {
      name: "Minimal",
      identifier: "ID-MIN",
      images: ["https://esempio.it/1.jpg"],
      latitude: 41.9,
      longitude: 12.4,
      maxOccupancy: 2,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ld = buildVacationRentalJsonLd(minimal);
    warn.mockRestore();
    expect(ld.description).toBeUndefined();
    expect(ld.address).toBeUndefined();
    expect(ld.checkinTime).toBeUndefined();
    expect(ld.aggregateRating).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("null");
  });

  it("emette @id quando fornito, per legare i blocchi tra pagine", () => {
    const ld = buildVacationRentalJsonLd({ ...fixture(), id: "https://esempio.it/#vacation-rental" });
    expect(ld["@id"]).toBe("https://esempio.it/#vacation-rental");
  });

  it("serializeJsonLd neutralizza il carattere '<'", () => {
    const s = serializeJsonLd({ x: "<script>" });
    expect(s).not.toContain("<script>");
    expect(s).toContain("\\u003cscript");
  });

  it("snapshot dell'output completo per la struttura di esempio", () => {
    expect(buildVacationRentalJsonLd(fixture())).toMatchSnapshot();
  });
});

describe("buildReviewMarkup — blocco recensioni riferito via @id", () => {
  const id = vacationRentalId("https://esempio.it");

  it("emette VacationRental con @id, aggregateRating e review[] (solo recensioni)", () => {
    const node = buildReviewMarkup({
      id,
      url: "https://esempio.it",
      name: "Appartamento dei Fiori",
      reviews: fixture().reviews,
      aggregateRating: { ratingValue: 4.94, reviewCount: 217 },
    });
    expect(node).not.toBeNull();
    expect(node!["@type"]).toBe("VacationRental");
    expect(node!["@id"]).toBe(id);
    expect((node!.aggregateRating as Record<string, unknown>).ratingValue).toBe("4.94");
    expect((node!.review as unknown[]).length).toBe(3);
    // Solo dati recensione: niente campi identità come image/latitude.
    expect(node!.image).toBeUndefined();
    expect(node!.latitude).toBeUndefined();
  });

  it("ritorna null quando non ci sono né recensioni né aggregato", () => {
    expect(buildReviewMarkup({ id, name: "X" })).toBeNull();
  });

  it("vacationRentalId normalizza lo slash finale", () => {
    expect(vacationRentalId("https://esempio.it/")).toBe("https://esempio.it/#vacation-rental");
    expect(vacationRentalId("https://esempio.it")).toBe("https://esempio.it/#vacation-rental");
  });
});
