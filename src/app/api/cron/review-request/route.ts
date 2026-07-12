import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { generateAccessToken } from "@/lib/accessToken";
import { sendReviewRequestEmail } from "@/lib/email";

// Giorni dopo il check-out in cui inviare l'invito a lasciare una recensione.
const REVIEW_REQUEST_DELAY_DAYS = 1;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}

export async function GET(request: Request) {
  // Vercel Cron invia CRON_SECRET come Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  await ensureSchema();

  const sent: string[] = [];
  const errors: string[] = [];

  // Bersaglio: prenotazioni il cui check-out è avvenuto REVIEW_REQUEST_DELAY_DAYS giorni fa,
  // completate (l'ospite ha soggiornato) e non ancora sollecitate.
  const target = new Date();
  target.setDate(target.getDate() - REVIEW_REQUEST_DELAY_DAYS);
  const targetDate = target.toISOString().slice(0, 10);

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings
     WHERE checkout = $1
       AND status = 'completed'
       AND review_request_sent_at IS NULL`,
    [targetDate]
  );

  for (const booking of result.rows) {
    try {
      const token = generateAccessToken(booking.code);
      const reviewUrl = `${siteUrl()}/recensioni/scrivi?code=${encodeURIComponent(booking.code)}&t=${encodeURIComponent(token)}`;
      await sendReviewRequestEmail({
        to: booking.email,
        code: booking.code,
        firstName: booking.first_name,
        reviewUrl,
        locale: (booking.locale as import("@/i18n/index").LocaleCode) ?? "it",
      });
      await pool.query(
        `UPDATE bookings SET review_request_sent_at = now() WHERE id = $1`,
        [booking.id]
      );
      sent.push(booking.code);
    } catch (err) {
      errors.push(`${booking.code}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
