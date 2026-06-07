/**
 * Shared image cache for resolving data-image-query attributes.
 * Used by HtmlSlideRenderer (client) and deckExport (PDF baking).
 *
 * Resolution goes through `/api/deck-image`: gpt-image-1 generation (primary,
 * persisted to Blob + cached) with Unsplash as the backup. Returns null when no
 * source produces an image — callers keep the deterministic gradient, so a slide
 * never shows an empty image box.
 */

const cache = new Map<string, string>();

export interface ResolveImageOptions {
  /** Cutout: request a transparent-background PNG (floating subject). */
  transparent?: boolean;
}

/** Cache key — transparency changes the asset, so it keys separately. */
function keyFor(query: string, opts: ResolveImageOptions): string {
  return (opts.transparent ? "t:" : "") + query.trim();
}

export async function resolveImageQuery(
  query: string,
  opts: ResolveImageOptions = {},
): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cacheKey = keyFor(trimmed, opts);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const t = opts.transparent ? "&t=1" : "";
    const res = await fetch(`/api/deck-image?q=${encodeURIComponent(trimmed)}&kind=auto${t}`);
    if (!res.ok) return null;
    const data = await res.json();
    const url: string | undefined = data?.url;
    if (!url) return null;

    cache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

export function getCachedImageUrl(query: string, opts: ResolveImageOptions = {}): string | undefined {
  return cache.get(keyFor(query, opts));
}

/**
 * Fire-and-forget warm of the image cache for a query — used to pre-generate
 * images IN PARALLEL while the deck text is still streaming, so they're ready
 * (cache hit) by the time slides render. Safe to call repeatedly (deduped).
 */
export function prefetchImageQuery(query: string, opts: ResolveImageOptions = {}): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  if (cache.has(keyFor(trimmed, opts))) return;
  void resolveImageQuery(trimmed, opts);
}
