/**
 * Test per la route POST /api/bookings/[code]/guest-cancel
 * Verifica token, policy di cancellazione e rimborso.
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
  freeNights: vi.fn(),
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
    checkin: daysFromNow(20), // Lontano → rimborso eligibile
    checkout: daysFromNow(24),
    total_price: 400,
    status: "completed",
    deposit_amount: 200,
    balance_due: 224,
    city_tax: 24,
    stripe_payment_intent_id: "pi_test123",
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

  it("cancella con rimborso se checkin è lontano > 15 giorni", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(20) });
    // Cancellazione atomica: la route esegue UNA sola query (CTE lock+update) che
    // restituisce lo stato precedente della prenotazione.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);

    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.refundEligible).toBe(true);
    expect(data.refundAmount).toBeGreaterThan(0);
  });

  it("cancella con rimborso parziale se checkin è tra cancelHalfRefundDays e cancelFullRefundDays", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(5) });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);

    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.refundEligible).toBe(true);
    expect(data.refundReason).toBe("half");
    // cancelPartialRefundPct=50% di 200 = 100, meno trattenuta cancelFeePercent=5% di 200 = 10 → 90
    expect(data.refundAmount).toBe(90);
  });

  it("cancella senza rimborso se checkin è entro 2 giorni", async () => {
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

  it("calcola la trattenuta del 5% sull'importo rimborsabile", async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(true);
    const booking = makeBooking({ checkin: daysFromNow(20), deposit_amount: 200 });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [booking] } as never);

    const { POST } = await import("@/app/api/bookings/[code]/guest-cancel/route");
    const res = await POST(makeRequest("CM-ABCD12"), makeContext("CM-ABCD12"));
    const data = await res.json();
    // 200 - 5% = 190
    expect(data.refundAmount).toBeCloseTo(190, 1);
  });
});
