/**
 * Test per la route POST /api/bookings
 * Il database e le funzioni di email sono mocckati per testare
 * esclusivamente la logica di validazione e risposta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del DB e delle dipendenze esterne prima di importare la route
vi.mock("@/lib/db", () => ({
  pool: { query: vi.fn() },
  ensureSchema: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendHostNotification: vi.fn(),
  sendBookingRequestAutoReply: vi.fn(),
}));
vi.mock("@/lib/bookingOverlap", () => ({
  hasOverlappingBooking: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true }),
}));
vi.mock("@/lib/bookingCode", () => ({
  generateBookingCode: vi.fn().mockReturnValue("CM-ABCD12"),
}));
vi.mock("@/lib/pricing", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/pricing")>();
  return { ...real };
});
// La route carica la disponibilità PER UNITÀ da GitHub per le regole di soggiorno:
// mock deterministico (calendario vuoto → solo default di policy, nessun buco rilevante).
vi.mock("@/lib/githubContent", () => ({
  getFile: vi.fn().mockResolvedValue({ content: JSON.stringify({ defaultPrice: 100, overrides: [] }), sha: "sha" }),
  putFile: vi.fn().mockResolvedValue({ commitSha: "sha" }),
  requireBotToken: vi.fn().mockReturnValue("token"),
}));

import { pool } from "@/lib/db";

function makeRequest(body: unknown, ip = "127.0.0.1") {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

// Checkin sempre nel futuro (oggi + 10 giorni)
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const VALID_BODY = {
  firstName: "Mario",
  lastName: "Rossi",
  email: "mario@example.com",
  phone: "+39 333 1234567",
  guests: 2,
  checkin: futureDate(10),
  checkout: futureDate(14),
  totalPrice: 400,
  message: "Ciao",
  locale: "it",
};

describe("POST /api/bookings — validazione input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simula INSERT che restituisce successo
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as never);
  });

  it("accetta una richiesta valida e restituisce il codice", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makeRequest(VALID_BODY));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.code).toBe("CM-ABCD12");
  });

  it("rigetta richiesta senza firstName", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makeRequest({ ...VALID_BODY, firstName: "" }));
    expect(res.status).toBe(400);
  });

  it("rigetta email non valida", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makeRequest({ ...VALID_BODY, email: "notanemail" }));
    expect(res.status).toBe(400);
  });

  it("rigetta numero di ospiti 0", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makeRequest({ ...VALID_BODY, guests: 0 }));
    expect(res.status).toBe(400);
  });

  it("rigetta checkout uguale al checkin", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const d = futureDate(10);
    const res = await POST(makeRequest({ ...VALID_BODY, checkin: d, checkout: d }));
    expect(res.status).toBe(400);
  });

  it("rigetta checkin meno di minAdvanceBookingDays giorni da oggi", async () => {
    const { POLICIES } = await import("@/lib/policies");
    const { POST } = await import("@/app/api/bookings/route");
    // Un giorno sotto la soglia di preavviso della policy (guardato a ≥0).
    const belowAdvance = Math.max(0, POLICIES.minAdvanceBookingDays - 1);
    const res = await POST(
      makeRequest({ ...VALID_BODY, checkin: futureDate(belowAdvance), checkout: futureDate(belowAdvance + 3) })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/almeno \d+ giorni/);
  });

  it("rigetta soggiorno superiore a maxNights (400)", async () => {
    const { POLICIES } = await import("@/lib/policies");
    const { POST } = await import("@/app/api/bookings/route");
    const maxN = POLICIES.maxNights;
    const res = await POST(
      makeRequest({ ...VALID_BODY, checkin: futureDate(10), checkout: futureDate(10 + maxN + 1) })
    );
    expect(res.status).toBe(400);
  });

  it("applica il soggiorno minimo di notti secondo la policy", async () => {
    const { POLICIES } = await import("@/lib/policies");
    const { POST } = await import("@/app/api/bookings/route");
    const start = 10 + POLICIES.minAdvanceBookingDays;
    if (POLICIES.minNights > 1) {
      // Un soggiorno di (min-1) notti, oltre il preavviso, va rifiutato.
      const res = await POST(
        makeRequest({ ...VALID_BODY, checkin: futureDate(start), checkout: futureDate(start + POLICIES.minNights - 1) })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("soggiorno minimo");
    } else {
      // minNights = 1: un soggiorno di 1 notte è valido.
      const res = await POST(
        makeRequest({ ...VALID_BODY, checkin: futureDate(start), checkout: futureDate(start + 1) })
      );
      expect(res.status).toBe(200);
    }
  });

  it("rigetta se ci sono prenotazioni sovrapposte (409)", async () => {
    const { hasOverlappingBooking } = await import("@/lib/bookingOverlap");
    vi.mocked(hasOverlappingBooking).mockResolvedValueOnce(true);

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("rigetta body non JSON (400)", async () => {
    const { POST } = await import("@/app/api/bookings/route");
    const req = new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
