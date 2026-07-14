import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { pool, ensureReviewSchema, type Review } from "@/lib/db";
import { REVIEWS_CACHE_TAG } from "@/lib/reviews";
import { localeOrder } from "@/i18n/index";
import { DEMO_MODE, demoWriteBlocked } from "@/lib/demo";
import { getEffectiveAnthropicKey } from "@/lib/siteSecrets";
import { translateReviewBody } from "@/lib/translate";

const STATUSES = ["pending", "published", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  if (DEMO_MODE) return NextResponse.json({ reviews: [] });

  await ensureReviewSchema();
  const { rows } = await pool.query<Review>(`SELECT * FROM reviews ORDER BY created_at DESC`);
  return NextResponse.json({ reviews: rows });
}

interface PatchBody {
  id: number;
  status?: Status;
  /** Traduzioni { it,en,... } da salvare manualmente (override, opzionale). */
  translations?: Record<string, string>;
  /** Rigenera le traduzioni automaticamente (autodetect lingua + traduci il body). */
  retranslate?: boolean;
}

function validTranslations(t: unknown): t is Record<string, string> {
  if (!t || typeof t !== "object") return false;
  return Object.entries(t).every(
    ([k, v]) => (localeOrder as readonly string[]).includes(k) && typeof v === "string",
  );
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const b = (await request.json().catch(() => null)) as PatchBody | null;
  if (!b || typeof b.id !== "number") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
  if (b.status && !STATUSES.includes(b.status)) {
    return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
  }
  if (b.translations !== undefined && !validTranslations(b.translations)) {
    return NextResponse.json({ error: "Traduzioni non valide" }, { status: 400 });
  }

  if (DEMO_MODE) return demoWriteBlocked();

  await ensureReviewSchema();

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (b.status) {
    sets.push(`status = $${i++}`);
    values.push(b.status);
    // Alla pubblicazione fissa published_at (→ datePublished nel markup), se non già impostato.
    if (b.status === "published") sets.push(`published_at = COALESCE(published_at, now())`);
  }

  // Traduzioni: manuale (override) OPPURE automatica. La generazione automatica scatta
  // alla pubblicazione (se non già tradotta) o su richiesta esplicita (retranslate).
  let translateWarning: string | undefined;
  if (b.translations !== undefined) {
    sets.push(`translations = $${i++}`);
    values.push(JSON.stringify(b.translations));
  } else if (b.retranslate === true || b.status === "published") {
    const { rows: cur } = await pool.query<{ body: string; translations: Record<string, string> | null }>(
      `SELECT body, translations FROM reviews WHERE id = $1`,
      [b.id],
    );
    const review = cur[0];
    if (review) {
      const alreadyTranslated = !!review.translations && Object.keys(review.translations).length > 0;
      if (b.retranslate === true || !alreadyTranslated) {
        const apiKey = await getEffectiveAnthropicKey();
        if (apiKey) {
          try {
            const { sourceLang, translations } = await translateReviewBody(review.body, apiKey);
            sets.push(`locale = $${i++}`);
            values.push(sourceLang);
            sets.push(`translations = $${i++}`);
            values.push(JSON.stringify(translations));
          } catch (e) {
            // Non blocca la pubblicazione: la recensione resta nel testo originale.
            translateWarning = e instanceof Error ? e.message : "Traduzione automatica non riuscita";
          }
        } else {
          translateWarning = "Chiave Anthropic non configurata: recensione senza traduzioni (solo originale).";
        }
      }
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nessuna modifica" }, { status: 400 });
  }
  values.push(b.id);
  const { rows } = await pool.query<Review>(
    `UPDATE reviews SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values,
  );
  if (rows.length === 0) return NextResponse.json({ error: "Non trovata" }, { status: 404 });

  revalidateTag(REVIEWS_CACHE_TAG, "max");
  return NextResponse.json({ review: rows[0], ...(translateWarning ? { warning: translateWarning } : {}) });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const b = (await request.json().catch(() => null)) as { id?: number } | null;
  if (!b || typeof b.id !== "number") {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  if (DEMO_MODE) return demoWriteBlocked();

  await ensureReviewSchema();
  await pool.query(`DELETE FROM reviews WHERE id = $1`, [b.id]);
  revalidateTag(REVIEWS_CACHE_TAG, "max");
  return NextResponse.json({ ok: true });
}
