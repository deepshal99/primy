import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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

    let puppeteer: typeof import("puppeteer-core");
    try {
      puppeteer = await import("puppeteer-core");
    } catch {
      return NextResponse.json({ error: "PDF generation dependencies not available" }, { status: 500 });
    }

    // In production (serverless), use @sparticuz/chromium for the bundled binary.
    // In development, use the local Chrome installation.
    let executablePath: string;
    let launchArgs: string[] = [];
    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      // Try common local Chrome paths
      const { existsSync } = await import("fs");
      const localPaths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ];
      const found = localPaths.find((p) => existsSync(p));
      if (!found) {
        return NextResponse.json({ error: "No local Chrome found. Install Google Chrome for PDF export in dev." }, { status: 500 });
      }
      executablePath = found;
      launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
    } else {
      try {
        const chromium = (await import("@sparticuz/chromium")).default;
        executablePath = await chromium.executablePath();
        launchArgs = chromium.args;
      } catch {
        return NextResponse.json({ error: "Chromium binary not available" }, { status: 500 });
      }
      if (!executablePath) {
        return NextResponse.json({ error: "Chromium binary not available" }, { status: 500 });
      }
    }

    const browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();

      // Block all outbound network requests to prevent SSRF via injected HTML.
      // Only allow data: URIs and blob: URIs for inline images.
      await page.setRequestInterception(true);
      page.on("request", (interceptedRequest) => {
        const url = interceptedRequest.url();
        if (url.startsWith("data:") || url.startsWith("blob:")) {
          interceptedRequest.continue();
        } else {
          interceptedRequest.abort("blockedbyclient");
        }
      });

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
