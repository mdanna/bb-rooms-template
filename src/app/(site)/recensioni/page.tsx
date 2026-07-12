import {
  getPublishedReviews,
  computeAggregateRating,
  reviewDatePublished,
  toVacationRentalReviews,
} from "@/lib/reviews";
import { buildReviewMarkup, serializeJsonLd, vacationRentalId } from "@/lib/vacationRentalJsonLd";
import { CONTENT } from "@/lib/siteContent";
import RecensioniClient, { type PublicReview } from "./RecensioniClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com").replace(/\/+$/, "");

// Le recensioni vengono dal DB (fonte propria, moderate): render dinamico così le
// nuove recensioni approvate compaiono subito. La lettura è comunque in cache
// (unstable_cache), invalidata dalla moderazione.
export const dynamic = "force-dynamic";

export default async function RecensioniPage() {
  const published = await getPublishedReviews();

  const reviews: PublicReview[] = published.map((r) => ({
    id: r.id,
    author: r.author_name,
    rating: r.rating,
    translations: r.translations,
    body: r.body,
    bodyLocale: r.locale,
    verified: r.verified,
    stayMonth: r.stay_month,
    datePublished: reviewDatePublished(r),
  }));

  const agg = computeAggregateRating(published);
  const aggregate = agg ? { rating: agg.ratingValue.toFixed(2), count: agg.reviewCount } : null;

  // Markup recensioni: iniettato SOLO qui, dove le recensioni sono visibili
  // (stessa entità VacationRental via @id). Null se non ci sono recensioni.
  const markup = buildReviewMarkup({
    id: vacationRentalId(SITE_URL),
    url: SITE_URL,
    name: CONTENT.siteTitle.it,
    reviews: toVacationRentalReviews(published, "it"),
    aggregateRating: agg ?? undefined,
  });

  return (
    <>
      {markup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(markup) }}
        />
      )}
      <RecensioniClient reviews={reviews} aggregate={aggregate} />
    </>
  );
}
