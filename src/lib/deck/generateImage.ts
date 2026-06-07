/**
 * OpenAI GPT-image generation for deck visuals.
 *
 * Primary source for deck imagery (Unsplash is the backup, see imageStore.ts).
 * Returns a JPEG buffer ready to persist to Blob. Fail-soft: any error returns
 * null so the caller falls back to stock, then to the deterministic gradient —
 * a deck slide is never left with an empty image box.
 */

/** OpenAI image model. gpt-image-1 is the GA GPT-image model (verified against the project key). */
const IMAGE_MODEL = "gpt-image-1";

export interface GeneratedImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Wrap a short visual idea in an art-direction prompt so generations look like
 * premium presentation backgrounds (text gets overlaid on top), never clip-art
 * or anything with baked-in words.
 */
export function buildImagePrompt(query: string): string {
  return (
    `${query.trim()}. ` +
    `Premium editorial presentation visual, cinematic soft lighting, clean and ` +
    `atmospheric composition with calm negative space, refined muted palette, ` +
    `shallow depth of field. Designed to sit behind overlaid white text. ` +
    `Absolutely no text, no words, no letters, no logos, no watermark, no UI, no charts.`
  );
}

/**
 * Generate one landscape image via gpt-image-1. `quality: "medium"` + JPEG keeps
 * latency, cost, and file size reasonable for a slide background behind a scrim.
 */
export async function generateDeckImage(query: string): Promise<GeneratedImage | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: buildImagePrompt(query),
        size: "1536x1024", // landscape; slides cover-crop to 16:9
        quality: "medium",
        output_format: "jpeg",
        n: 1,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.error("[deck-image] generation failed:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (typeof b64 !== "string" || !b64) return null;
    return { buffer: Buffer.from(b64, "base64"), contentType: "image/jpeg" };
  } catch (err) {
    console.error("[deck-image] generation error:", err instanceof Error ? err.message : err);
    return null;
  }
}
