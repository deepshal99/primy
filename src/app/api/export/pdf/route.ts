import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { launchBrowser, newGuardedPage } from "@/lib/deck/chromium";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { html: string; css?: string; options?: { format?: string; landscape?: boolean; margin?: { top?: string; right?: string; bottom?: string; left?: string } } };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.html || typeof body.html !== "string") {
      return NextResponse.json({ error: "Missing html field" }, { status: 400 });
    }

    let browser: Awaited<ReturnType<typeof launchBrowser>>;
    try {
      // Export bakes images to data: URIs beforehand, so it needs NO external
      // network — the guarded page below uses the default empty allowlist.
      browser = await launchBrowser({ width: 1920, height: 1080 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chromium binary not available";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
      const page = await newGuardedPage(browser);

      // Cap HTML size to prevent memory abuse (2MB is generous for any slide deck)
      const MAX_HTML_SIZE = 2 * 1024 * 1024;
      if (body.html.length > MAX_HTML_SIZE || (body.css && body.css.length > MAX_HTML_SIZE)) {
        return NextResponse.json({ error: "HTML content too large" }, { status: 400 });
      }

      const cssBlock = body.css ? `<style>${body.css}</style>` : "";
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${cssBlock}</head><body>${body.html}</body></html>`;
      await page.setContent(fullHtml, { waitUntil: "domcontentloaded", timeout: 15000 });

      const opts = body.options || {};
      // Support custom dimensions (e.g. "960px 540px") via width/height,
      // or standard named formats (e.g. "A4", "Letter") via format.
      const formatStr = opts.format || "A4";
      const customSize = formatStr.match(/^(\d+(?:px)?)\s+(\d+(?:px)?)$/);
      const pdfOpts: Parameters<typeof page.pdf>[0] = {
        landscape: opts.landscape ?? false,
        margin: opts.margin || { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
        printBackground: true,
      };
      if (customSize) {
        pdfOpts.width = customSize[1];
        pdfOpts.height = customSize[2];
      } else {
        pdfOpts.format = formatStr as any;
      }
      const pdfBuffer = await page.pdf(pdfOpts);

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=export.pdf",
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
