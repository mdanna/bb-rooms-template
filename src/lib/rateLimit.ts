// Rate limiting in-memory, per istanza della funzione serverless. Non è distribuito (ogni
// cold start riparte da zero, e con più istanze concorrenti il limite reale è più alto), ma
// è sufficiente a scoraggiare spam/abuso automatizzato su un sito di queste dimensioni senza
// introdurre una dipendenza esterna (Redis/KV) solo per questo.

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  const key = `${scope}:${getClientKey(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}
