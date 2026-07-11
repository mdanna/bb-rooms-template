import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { sendRejectionEmail } from "@/lib/email";
import type { LocaleCode } from "@/i18n/index";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "Indica un motivo per il rifiuto" }, { status: 400 });
  }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `UPDATE bookings SET status = 'rejected', rejection_reason = $2
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, reason]
  );

  const booking = result.rows[0];
  if (!booking) {
    return NextResponse.json(
      { error: "Prenotazione non trovata o non più in attesa" },
      { status: 404 }
    );
  }

  let emailError: string | null = null;
  try {
    await sendRejectionEmail({
      to: booking.email,
      code: booking.code,
      reason,
      locale: (booking.locale as LocaleCode) ?? "it",
    });
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Invio email fallito";
  }

  return NextResponse.json({ ok: true, booking, emailError });
}
