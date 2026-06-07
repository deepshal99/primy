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

export async function resolveImageQuery(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cached = cache.get(trimmed);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/deck-image?q=${encodeURIComponent(trimmed)}&kind=auto`);
    if (!res.ok) return null;
    const data = await res.json();
    const url: string | undefined = data?.url;
    if (!url) return null;

    cache.set(trimmed, url);
    return url;
  } catch {
    return null;
  }
}

export function getCachedImageUrl(query: string): string | undefined {
  return cache.get(query.trim());
}
