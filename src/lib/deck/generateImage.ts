/**
 * OpenAI GPT-image generation for deck visuals.
 *
 * Primary source for deck imagery (Unsplash is the backup, see imageStore.ts).
 * Returns a JPEG buffer ready to persist to Blob. Fail-soft: any error returns
 * null so the caller falls back to stock, then to the deterministic gradient —
 * a deck slide is never left with an empty image box.
 */

/**
 * OpenAI image models (verified against the project key):
 *  - backgrounds → gpt-image-2 (latest, best scenes)
 *  - cutouts → gpt-image-1 (gpt-image-2 rejects the `background:transparent` param)
 */
const BG_MODEL = "gpt-image-2";
const CUTOUT_MODEL = "gpt-image-1";

export interface GeneratedImage {
  buffer: Buffer;
  contentType: string;
}

export interface GenerateOptions {
  /** Cutout mode: isolated subject on a transparent background (PNG). */
  transparent?: boolean;
}

/**
 * Wrap a short visual idea in an art-direction prompt. Two modes:
 *  - background (default): a premium editorial scene to sit behind white text.
 *  - transparent (cutout): a single isolated subject, no background/shadow, for
 *    floating product/object shots on a branded panel.
 * Both forbid baked-in text/logos/watermarks.
 */
export function buildImagePrompt(query: string, opts: GenerateOptions = {}): string {
  const q = query.trim();
  const noText =
    "Absolutely no text, no words, no letters, no logos, no watermark, no UI, no charts.";
  if (opts.transparent) {
    return (
      `${q}. A single isolated subject on a fully transparent background, ` +
      `studio product photography, crisp clean edges, centered, no ground shadow, ` +
      `no backdrop, nothing else in frame. ${noText}`
    );
  }
  return (
    `${q}. Premium editorial presentation visual, cinematic soft lighting, clean and ` +
    `atmospheric composition with calm negative space, refined muted palette, ` +
    `shallow depth of field. Designed to sit behind overlaid white text. ${noText}`
  );
}

/**
 * Generate one image via gpt-image-2. Backgrounds use landscape JPEG (small,
 * fast, behind a scrim); cutouts use a square transparent PNG (alpha preserved).
 */
export async function generateDeckImage(
  query: string,
  opts: GenerateOptions = {},
): Promise<GeneratedImage | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const transparent = opts.transparent === true;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: transparent ? CUTOUT_MODEL : BG_MODEL,
        prompt: buildImagePrompt(query, opts),
        size: transparent ? "1024x1024" : "1536x1024",
        quality: "medium",
        ...(transparent
          ? { background: "transparent", output_format: "png" }
          : { output_format: "jpeg" }),
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
    return {
      buffer: Buffer.from(b64, "base64"),
      contentType: transparent ? "image/png" : "image/jpeg",
    };
  } catch (err) {
    console.error("[deck-image] generation error:", err instanceof Error ? err.message : err);
    return null;
  }
}
