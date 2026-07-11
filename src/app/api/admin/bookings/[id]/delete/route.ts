import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema } from "@/lib/db";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { id } = await context.params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  await ensureSchema();

  const check = await pool.query(
    `SELECT status FROM bookings WHERE id = $1`,
    [bookingId]
  );
  if (check.rows.length === 0) {
    return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  }
  if (!["cancelled", "rejected"].includes(check.rows[0].status)) {
    return NextResponse.json(
      { error: "Solo le prenotazioni annullate o rifiutate possono essere eliminate" },
      { status: 400 }
    );
  }

  await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);

  return NextResponse.json({ ok: true });
}
