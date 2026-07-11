/**
 * Test per la route POST /api/admin/bookings/[id]/approve
 * Verifica autenticazione, validazione stato e anti-overlap.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  pool: { query: vi.fn() },
  ensureSchema: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendApprovalEmail: vi.fn(),
}));
vi.mock("@/lib/bookingOverlap", () => ({
  hasOverlappingBooking: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/syncAvailability", () => ({
  markNightsBooked: vi.fn(),
}));
vi.mock("@/lib/pricing", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/pricing")>();
  return { ...real };
});

import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { hasOverlappingBooking } from "@/lib/bookingOverlap";

const MOCK_SESSION = { user: { name: "Admin" } };

const MOCK_BOOKING = {
  id: 1,
  code: "CM-ABCD12",
  first_name: "Mario",
  last_name: "Rossi",
  email: "mario@example.com",
  phone: "+39333",
  locale: "it",
  guests: 2,
  checkin: "2025-08-10",
  checkout: "2025-08-14",
  total_price: 400,
  message: null,
  status: "pending",
  rejection_reason: null,
  payment_method: null,
  paid_at: null,
  created_at: new Date().toISOString(),
  archived: false,
  deposit_amount: 200,
  balance_due: 224,
  city_tax: 24,
  stripe_payment_intent_id: null,
  refunded_at: null,
  balance_reminder_sent_at: null,
  balance_paid_at: null,
  balance_payment_intent_id: null,
};

function makeRequest(id: string) {
  return new Request(`http://localhost/api/admin/bookings/${id}/approve`, {
    method: "POST",
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/bookings/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rigetta richieste non autenticate (401)", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/admin/bookings/[id]/approve/route");
    const res = await POST(makeRequest("1"), makeContext("1"));
    expect(res.status).toBe(401);
  });

  it("approva la prenotazione e risponde 200 con il booking", async () => {
    vi.mocked(auth).mockResolvedValueOnce(MOCK_SESSION as never);
    vi.mocked(pool.query)
      // SELECT della prenotazione pending
      .mockResolvedValueOnce({ rows: [MOCK_BOOKING] } as never)
      // UPDATE a approved
      .mockResolvedValueOnce({ rows: [{ ...MOCK_BOOKING, status: "approved" }] } as never);

    const { POST } = await import("@/app/api/admin/bookings/[id]/approve/route");
    const res = await POST(makeRequest("1"), makeContext("1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("risponde 404 se la prenotazione non esiste", async () => {
    vi.mocked(auth).mockResolvedValueOnce(MOCK_SESSION as never);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const { POST } = await import("@/app/api/admin/bookings/[id]/approve/route");
    const res = await POST(makeRequest("999"), makeContext("999"));
    expect(res.status).toBe(404);
  });

  it("risponde 409 se le date si sovrappongono a un'altra prenotazione", async () => {
    vi.mocked(auth).mockResolvedValueOnce(MOCK_SESSION as never);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [MOCK_BOOKING] } as never);
    vi.mocked(hasOverlappingBooking).mockResolvedValueOnce(true);

    const { POST } = await import("@/app/api/admin/bookings/[id]/approve/route");
    const res = await POST(makeRequest("1"), makeContext("1"));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("sovrappongono");
  });
});
