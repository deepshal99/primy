/**
 * Server-side slide → PNG rendering.
 *
 * Pipeline (per slide):
 *
 *   slide.html ──► buildSlideDocument() ──► page.setContent()
 *              ──► wait for fonts.ready (+ grace) ──► screenshot(960×540)
 *              ──► PNG Buffer
 *
 * Slides render concurrently on separate tabs of ONE browser, bounded by
 * RENDER_CONCURRENCY to cap memory. A per-slide timeout means one slow/broken
 * slide can't stall the batch — it resolves to `null` and the caller falls
 * back to the original (never blocks the whole deck).
 *
 * This exists to feed the vision critique loop a faithful picture of each
 * slide. It reuses the same Chromium boot + SSRF guard as PDF export, but
 * with a tight font/image-CDN allowlist so fonts and photos actually render.
 */
import type { Browser } from "puppeteer-core";
import { launchBrowser, newGuardedPage, FONT_IMAGE_HOSTS } from "./chromium";

export const SLIDE_W = 960;
export const SLIDE_H = 540;

/** Max slides rendered in parallel on one browser. Balances speed vs memory. */
export const RENDER_CONCURRENCY = 4;

/** Per-slide hard ceiling (content load + font wait + screenshot). */
const PER_SLIDE_TIMEOUT_MS = 12_000;

export interface SlideInput {
  id: string;
  html: string;
}

export interface RenderedSlide {
  id: string;
  /** Base64 PNG (no data: prefix), or null if rendering failed/timed out. */
  png: string | null;
  error?: string;
}

/**
 * Wrap a single slide's inner HTML into a self-contained 960×540 document.
 * The reset keeps the body flush to the canvas so the screenshot clip lines
 * up with the slide bounds. Exported for unit testing.
 */
export function buildSlideDocument(slideHtml: string): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<style>*{margin:0;padding:0;box-sizing:border-box}` +
    `html,body{width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:#fff}</style>` +
    `</head><body>${slideHtml}</body></html>`
  );
}

/** Race a promise against a timeout, rejecting with a labelled error. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Render one slide on a fresh guarded tab. Returns base64 PNG or throws. */
async function renderOne(browser: Browser, slide: SlideInput): Promise<string> {
  const page = await newGuardedPage(browser, { allowHosts: FONT_IMAGE_HOSTS });
  try {
    // Defense-in-depth: slides are pure HTML/CSS — disabling JS guarantees no
    // <script> in the (own-model) HTML can execute in the headless browser.
    // Fonts/images still load: they're fetched by CSS, not page script.
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 2 });
    await page.setContent(buildSlideDocument(slide.html), {
      // networkidle0 waits for font/image fetches (or their fast aborts) to
      // settle so the critique sees real faces, not fallbacks.
      waitUntil: "networkidle0",
      timeout: PER_SLIDE_TIMEOUT_MS,
    });
    await new Promise((r) => setTimeout(r, 300)); // final paint grace

    const buf = (await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H },
    })) as Buffer;
    return Buffer.from(buf).toString("base64");
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Render many slides to PNGs. Never rejects for an individual slide — a failed
 * slide comes back with `png: null` and an `error` string so the caller can
 * keep the original. Throws only if the browser itself can't launch.
 */
export async function renderSlides(slides: SlideInput[]): Promise<RenderedSlide[]> {
  if (slides.length === 0) return [];
  return withRenderBrowser((render) => render(slides));
}

/** A reusable batch-render function bound to one warm browser. */
export type RenderFn = (slides: SlideInput[]) => Promise<RenderedSlide[]>;

/**
 * Launch ONE browser, hand the caller a `render` function bound to it, then
 * close it. Use this when you render in multiple passes (e.g. the refine loop:
 * initial batch + per-slide repair re-renders) so you pay the Chromium
 * cold-start ONCE instead of per call.
 */
export async function withRenderBrowser<T>(fn: (render: RenderFn) => Promise<T>): Promise<T> {
  const browser = await launchBrowser({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 2 });

  const render: RenderFn = async (slides) => {
    if (slides.length === 0) return [];
    const results: RenderedSlide[] = new Array(slides.length);
    let cursor = 0;

    async function worker() {
      while (cursor < slides.length) {
        const index = cursor++;
        const slide = slides[index];
        try {
          const png = await withTimeout(
            renderOne(browser, slide),
            PER_SLIDE_TIMEOUT_MS,
            `render slide ${slide.id}`
          );
          results[index] = { id: slide.id, png };
        } catch (err) {
          results[index] = {
            id: slide.id,
            png: null,
            error: err instanceof Error ? err.message : "render failed",
          };
        }
      }
    }

    const pool = Math.min(RENDER_CONCURRENCY, slides.length);
    await Promise.all(Array.from({ length: pool }, () => worker()));
    return results;
  };

  try {
    return await fn(render);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
