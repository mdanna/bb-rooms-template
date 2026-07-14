/**
 * Test per la route POST /api/bookings/[code]/guest-cancel
 * Verifica token e calcolo del rimborso secondo la policy CONGELATA (refund.ts).
 * La policy di default del sito è "moderate" (src/data/policies.json), franchigia 3,5%.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  pool: { query: vi.fn() },
  ensureSchema: vi.fn(),
}));
vi.mock("@/lib/accessToken", () => ({
  verifyAccessToken: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendGuestCancellationEmail: vi.fn(),
  sendHostCancellationNotification: vi.fn(),
}));
vi.mock("@/lib/syncAvailability", () => ({
  unmarkNightsBooked: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true }),
}));

import { pool } from "@/lib/db";
import { verifyAccessToken } from "@/lib/accessToken";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function makeBooking(overrides = {}) {
  return {
    id: 1,
    code: "CM-ABCD12",
    first_name: "Mario",
    last_name: "Rossi",
    email: "mario@example.com",
    locale: "it",
    guests: 2,
    checkin: daysFromNow(20),
    checkout: daysFromNow(24),
    total_price: 400,
    custom_price: null,
    status: "completed",
    city_tax: 24,
    city_tax_online: false,
    refund_policy: "moderate",
    refund_due: null,
    stripe_payment_intent_id: "pi_test123",
    // Prenotazione fatta 30 giorni fa → la grazia 48h non si applica mai in questi test.
    created_at: daysFromNow(-30) + "T00:00:00.000Z",
    paid_at: new Date().toISOString(),
    refunded_at: null,
    ...overrides,
  };
}

function makeRequest(code: string, token = "valid-token") {
  return new Request(`http://localhost/api/bookings/${code}/guest-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify({ token }),
  });
}

function makeContext(code: string) {
  return { params: Promise.resolve({ code }) };
}

describe("POST /api/bookings/[code]/guest-cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  it("rigetta token non valido (401)", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(false);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    expect(res.status).toBe(401);
  });

  it("risponde 404 se la prenotazione non esiste", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-NOTFOUND"), makeContext("CM-NOTFOUND"));
    expect(res.status).toBe(404);
  });

  it("policy moderate: rimborso pieno del soggiorno meno franchigia 3,5% se ≥5 giorni prima", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(20) });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.refundEligible).toBe(true);
    // 400 - round(400 × 3,5%) = 400 - 14 = 386
    expect(data.refundAmount).toBe(386);
  });

  it("policy moderate: nessun rimborso se il check-in è entro la soglia", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(1) });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.refundEligible).toBe(false);
    expect(data.refundAmount).toBeNull();
  });

  it("policy strict: rimborso parziale 50% (senza franchigia) tra 7 e 30 giorni", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ refund_policy: "strict", checkin: daysFromNow(10) });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.refundEligible).toBe(true);
    // 50% di 400 = 200, nessuna franchigia sui rimborsi parziali
    expect(data.refundAmount).toBe(200);
  });

  it("tassa di soggiorno online: rimborsata al 100% oltre alla quota soggiorno", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(20), city_tax_online: true, city_tax: 24 });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    // 386 (soggiorno) + 24 (tassa) = 410
    expect(data.refundAmount).toBe(410);
  });

  it("paga-al-check-in (nessun PaymentIntent): niente da rimborsare", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(20), stripe_payment_intent_id: null, payment_method: "checkin" });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);
    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.wasPaid).toBe(false);
    expect(data.refundEligible).toBe(false);
    expect(data.refundAmount).toBeNull();
  });
});
