/**
 * Deck image resolution + persistence.
 *
 *   getOrCreateDeckImage(query, kind)
 *     ├─ Blob cache hit?  ──────────────► return stored URL (no re-gen)
 *     ├─ kind != "stock": gpt-image-1 ──► persist to Blob ──► return URL
 *     └─ backup: Unsplash (CDN-hosted) ─► return URL
 *        └─ all fail ──────────────────► null (caller keeps the gradient)
 *
 * Generated images are persisted to Vercel Blob so the URL is stable across
 * reloads and survives PDF/PPTX export; the deterministic blob path doubles as
 * the cache key (same prompt → same object, generated once). Unsplash results
 * are already CDN-hosted, so they're returned as-is (no re-hosting).
 */
import { put, list } from "@vercel/blob";
import { generateDeckImage } from "./generateImage";

export type ImageKind = "auto" | "gen" | "stock";

/** Stable FNV-1a hex hash for the cache key. */
function hashKey(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** First landscape Unsplash result URL (backup source). */
async function unsplashFirst(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export interface ResolveOptions {
  /** Cutout: transparent-background PNG (no Unsplash backup — stock has no alpha). */
  transparent?: boolean;
}

/**
 * Resolve a deck image query to a stable URL, generating + caching as needed.
 * Returns null only when every source fails (caller renders the gradient).
 */
export async function getOrCreateDeckImage(
  query: string,
  kind: ImageKind = "auto",
  opts: ResolveOptions = {},
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const transparent = opts.transparent === true;

  // Generation path (primary, unless explicitly stock-only).
  if (kind !== "stock") {
    const ext = transparent ? "png" : "jpg";
    const tag = transparent ? "cut" : "gen";
    const pathname = `deck-img/${tag}-${hashKey(q)}.${ext}`;
    try {
      const existing = await list({ prefix: pathname, limit: 1 });
      if (existing.blobs[0]?.url) return existing.blobs[0].url;
    } catch {
      /* listing failed — fall through to generate */
    }
    const img = await generateDeckImage(q, { transparent });
    if (img) {
      try {
        const blob = await put(pathname, img.buffer, {
          access: "public",
          contentType: img.contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        return blob.url;
      } catch (err) {
        console.error("[deck-image] blob put failed:", err instanceof Error ? err.message : err);
        // fall through to stock backup
      }
    }
    if (kind === "gen") return null; // gen-only requested; don't fall to stock
  }

  // Cutouts have no stock equivalent (Unsplash has no alpha) — don't back off to it.
  if (transparent) return null;

  // Backup: stock photography (already CDN-hosted, allowlisted for export).
  return unsplashFirst(q);
}
