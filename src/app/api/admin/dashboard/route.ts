import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema } from "@/lib/db";
import { DEMO_MODE, DEMO_QUARTERS } from "@/lib/demo";

interface QuarterRow {
  year: number;
  quarter: number;
  bookings: number;
  revenue: number;
  city_tax: number;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (DEMO_MODE) return NextResponse.json({ quarters: DEMO_QUARTERS });

  await ensureSchema();

  const result = await pool.query<QuarterRow>(`
    SELECT
      EXTRACT(YEAR FROM checkin)::int AS year,
      EXTRACT(QUARTER FROM checkin)::int AS quarter,
      COUNT(*)::int AS bookings,
      COALESCE(SUM(total_price), 0)::numeric AS revenue,
      COALESCE(SUM(city_tax), 0)::numeric AS city_tax
    FROM bookings
    WHERE status IN ('completed', 'approved')
    GROUP BY year, quarter
    ORDER BY year DESC, quarter DESC
  `);

  return NextResponse.json({ quarters: result.rows });
}
