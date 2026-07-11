import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { sendManagementLinkEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const rate = checkRateLimit(request, "management-link", 5, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Troppe richieste. Riprova tra qualche minuto." }, { status: 429 });
  }

  const { code } = await context.params;
  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1`,
    [code.toUpperCase()]
  );
  const booking = result.rows[0];
  if (!booking) {
    // Return generic success to avoid leaking whether a code exists
    return NextResponse.json({ ok: true });
  }

  try {
    await sendManagementLinkEmail({
      to: booking.email,
      code: booking.code,
      firstName: booking.first_name,
      locale: (booking.locale as import("@/i18n/index").LocaleCode) ?? "it",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invio email fallito" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
