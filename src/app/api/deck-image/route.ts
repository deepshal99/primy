/**
 * GET /api/deck-image?q=<idea>&kind=auto|gen|stock
 *
 * Resolves a deck image query to a stable URL — gpt-image-1 generation (primary,
 * persisted to Vercel Blob + cached) with Unsplash as the backup. Returns
 * `{ url }` or 404 when every source fails (the client keeps the gradient).
 *
 * Generation is expensive + slow, so this is auth-gated and rate-limited; the
 * Blob cache means a given prompt is only generated once.
 */
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrCreateDeckImage, type ImageKind } from "@/lib/deck/imageStore";

export const maxDuration = 120;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Image generation is pricey — throttle harder than normal reads.
  const rl = checkRateLimit(`${session.user.id}:deck-image`, 20, 60_000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many image requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 400);
  const kindRaw = url.searchParams.get("kind") ?? "auto";
  const kind: ImageKind = kindRaw === "gen" || kindRaw === "stock" ? kindRaw : "auto";

  if (!q.trim()) {
    return Response.json({ error: "Missing q" }, { status: 400 });
  }

  const resolved = await getOrCreateDeckImage(q, kind);
  if (!resolved) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }
  // Cache the resolved mapping at the edge — the underlying asset is immutable.
  return Response.json({ url: resolved }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
