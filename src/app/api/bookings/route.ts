import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { generateBookingCode } from "@/lib/bookingCode";
import { sendHostNotification, sendBookingRequestAutoReply } from "@/lib/email";
import { localeOrder, type LocaleCode } from "@/i18n/index";
import { hasOverlappingBooking } from "@/lib/bookingOverlap";
import { bookableUnits, rootUnitId } from "@/lib/structure";
import { checkRateLimit } from "@/lib/rateLimit";
import { computePricingBreakdown, MIN_DEPOSIT_RATE, MAX_DEPOSIT_RATE, DEFAULT_DEPOSIT_RATE } from "@/lib/pricing";
import { nightsBetween } from "@/lib/dateOnly";
import { POLICIES } from "@/lib/policies";
import { DEMO_MODE } from "@/lib/demo";

const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MAX_MESSAGE_LENGTH = 1000;

interface CreateBookingBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guests: number;
  checkin: string;
  checkout: string;
  totalPrice: number | null;
  depositRate?: number;
  message: string;
  locale: string;
  // Struttura con camere: unità prenotata (appartamento intero o singola camera).
  // Assente → unità radice. Validata contro le unità affittabili.
  unitId?: string;
}

function isValid(body: unknown): body is CreateBookingBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.firstName === "string" &&
    b.firstName.trim().length > 0 &&
    b.firstName.length <= MAX_NAME_LENGTH &&
    typeof b.lastName === "string" &&
    b.lastName.trim().length > 0 &&
    b.lastName.length <= MAX_NAME_LENGTH &&
    typeof b.email === "string" &&
    b.email.length <= 254 &&
    /\S+@\S+\.\S+/.test(b.email) &&
    typeof b.phone === "string" &&
    b.phone.trim().length > 0 &&
    b.phone.length <= MAX_PHONE_LENGTH &&
    typeof b.guests === "number" &&
    b.guests > 0 &&
    b.guests <= POLICIES.maxGuests &&
    typeof b.checkin === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.checkin) &&
    typeof b.checkout === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.checkout) &&
    b.checkin < b.checkout &&
    (b.message === undefined || (typeof b.message === "string" && b.message.length <= MAX_MESSAGE_LENGTH))
  );
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "bookings-create", 5, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!isValid(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  if (nightsBetween(body.checkin, body.checkout) > POLICIES.maxNights) {
    return NextResponse.json({ error: `Soggiorno massimo: ${POLICIES.maxNights} notti` }, { status: 400 });
  }

  // Validate deposit rate
  const rawRate = typeof body.depositRate === "number" ? body.depositRate : DEFAULT_DEPOSIT_RATE;
  const depositRate = Math.min(Math.max(rawRate, MIN_DEPOSIT_RATE), MAX_DEPOSIT_RATE);

  const locale: LocaleCode = (localeOrder as string[]).includes(body.locale)
    ? (body.locale as LocaleCode)
    : "it";

  // Demo: nessuna scrittura sul DB né invio email. Si simula il successo con un
  // codice fittizio, così il form mostra la conferma della richiesta inviata.
  if (DEMO_MODE) {
    return NextResponse.json({ ok: true, code: generateBookingCode() });
  }

  await ensureSchema();

  // Unità prenotata: se assente o non affittabile, ricade sull'unità radice.
  const unitId =
    typeof body.unitId === "string" && bookableUnits().some((u) => u.id === body.unitId)
      ? body.unitId
      : rootUnitId();

  if (await hasOverlappingBooking(unitId, body.checkin, body.checkout)) {
    return NextResponse.json(
      { error: "Le date richieste non sono più disponibili." },
      { status: 409 }
    );
  }

  // Minimum 2 days advance notice
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minCheckin = new Date(today);
  minCheckin.setDate(minCheckin.getDate() + 2);
  const [cy, cm, cd] = body.checkin.split("-").map(Number);
  const checkinDate = new Date(cy!, (cm ?? 1) - 1, cd ?? 1);
  if (checkinDate < minCheckin) {
    return NextResponse.json(
      { error: `Il check-in deve essere almeno ${POLICIES.minAdvanceBookingDays} giorni dopo la data odierna.` },
      { status: 400 }
    );
  }

  // Minimum 3 nights (enforced client-side too, server validates as defence)
  const [oy, om, od] = body.checkout.split("-").map(Number);
  const checkoutDate = new Date(oy!, (om ?? 1) - 1, od ?? 1);
  const nights = Math.round((checkoutDate.getTime() - checkinDate.getTime()) / 86_400_000);
  if (nights < 2) {
    return NextResponse.json(
      { error: "Il soggiorno minimo è di 2 notti." },
      { status: 400 }
    );
  }

  const code = generateBookingCode();

  const pricing = body.totalPrice
    ? computePricingBreakdown(body.totalPrice, body.guests, body.checkin, body.checkout, depositRate)
    : null;

  await pool.query(
    `INSERT INTO bookings
      (code, first_name, last_name, email, phone, guests, checkin, checkout, total_price, message, status, locale, deposit_amount, city_tax, balance_due, deposit_rate, city_tax_online, unit_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$13,$14,$15,true,$16)`,
    [
      code,
      body.firstName,
      body.lastName,
      body.email,
      body.phone,
      body.guests,
      body.checkin,
      body.checkout,
      body.totalPrice,
      body.message || null,
      locale,
      pricing?.depositAmount ?? null,
      pricing?.cityTax ?? null,
      pricing?.balanceDue ?? null,
      pricing ? depositRate : null,
      unitId,
    ]
  );

  try {
    await sendHostNotification({
      code,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      guests: body.guests,
      checkin: body.checkin,
      checkout: body.checkout,
      totalPrice: body.totalPrice,
      message: body.message || null,
    });
  } catch {
    // L'email di notifica all'host è "best effort": non deve bloccare la creazione della richiesta.
  }

  try {
    await sendBookingRequestAutoReply({
      to: body.email,
      code,
      firstName: body.firstName,
      checkin: body.checkin,
      checkout: body.checkout,
      locale,
    });
  } catch {
    // Best effort.
  }

  return NextResponse.json({ ok: true, code });
}
