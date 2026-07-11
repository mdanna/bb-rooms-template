/**
 * Test per la route GET /api/admin/dashboard
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  pool: { query: vi.fn() },
  ensureSchema: vi.fn(),
}));

import { auth } from "@/auth";
import { pool } from "@/lib/db";

const MOCK_SESSION = { user: { name: "Admin" } };
const MOCK_QUARTERS = [
  { year: 2025, quarter: 3, bookings: 5, revenue: "2500.00", city_tax: "120.00" },
  { year: 2025, quarter: 2, bookings: 3, revenue: "1200.00", city_tax: "72.00" },
];

describe("GET /api/admin/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rigetta richieste non autenticate (401)", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/admin/dashboard/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("restituisce i dati per trimestre", async () => {
    vi.mocked(auth).mockResolvedValueOnce(MOCK_SESSION as never);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: MOCK_QUARTERS } as never);

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.quarters).toHaveLength(2);
    expect(data.quarters[0].year).toBe(2025);
    expect(data.quarters[0].quarter).toBe(3);
  });

  it("restituisce array vuoto se non ci sono prenotazioni", async () => {
    vi.mocked(auth).mockResolvedValueOnce(MOCK_SESSION as never);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const res = await GET();
    const data = await res.json();
    expect(data.quarters).toEqual([]);
  });
});
