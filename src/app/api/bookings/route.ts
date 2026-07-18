import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { generateBookingCode } from "@/lib/bookingCode";
import { sendHostNotification, sendBookingRequestAutoReply } from "@/lib/email";
import { localeOrder, type LocaleCode } from "@/i18n/index";
import { hasOverlappingBooking } from "@/lib/bookingOverlap";
import { bookableUnits, rootUnitId } from "@/lib/structure";
import { checkRateLimit } from "@/lib/rateLimit";
import { computePricingBreakdown } from "@/lib/pricing";
import { refundPolicyOf } from "@/lib/refund";
import { nightsBetween } from "@/lib/dateOnly";
import { POLICIES } from "@/lib/policies";
import { getFile } from "@/lib/githubContent";
import { availPath } from "@/lib/unitAvailability";
import {
  makeDayRateFn,
  stayLimitsFor,
  availableGapNights,
  type DayRate,
  type StayRule,
  type AvailabilityData,
} from "@/data/availability";
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

  const nights = nightsBetween(body.checkin, body.checkout);

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

  // Regole di durata soggiorno dell'UNITÀ prenotata: lette dal suo calendario per-unità
  // (src/data/availability/<unitId>.json → stayRules + overrides). Fallback ai default di
  // policy se il file non è leggibile.
  let unitRules: StayRule[] = [];
  let unitGetRate: (d: Date) => DayRate = () => ({ date: "", price: 0, status: "available" });
  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(availPath(unitId), token);
    const availData = JSON.parse(content) as AvailabilityData;
    unitRules = availData.stayRules ?? [];
    unitGetRate = makeDayRateFn(availData.defaultPrice, availData.overrides ?? []);
  } catch {
    /* calendario non leggibile: solo default di policy */
  }
  const limits = stayLimitsFor(body.checkin, unitRules, { min: POLICIES.minNights, max: POLICIES.maxNights });
  if (nights > limits.max) {
    return NextResponse.json({ error: `Soggiorno massimo: ${limits.max} notti` }, { status: 400 });
  }

  // Preavviso minimo: il check-in deve essere almeno `minAdvanceBookingDays` giorni dopo oggi.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minCheckin = new Date(today);
  minCheckin.setDate(minCheckin.getDate() + POLICIES.minAdvanceBookingDays);
  const [cy, cm, cd] = body.checkin.split("-").map(Number);
  const checkinDate = new Date(cy!, (cm ?? 1) - 1, cd ?? 1);
  if (checkinDate < minCheckin) {
    return NextResponse.json(
      { error: `Il check-in deve essere almeno ${POLICIES.minAdvanceBookingDays} giorni dopo la data odierna.` },
      { status: 400 }
    );
  }

  // Durata minima (difesa lato server; il calendario la applica già lato client). Eccezione:
  // se il soggiorno riempie ESATTAMENTE un buco disponibile dell'unità (nights === buco), è
  // ammesso anche sotto il minimo — così il server non rifiuta una selezione valida del client.
  if (nights < limits.min && nights !== availableGapNights(body.checkin, unitGetRate)) {
    return NextResponse.json(
      { error: `Il soggiorno minimo è di ${limits.min} notti.` },
      { status: 400 }
    );
  }

  const code = generateBookingCode();

  const pricing = body.totalPrice
    ? computePricingBreakdown(body.totalPrice, body.guests, body.checkin, body.checkout)
    : null;

  // Congela la politica di rimborso corrente dell'host su QUESTA prenotazione: un
  // eventuale cambio successivo di policy non tocca le prenotazioni già create.
  const frozenRefundPolicy = refundPolicyOf(POLICIES.refundPolicy);

  await pool.query(
    `INSERT INTO bookings
      (code, first_name, last_name, email, phone, guests, checkin, checkout, total_price, message, status, locale, city_tax, city_tax_online, refund_policy, unit_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,true,$13,$14)`,
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
      pricing?.cityTax ?? null,
      frozenRefundPolicy,
      unitId,
    ]
  );

  try {
    await sendHostNotification({
      code,
      unitId,
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
      unitId,
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
