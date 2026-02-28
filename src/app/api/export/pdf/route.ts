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

    let chromium: typeof import("@sparticuz/chromium").default;
    let puppeteer: typeof import("puppeteer-core");
    try {
      chromium = (await import("@sparticuz/chromium")).default;
      puppeteer = await import("puppeteer-core");
    } catch {
      return NextResponse.json({ error: "PDF generation dependencies not available" }, { status: 500 });
    }

    const executablePath = await chromium.executablePath();
    if (!executablePath) {
      return NextResponse.json({ error: "Chromium binary not available" }, { status: 500 });
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();

      const cssBlock = body.css ? `<style>${body.css}</style>` : "";
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${cssBlock}</head><body>${body.html}</body></html>`;
      await page.setContent(fullHtml, { waitUntil: "networkidle0", timeout: 15000 });

      const opts = body.options || {};
      const pdfBuffer = await page.pdf({
        format: (opts.format as any) || "A4",
        landscape: opts.landscape ?? false,
        margin: opts.margin || { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
        printBackground: true,
      });

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
