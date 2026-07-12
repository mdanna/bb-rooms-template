import { unstable_cache } from "next/cache";
import { pool, ensureReviewSchema, type Review } from "@/lib/db";
import type { LocaleCode } from "@/i18n/index";
import type { VacationRentalReview } from "@/lib/vacationRentalJsonLd";

/** Tag di cache per invalidare (revalidateTag) dopo ogni azione di moderazione. */
export const REVIEWS_CACHE_TAG = "reviews";

/**
 * Recensioni di fonte propria PUBBLICATE (status='published', consenso dato),
 * ordinate dalla più recente. Lettura molto frequente (pagina + markup su ogni
 * pagina): risultato in cache, invalidata via revalidateTag(REVIEWS_CACHE_TAG).
 *
 * Graceful: se il DB non è configurato o la query fallisce (es. build senza
 * database, ambiente demo), ritorna [] → la pagina mostra l'invito a recensire e
 * il markup semplicemente non include aggregateRating/review.
 */
export const getPublishedReviews = unstable_cache(
  async (): Promise<Review[]> => {
    try {
      await ensureReviewSchema();
      const { rows } = await pool.query<Review>(
        `SELECT * FROM reviews
         WHERE status = 'published' AND consent = true
         ORDER BY published_at DESC NULLS LAST, created_at DESC`,
      );
      return rows;
    } catch {
      return [];
    }
  },
  ["published-reviews"],
  { tags: [REVIEWS_CACHE_TAG] },
);

/** Testo della recensione nella lingua richiesta, con fallback a IT e all'originale. */
export function pickReviewText(review: Review, locale: LocaleCode): string {
  const t = review.translations;
  if (t && typeof t === "object") {
    return (t[locale] || t.it || "").trim() || review.body;
  }
  return review.body;
}

/** `published_at` (o data di creazione) in formato ISO `YYYY-MM-DD` per datePublished. */
export function reviewDatePublished(review: Review): string {
  const iso = review.published_at ?? review.created_at;
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Rating aggregato calcolato SOLO dalle recensioni proprie passate.
 * Ritorna null se non ce ne sono (→ niente aggregateRating nel markup).
 */
export function computeAggregateRating(
  reviews: Pick<Review, "rating">[],
): { ratingValue: number; reviewCount: number } | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { ratingValue: sum / reviews.length, reviewCount: reviews.length };
}

/** Mappa le righe DB → input recensioni del generatore JSON-LD, per una lingua. */
export function toVacationRentalReviews(
  reviews: Review[],
  locale: LocaleCode,
): VacationRentalReview[] {
  return reviews.map((r) => ({
    author: r.author_name,
    datePublished: reviewDatePublished(r),
    ratingValue: r.rating,
    body: pickReviewText(r, locale),
  }));
}
