import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const archived = body?.archived !== false; // default: archivia

  await ensureSchema();

  const result = await pool.query<Booking>(
    `UPDATE bookings SET archived = $2 WHERE id = $1 RETURNING *`,
    [id, archived]
  );

  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, booking });
}
