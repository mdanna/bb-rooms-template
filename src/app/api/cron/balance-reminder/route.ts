import { NextResponse } from "next/server";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { generateAccessToken } from "@/lib/accessToken";
import { sendBalanceReminderEmail } from "@/lib/email";
import { POLICIES } from "@/lib/policies";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}

async function sendReminder(booking: Booking): Promise<void> {
  const token = generateAccessToken(booking.code);
  const payBalanceUrl = `${siteUrl()}/pay-balance/${booking.code}?t=${encodeURIComponent(token)}`;
  await sendBalanceReminderEmail({
    to: booking.email,
    code: booking.code,
    firstName: booking.first_name,
    checkin: booking.checkin,
    checkout: booking.checkout,
    balanceDue: booking.balance_due,
    cityTax: booking.city_tax,
    cityTaxOnline: booking.city_tax_online,
    payBalanceUrl,
    locale: (booking.locale as import("@/i18n/index").LocaleCode) ?? "it",
  });
}

export async function GET(request: Request) {
  // Vercel Cron sends CRON_SECRET as Authorization: Bearer <secret>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  await ensureSchema();

  const sent: string[] = [];
  const errors: string[] = [];

  // First reminder
  const fiveDays = new Date();
  fiveDays.setDate(fiveDays.getDate() + POLICIES.balanceReminderDaysFirst);
  const fiveDayTarget = fiveDays.toISOString().slice(0, 10);

  const firstResult = await pool.query<Booking>(
    `SELECT * FROM bookings
     WHERE checkin = $1
       AND status = 'completed'
       AND balance_paid_at IS NULL
       AND balance_reminder_sent_at IS NULL`,
    [fiveDayTarget]
  );

  for (const booking of firstResult.rows) {
    try {
      await sendReminder(booking);
      await pool.query(
        `UPDATE bookings SET balance_reminder_sent_at = now() WHERE id = $1`,
        [booking.id]
      );
      sent.push(`${booking.code}:first`);
    } catch (err) {
      errors.push(`${booking.code}:first: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Second reminder
  const twoDays = new Date();
  twoDays.setDate(twoDays.getDate() + POLICIES.balanceReminderDaysSecond);
  const twoDayTarget = twoDays.toISOString().slice(0, 10);

  const secondResult = await pool.query<Booking>(
    `SELECT * FROM bookings
     WHERE checkin = $1
       AND status = 'completed'
       AND balance_paid_at IS NULL
       AND balance_reminder_2_sent_at IS NULL`,
    [twoDayTarget]
  );

  for (const booking of secondResult.rows) {
    try {
      await sendReminder(booking);
      await pool.query(
        `UPDATE bookings SET balance_reminder_2_sent_at = now() WHERE id = $1`,
        [booking.id]
      );
      sent.push(`${booking.code}:second`);
    } catch (err) {
      errors.push(`${booking.code}:second: ${err instanceof Error ? err.message : err}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
