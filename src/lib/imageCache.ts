/**
 * Shared image cache for resolving data-image-query attributes.
 * Used by HtmlSlideRenderer (client) and deckExport (PDF baking).
 */

const cache = new Map<string, string>();

export async function resolveImageQuery(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cached = cache.get(trimmed);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/unsplash?q=${encodeURIComponent(trimmed)}&page=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results;
    if (!results || results.length === 0) return null;

    const url: string = results[0].urls?.regular || results[0].urls?.small;
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
