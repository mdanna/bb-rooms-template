import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool, ensureReviewSchema } from "@/lib/db";
import { REVIEWS_CACHE_TAG } from "@/lib/reviews";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyAccessToken } from "@/lib/accessToken";
import { localeOrder, type LocaleCode } from "@/i18n/index";
import { sendReviewNotification } from "@/lib/email";
import { DEMO_MODE, demoWriteBlocked } from "@/lib/demo";

const MAX_NAME = 80;
const MAX_BODY = 2000;
const MIN_BODY = 10;
const MAX_STAY = 40;
const MAX_CODE = 40;

interface CreateReviewBody {
  author: string;
  email?: string;
  rating: number;
  body: string;
  locale: string;
  stayMonth?: string;
  bookingCode?: string;
  token?: string;
  consent: boolean;
}

function isValid(b: unknown): b is CreateReviewBody {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.author === "string" &&
    r.author.trim().length > 0 &&
    r.author.length <= MAX_NAME &&
    typeof r.rating === "number" &&
    Number.isInteger(r.rating) &&
    r.rating >= 1 &&
    r.rating <= 5 &&
    typeof r.body === "string" &&
    r.body.trim().length >= MIN_BODY &&
    r.body.length <= MAX_BODY &&
    typeof r.locale === "string" &&
    (localeOrder as readonly string[]).includes(r.locale) &&
    // Il consenso alla pubblicazione è obbligatorio per inviare.
    r.consent === true &&
    (r.email === undefined || (typeof r.email === "string" && r.email.length <= 254)) &&
    (r.stayMonth === undefined || (typeof r.stayMonth === "string" && r.stayMonth.length <= MAX_STAY)) &&
    (r.bookingCode === undefined || (typeof r.bookingCode === "string" && r.bookingCode.length <= MAX_CODE)) &&
    (r.token === undefined || (typeof r.token === "string" && r.token.length <= 200))
  );
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "reviews-create", 3, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche minuto." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!isValid(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  // Demo: nessuna scrittura, risposta di successo simulata (vetrina).
  if (DEMO_MODE) return demoWriteBlocked();

  const author = body.author.trim();
  const email = body.email?.trim() || null;
  const text = body.body.trim();
  const locale = body.locale as LocaleCode;
  const stayMonth = body.stayMonth?.trim() || null;
  const bookingCode = body.bookingCode?.trim() || null;
  const token = body.token?.trim() || null;

  await ensureReviewSchema();

  // Verifica soggiorno (badge, non requisito). Due strade:
  // 1) Token firmato dall'email di richiesta recensione (link con codice + t): prova da solo
  //    che è l'ospite reale → verificato senza richiedere di nuovo l'email.
  // 2) Fallback manuale: codice prenotazione + email che corrisponde a una prenotazione reale.
  let verified = false;
  if (bookingCode && token && verifyAccessToken(bookingCode, token)) {
    verified = true;
  } else if (bookingCode && email) {
    try {
      const { rows } = await pool.query<{ id: number }>(
        `SELECT id FROM bookings WHERE code = $1 AND lower(email) = lower($2) LIMIT 1`,
        [bookingCode, email],
      );
      verified = rows.length > 0;
    } catch {
      verified = false;
    }
  }

  await pool.query(
    `INSERT INTO reviews (author_name, author_email, rating, body, locale, stay_month, booking_code, verified, status, consent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', true)`,
    [author, email, body.rating, text, locale, stayMonth, bookingCode, verified],
  );

  // La recensione è 'pending' → non compare finché non è moderata, ma invalidiamo
  // comunque la cache per coerenza.
  revalidateTag(REVIEWS_CACHE_TAG, "max");

  // Notifica all'host (best-effort: un errore email non deve far fallire l'invio).
  try {
    await sendReviewNotification({ author, rating: body.rating, body: text, verified, stayMonth });
  } catch {
    // ignora: la recensione è già salvata e visibile in moderazione
  }

  return NextResponse.json({ ok: true });
}
