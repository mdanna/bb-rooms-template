import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { DEMO_MODE, DEMO_BOOKINGS } from "@/lib/demo";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (DEMO_MODE) return NextResponse.json({ bookings: DEMO_BOOKINGS });

  await ensureSchema();
  const result = await pool.query<Booking>(
    `SELECT * FROM bookings ORDER BY created_at DESC`
  );

  return NextResponse.json({ bookings: result.rows });
}
