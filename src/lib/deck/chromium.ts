/**
 * Shared headless-Chromium boot for server-side slide work.
 *
 * Used by BOTH the PDF export route (`/api/export/pdf`) and the slide render
 * service (`renderSlide.ts`). Extracted so the launch logic + SSRF guard live
 * in exactly one place.
 *
 *   dev  → local Google Chrome / Chromium binary
 *   prod → @sparticuz/chromium bundled binary (serverless)
 *
 * Network policy (SSRF guard):
 *
 *   request ──► data:/blob: ───────────────► ALLOW (inline assets)
 *           │
 *           └─► http(s) host in allowHosts ─► ALLOW (fonts / image CDNs)
 *           │
 *           └─► anything else ──────────────► ABORT (blockedbyclient)
 *
 * Callers that render UNTRUSTED HTML and need nothing external (PDF export,
 * where images are already baked to data: URIs) pass an empty allowlist.
 * The render service passes a tight font/image-CDN allowlist so the vision
 * critique sees real fonts and photos, not fallbacks.
 */
import type { Browser, Page } from "puppeteer-core";

/** Font + stock-image hosts safe to fetch when rendering our own AI HTML. */
export const FONT_IMAGE_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "images.unsplash.com",
  "plus.unsplash.com",
  "images.pexels.com",
];

/**
 * Does `url` target one of the allowlisted hosts? Exact host or subdomain
 * match only — never a substring match (so "evil-unsplash.com" is rejected).
 * Exported for unit testing.
 */
export function isHostAllowed(url: string, allowHosts: string[]): boolean {
  if (!allowHosts.length) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowHosts.some(
    (a) => hostname === a.toLowerCase() || hostname.endsWith("." + a.toLowerCase())
  );
}

/** Resolve the Chrome/Chromium executable + launch args for the current env. */
async function resolveExecutable(): Promise<{ executablePath: string; args: string[] }> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const { existsSync } = await import("fs");
    const localPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];
    const found = localPaths.find((p) => existsSync(p));
    if (!found) {
      throw new Error("No local Chrome found. Install Google Chrome for slide rendering in dev.");
    }
    return { executablePath: found, args: ["--no-sandbox", "--disable-setuid-sandbox"] };
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  const executablePath = await chromium.executablePath();
  if (!executablePath) {
    throw new Error("Chromium binary not available");
  }
  return { executablePath, args: chromium.args };
}

/**
 * Launch a headless browser. The caller MUST close it in a `finally` block.
 * Throws a descriptive Error when the binary can't be resolved.
 */
export async function launchBrowser(
  viewport: { width: number; height: number; deviceScaleFactor?: number } = {
    width: 1920,
    height: 1080,
  }
): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const { executablePath, args } = await resolveExecutable();
  return puppeteer.launch({
    args,
    defaultViewport: viewport,
    executablePath,
    headless: true,
  });
}

/**
 * Create a request-intercepted page. Blocks every outbound request except
 * `data:`/`blob:` and the optional `allowHosts` allowlist. This is the SSRF
 * boundary for rendering untrusted HTML — keep it strict.
 */
export async function newGuardedPage(
  browser: Browser,
  opts?: { allowHosts?: string[] }
): Promise<Page> {
  const allowHosts = opts?.allowHosts ?? [];
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("data:") || url.startsWith("blob:") || isHostAllowed(url, allowHosts)) {
      req.continue();
    } else {
      req.abort("blockedbyclient");
    }
  });
  return page;
}
