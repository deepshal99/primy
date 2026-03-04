import { DeckSlide, HtmlDeckSlide, ThemeConfig, isHtmlSlide } from "@/lib/types";
import { getThemeConfig } from "./deckThemes";
import { enforceSlideContrast } from "./sanitizeSlideHtml";
import { resolveImageQuery } from "@/lib/imageCache";

/**
 * Build a Google Fonts <link> tag for the given theme fonts.
 */
function fontLinkTag(t: ThemeConfig): string {
  const fonts = t.googleFonts;
  if (!fonts.length) return "";
  const params = fonts
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800;900`)
    .join("&");
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${params}&display=swap">`;
}

/**
 * Generate the decorative background HTML for a slide, mirroring DecorLayer from SlideRenderer.
 */
function decorHtml(t: ThemeConfig): string {
  switch (t.decorStyle) {
    case "geometric":
      return `
        <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border:1.5px solid ${t.accentLight};border-radius:12px;transform:rotate(45deg);opacity:0.8"></div>
        <div style="position:absolute;bottom:50px;left:-15px;width:44px;height:44px;background:${t.accentLight};border-radius:6px;transform:rotate(15deg);opacity:0.6"></div>`;
    case "minimal":
      return `
        <div style="position:absolute;top:64px;left:0;width:3px;height:64px;background:${t.accent};border-radius:0 2px 2px 0;opacity:0.7"></div>`;
    case "gradient":
      return `
        <div style="position:absolute;top:-180px;right:-120px;width:500px;height:500px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 60%);border-radius:50%;opacity:0.8"></div>
        <div style="position:absolute;bottom:-160px;left:-100px;width:400px;height:400px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 60%);border-radius:50%;opacity:0.5"></div>`;
    default:
      return "";
  }
}

/** Escape HTML entities */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Render a single slide's inner content as HTML matching SlideRenderer layouts.
 */
function slideContentHtml(slide: DeckSlide, t: ThemeConfig): string {
  const isCentered = slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" || slide.layout === "statement";
  const padding = "64px 80px";
  const justify = isCentered ? "center" : "flex-start";
  const headingCss = `font-weight:${t.headingWeight};font-family:${t.headingFont};letter-spacing:-0.02em;color:${t.text};${t.headingCase === "uppercase" ? "text-transform:uppercase;" : ""}`;

  switch (slide.layout) {
    case "title":
      return `<div style="text-align:center;max-width:800px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:${justify};padding:${padding};box-sizing:border-box;height:100%">
        <div style="width:48px;height:3px;border-radius:2px;background:linear-gradient(90deg,${t.accent},${t.accentAlt});margin-bottom:28px"></div>
        <div style="font-size:56px;line-height:1.1;letter-spacing:-0.03em;text-align:center;${headingCss}">${esc(slide.title || "Untitled")}</div>
        ${slide.subtitle ? `<div style="font-size:22px;color:${t.textSecondary};line-height:1.3;font-weight:500;letter-spacing:-0.01em;text-align:center;margin-top:20px;font-family:${t.bodyFont}">${esc(slide.subtitle)}</div>` : ""}
      </div>`;

    case "section":
      return `<div style="text-align:center;max-width:700px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:${justify};padding:${padding};box-sizing:border-box;height:100%">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px">
          <div style="width:40px;height:1px;background:${t.divider}"></div>
          <div style="width:10px;height:10px;border-radius:50%;border:2px solid ${t.accent}"></div>
          <div style="width:40px;height:1px;background:${t.divider}"></div>
        </div>
        <div style="font-size:44px;line-height:1.2;text-align:center;${headingCss}">${esc(slide.title || "Section")}</div>
      </div>`;

    case "statement":
      return `<div style="text-align:center;max-width:720px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${padding};box-sizing:border-box;height:100%">
        <div style="font-size:42px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;text-align:center;font-family:${t.headingFont};color:${t.text}">${esc(slide.content || "")}</div>
        ${slide.title ? `<div style="font-size:13px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:${t.textSecondary};margin-top:32px;font-family:${t.bodyFont}">${esc(slide.title)}</div>` : ""}
      </div>`;

    case "bullets": {
      const bullets = slide.bullets || [];
      const bulletItems = bullets.map((b, i) => {
        let icon = "";
        switch (t.bulletStyle) {
          case "number":
            icon = `<span style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${t.accentLight};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${t.accent};font-family:${t.bodyFont};margin-top:2px">${i + 1}</span>`;
            break;
          case "dash":
            icon = `<span style="flex-shrink:0;font-size:20px;font-weight:700;color:${t.accent};line-height:1;margin-top:4px">&mdash;</span>`;
            break;
          case "arrow":
            icon = `<span style="flex-shrink:0;font-size:22px;font-weight:700;color:${t.accent};margin-top:1px">&rsaquo;</span>`;
            break;
          case "check":
            icon = `<span style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:${t.accent};display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;font-weight:700;margin-top:3px">&#10003;</span>`;
            break;
          case "ring":
            icon = `<span style="flex-shrink:0;width:12px;height:12px;border-radius:50%;border:2.5px solid ${t.accent};margin-top:8px"></span>`;
            break;
          case "bar":
            icon = `<span style="flex-shrink:0;width:3px;height:20px;border-radius:2px;background:${t.accent};margin-top:5px"></span>`;
            break;
          default:
            icon = `<span style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${t.accent};margin-top:10px"></span>`;
        }
        return `<div style="display:flex;align-items:flex-start;gap:14px;padding:10px 16px;border-left:3px solid ${t.accent};border-radius:2px">
          ${icon}
          <span style="font-size:18px;line-height:1.6;flex:1;font-family:${t.bodyFont}">${esc(b)}</span>
        </div>`;
      }).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:32px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:flex;flex-direction:column;gap:14px;overflow:hidden;flex:1">${bulletItems}</div>
      </div>`;
    }

    case "metrics": {
      const stats = slide.stats || [];
      const metricItems = stats.map((s, i) => {
        const divider = i < stats.length - 1 ? `<div style="width:1px;height:64px;background:${t.divider};flex-shrink:0"></div>` : "";
        return `<div style="display:flex;align-items:center">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 48px;text-align:center">
            <div style="font-size:64px;font-weight:700;font-family:${t.headingFont};color:${t.accent};letter-spacing:-0.03em;line-height:1">${esc(s.value)}</div>
            <div style="font-size:13px;font-weight:500;font-family:${t.bodyFont};color:${t.textSecondary};letter-spacing:0.05em;text-transform:uppercase;margin-top:12px">${esc(s.label)}</div>
          </div>
          ${divider}
        </div>`;
      }).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:40px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:flex;flex:1;align-items:center;justify-content:center">${metricItems}</div>
      </div>`;
    }

    case "stats": {
      const stats = slide.stats || [];
      const statCards = stats.map((s) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 20px;border-radius:14px;background:${t.cardBg};border:1px solid ${t.cardBorder};text-align:center;gap:8px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>
          <div style="font-size:52px;font-weight:${t.headingWeight};font-family:${t.headingFont};color:${t.accent};letter-spacing:-0.03em;line-height:1.1">${esc(s.value)}</div>
          <div style="font-size:14px;font-weight:600;font-family:${t.bodyFont};color:${t.textSecondary};letter-spacing:0.05em;text-transform:uppercase">${esc(s.label)}</div>
        </div>`).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:36px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:flex;gap:20px;flex:1;align-items:stretch">${statCards}</div>
      </div>`;
    }

    case "featureGrid": {
      const bullets = slide.bullets || [];
      const features = bullets.map((b) => {
        const match = b.match(/^\*\*(.+?)\*\*\s*(.*)/);
        if (match) return { title: match[1], desc: match[2] };
        return { title: b, desc: "" };
      });
      const cols = features.length <= 4 ? 2 : 3;
      const featureCards = features.map((f) => `
        <div style="padding:20px 22px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
          <div style="font-size:15px;font-weight:600;color:${t.text};font-family:${t.bodyFont};margin-bottom:6px">${esc(f.title)}</div>
          ${f.desc ? `<div style="font-size:14px;line-height:1.5;color:${t.textSecondary};font-family:${t.bodyFont}">${esc(f.desc)}</div>` : ""}
        </div>`).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:32px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;flex:1;align-content:start">${featureCards}</div>
      </div>`;
    }

    case "logoGrid": {
      const bullets = slide.bullets || [];
      const cols = bullets.length <= 4 ? bullets.length : bullets.length <= 6 ? 3 : 4;
      const logoCards = bullets.map((name) => `
        <div style="display:flex;align-items:center;justify-content:center;padding:24px 20px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
          <span style="font-size:16px;font-weight:600;color:${t.textSecondary};font-family:${t.bodyFont};letter-spacing:0.02em">${esc(name)}</span>
        </div>`).join("\n");

      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:40px;line-height:1.15;text-align:center;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:20px;max-width:700px;width:100%">${logoCards}</div>
      </div>`;
    }

    case "quote":
      return `<div style="text-align:center;max-width:720px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${padding};box-sizing:border-box;height:100%">
        <div style="font-size:120px;line-height:0.6;font-family:${t.headingFont};color:${t.accent};opacity:0.25;margin-bottom:12px;font-weight:${t.headingWeight}">&ldquo;</div>
        <div style="font-size:30px;font-style:italic;line-height:1.5;font-weight:400;letter-spacing:0.005em;color:${t.text};font-family:${t.headingFont};text-align:center">${esc(slide.content || "")}</div>
        ${slide.title ? `<div style="margin-top:32px;display:flex;align-items:center;justify-content:center;gap:12px">
          <div style="width:24px;height:2px;background:${t.accent};border-radius:1px"></div>
          <div style="font-size:16px;color:${t.textSecondary};font-weight:500;letter-spacing:0.03em;font-family:${t.bodyFont}">${esc(slide.title)}</div>
          <div style="width:24px;height:2px;background:${t.accent};border-radius:1px"></div>
        </div>` : ""}
      </div>`;

    case "twoColumn":
      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:12px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>
        <div style="width:48px;height:3px;border-radius:2px;margin-bottom:32px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>` : ""}
        <div style="display:flex;gap:28px;flex:1">
          <div style="flex:1;padding:20px 24px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
            <div style="font-size:17px;line-height:1.6;color:${t.textSecondary};white-space:pre-wrap;font-family:${t.bodyFont}">${esc(slide.content || "")}</div>
          </div>
          <div style="flex:1;padding:20px 24px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
            <div style="font-size:17px;line-height:1.6;color:${t.textSecondary};white-space:pre-wrap;font-family:${t.bodyFont}">${esc(slide.subtitle || "")}</div>
          </div>
        </div>
      </div>`;

    case "imageFeature":
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${padding};box-sizing:border-box;height:100%">
        <div style="font-size:64px;line-height:1.1;letter-spacing:-0.03em;text-align:center;font-weight:${t.headingWeight};font-family:${t.headingFont};color:#ffffff;text-shadow:0 2px 24px rgba(0,0,0,0.4)">${esc(slide.title || "Untitled")}</div>
        ${slide.subtitle ? `<div style="font-size:22px;color:rgba(255,255,255,0.75);line-height:1.3;font-weight:400;text-align:center;margin-top:20px;font-family:${t.bodyFont}">${esc(slide.subtitle)}</div>` : ""}
        ${slide.content ? `<div style="font-size:18px;color:rgba(255,255,255,0.65);line-height:1.6;max-width:700px;margin-top:24px;font-family:${t.bodyFont}">${esc(slide.content)}</div>` : ""}
      </div>`;

    case "titleContent":
    default:
      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:38px;margin-bottom:12px;line-height:1.15;${headingCss}">${esc(slide.title)}</div>
        <div style="width:48px;height:3px;border-radius:2px;margin-bottom:32px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>` : ""}
        ${slide.content ? `<div style="font-size:18px;line-height:1.6;color:${t.textSecondary};white-space:pre-wrap;max-width:780px;font-family:${t.bodyFont};flex:1">${esc(slide.content)}</div>` : ""}
      </div>`;
  }
}

/**
 * Render a full slide (background + decor + content) as standalone HTML.
 */
function slideToHtml(slide: DeckSlide, t: ThemeConfig): string {
  // Legacy HTML slides — render as basic fallback
  if (slide.layout === "html" && slide.html) {
    return `<div style="width:960px;height:540px;position:relative;overflow:hidden;background:#333;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px">
      <div style="font-size:32px;font-weight:700">${esc(slide.title || "Slide")}</div>
      <div style="font-size:14px;opacity:0.6">Legacy HTML slide</div>
    </div>`;
  }

  const bgStyle = slide.backgroundImage
    ? `background:url(${slide.backgroundImage}) center/cover no-repeat`
    : `background:${t.bg}`;

  const overlayHtml = slide.backgroundImage
    ? `<div style="position:absolute;inset:0;background:${slide.backgroundOverlay || 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))'}"></div>`
    : "";

  const effectiveText = slide.backgroundImage ? "#ffffff" : t.text;

  return `<div style="width:960px;height:540px;position:relative;overflow:hidden;${bgStyle};color:${effectiveText};font-family:${t.bodyFont};box-sizing:border-box">
    ${overlayHtml}
    ${!slide.backgroundImage ? decorHtml(t) : ""}
    <div style="position:relative;z-index:1;width:100%;height:100%">
      ${slideContentHtml(slide, t)}
    </div>
  </div>`;
}

/**
 * Scan HTML for data-image-query attributes, resolve them via the image cache,
 * and inline the resulting URLs as background-image styles.
 */
async function bakeImagesIntoHtml(html: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const els = doc.querySelectorAll<HTMLElement>("[data-image-query]");
  if (els.length === 0) return html;

  await Promise.allSettled(
    Array.from(els).map(async (el) => {
      const query = el.dataset.imageQuery;
      if (!query) return;
      const url = await resolveImageQuery(query);
      if (!url) return;
      el.style.backgroundImage = `url(${url})`;
      el.removeAttribute("data-image-query");
    })
  );

  return doc.body.innerHTML;
}

/**
 * Export deck as PDF via server-side Puppeteer rendering.
 * Each slide becomes a separate landscape page.
 */
export async function exportDeckToPDF(slides: (DeckSlide | HtmlDeckSlide)[], theme: string, style?: ThemeConfig | null) {
  const t = style || getThemeConfig(theme);

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 960px 540px; margin: 0; }
    body { width: 960px; margin: 0; padding: 0; }
    .slide-page { width: 960px; height: 540px; overflow: hidden; page-break-after: always; position: relative; }
    .slide-page:last-child { page-break-after: auto; }
  `;

  // Wrap each slide in a page container, baking images for HTML slides
  const wrappedSlides = (await Promise.all(
    slides.map(async (slide) => {
      if (isHtmlSlide(slide)) {
        const contrastFixed = enforceSlideContrast(slide.html);
        const scopedHtml = contrastFixed.replace(/:root\s*\{/g, `#slide-${slide.id} {`);
        const bakedHtml = await bakeImagesIntoHtml(scopedHtml);
        return `<div class="slide-page">${bakedHtml}</div>`;
      }
      return `<div class="slide-page">${slideToHtml(slide, t)}</div>`;
    })
  )).join("\n");

  const html = `${fontLinkTag(t)}${wrappedSlides}`;

  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      css,
      options: { format: "960px 540px", landscape: false, margin: { top: "0", right: "0", bottom: "0", left: "0" } },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "PDF generation failed" }));
    throw new Error(err.error || "PDF generation failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "presentation.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* PPTX export — uses pptxgenjs                                                  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function exportDeckToPPTX(slides: (DeckSlide | HtmlDeckSlide)[], theme: string, style?: ThemeConfig | null) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const t = style || getThemeConfig(theme);
  const pptx = new PptxGenJS();

  const bgColor = resolveColor(t.bg).replace("#", "");
  const textColor = resolveColor(t.text, t.bg).replace("#", "");
  const subtitleColorHex = resolveColor(t.textSecondary, t.bg).replace("#", "");
  const accentColorHex = t.accent.replace("#", "");

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();

    // New HTML slides: fallback text (PPTX cannot render raw HTML)
    if (isHtmlSlide(slide)) {
      pptSlide.background = { color: bgColor };
      pptSlide.addText("HTML Slide (view in browser for full fidelity)", {
        x: 0, y: 2, w: 10, h: 1.5,
        fontSize: 18, color: textColor, align: "center",
      });
      continue;
    }

    // Legacy HTML slides: fallback text
    if (slide.layout === "html") {
      pptSlide.background = { color: "888888" };
      pptSlide.addText(slide.title || "Legacy Slide", {
        x: 0, y: 2, w: 10, h: 1.5,
        fontSize: 24, color: "FFFFFF", align: "center",
      });
      continue;
    }

    // Background image support
    if (slide.backgroundImage) {
      try {
        pptSlide.background = { path: slide.backgroundImage };
      } catch {
        pptSlide.background = { color: "111111" };
      }
      // Add overlay
      pptSlide.addShape("rect" as any, {
        x: 0, y: 0, w: 10, h: 5.63,
        fill: { color: "000000", transparency: 50 },
      });
    } else {
      pptSlide.background = { color: bgColor };
    }

    const slideTextColor = slide.backgroundImage ? "FFFFFF" : textColor;
    const slideSubColor = slide.backgroundImage ? "CCCCCC" : subtitleColorHex;

    switch (slide.layout) {
      case "title":
        pptSlide.addText(slide.title || "Untitled", {
          x: 0.8, y: 1.8, w: 8.4, h: 1.5,
          fontSize: 40, bold: true, color: slideTextColor, align: "center", valign: "bottom",
        });
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 0.8, y: 3.4, w: 8.4, h: 0.8,
            fontSize: 20, color: slideSubColor, align: "center",
          });
        }
        break;

      case "statement":
        pptSlide.addText(slide.content || "", {
          x: 1.2, y: 1.5, w: 7.6, h: 2.5,
          fontSize: 32, bold: true, color: slideTextColor, align: "center", valign: "middle",
        });
        if (slide.title) {
          pptSlide.addText(slide.title.toUpperCase(), {
            x: 1.5, y: 4.2, w: 7, h: 0.5,
            fontSize: 10, color: slideSubColor, align: "center",
          });
        }
        break;

      case "imageFeature":
        pptSlide.addText(slide.title || "Untitled", {
          x: 0.8, y: 1.5, w: 8.4, h: 1.8,
          fontSize: 48, bold: true, color: "FFFFFF", align: "center", valign: "bottom",
        });
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 0.8, y: 3.4, w: 8.4, h: 0.8,
            fontSize: 20, color: "CCCCCC", align: "center",
          });
        }
        break;

      case "section":
        pptSlide.addText(slide.title || "Section", {
          x: 0.5, y: 2.2, w: 9, h: 1,
          fontSize: 36, bold: true, color: slideTextColor, align: "center",
        });
        break;

      case "bullets":
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor,
          });
        }
        if (slide.bullets?.length) {
          pptSlide.addText(
            slide.bullets.map((b) => ({
              text: b,
              options: { bullet: { type: "bullet" as const }, color: slideTextColor, fontSize: 18 },
            })),
            { x: 0.7, y: slide.title ? 1.5 : 0.5, w: 8.5, h: 3.5 }
          );
        }
        break;

      case "metrics":
      case "stats": {
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor,
          });
        }
        const stats = slide.stats || [];
        const count = Math.min(stats.length, 4);
        if (count > 0) {
          const cardW = (8.5 - (count - 1) * 0.2) / count;
          for (let si = 0; si < count; si++) {
            const cx = 0.7 + si * (cardW + 0.2);
            const cy = slide.title ? 1.6 : 0.8;
            pptSlide.addText(stats[si].value, {
              x: cx, y: cy, w: cardW, h: 1.2,
              fontSize: slide.layout === "metrics" ? 44 : 36,
              bold: true, color: accentColorHex, align: "center", valign: "bottom",
            });
            pptSlide.addText(stats[si].label.toUpperCase(), {
              x: cx, y: cy + 1.2, w: cardW, h: 0.5,
              fontSize: 10, color: slideSubColor, align: "center", valign: "top",
            });
          }
        }
        break;
      }

      case "featureGrid": {
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor,
          });
        }
        const bullets = slide.bullets || [];
        const features = bullets.map((b) => {
          const match = b.match(/^\*\*(.+?)\*\*\s*(.*)/);
          if (match) return { title: match[1], desc: match[2] };
          return { title: b, desc: "" };
        });
        const cols = features.length <= 4 ? 2 : 3;
        const rows = Math.ceil(features.length / cols);
        const cardW = (8.5 - (cols - 1) * 0.2) / cols;
        const cardH = Math.min(1.5, (3.5 - (rows - 1) * 0.15) / rows);
        features.forEach((f, fi) => {
          const col = fi % cols;
          const row = Math.floor(fi / cols);
          const cx = 0.7 + col * (cardW + 0.2);
          const cy = (slide.title ? 1.5 : 0.5) + row * (cardH + 0.15);
          pptSlide.addText(f.title, {
            x: cx, y: cy, w: cardW, h: 0.5,
            fontSize: 14, bold: true, color: slideTextColor,
          });
          if (f.desc) {
            pptSlide.addText(f.desc, {
              x: cx, y: cy + 0.45, w: cardW, h: cardH - 0.5,
              fontSize: 11, color: slideSubColor,
            });
          }
        });
        break;
      }

      case "logoGrid": {
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.5, y: 0.5, w: 9, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor, align: "center",
          });
        }
        const logos = slide.bullets || [];
        const lCols = logos.length <= 4 ? logos.length : logos.length <= 6 ? 3 : 4;
        const lRows = Math.ceil(logos.length / lCols);
        const lCardW = Math.min(2, (8 - (lCols - 1) * 0.3) / lCols);
        const lCardH = Math.min(1.2, (3 - (lRows - 1) * 0.3) / lRows);
        const totalW = lCols * lCardW + (lCols - 1) * 0.3;
        const startX = (10 - totalW) / 2;
        logos.forEach((name, li) => {
          const col = li % lCols;
          const row = Math.floor(li / lCols);
          const cx = startX + col * (lCardW + 0.3);
          const cy = (slide.title ? 1.8 : 1) + row * (lCardH + 0.3);
          pptSlide.addText(name, {
            x: cx, y: cy, w: lCardW, h: lCardH,
            fontSize: 14, bold: true, color: slideSubColor, align: "center", valign: "middle",
          });
        });
        break;
      }

      case "quote":
        pptSlide.addText(`\u201C${slide.content || ""}\u201D`, {
          x: 1.5, y: 1.5, w: 7, h: 2,
          fontSize: 24, italic: true, color: slideTextColor, align: "center", valign: "middle",
        });
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 1.5, y: 3.5, w: 7, h: 0.6,
            fontSize: 14, color: slideSubColor, align: "center",
          });
        }
        break;

      case "twoColumn":
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor,
          });
        }
        pptSlide.addText(slide.content || "", {
          x: 0.7, y: slide.title ? 1.6 : 0.5, w: 4, h: 3.2,
          fontSize: 16, color: slideSubColor, valign: "top",
        });
        pptSlide.addText(slide.subtitle || "", {
          x: 5.2, y: slide.title ? 1.6 : 0.5, w: 4, h: 3.2,
          fontSize: 16, color: slideSubColor, valign: "top",
        });
        break;

      default:
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: slideTextColor,
          });
        }
        if (slide.content) {
          pptSlide.addText(slide.content, {
            x: 0.7, y: slide.title ? 1.5 : 0.5, w: 8.5, h: 3.5,
            fontSize: 16, color: slideSubColor,
          });
        }
        break;
    }
  }

  pptx.writeFile({ fileName: "presentation.pptx" });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(clean);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

/** Resolve any color to a hex value for PPTX.
 * For rgba colors, blends against an optional background color. */
function resolveColor(color: string, blendBg?: string): string {
  if (color.startsWith("#")) return color;
  if (color.startsWith("linear-gradient")) {
    const match = color.match(/#[a-fA-F0-9]{6}/);
    return match ? match[0] : "#1a1a1a";
  }
  if (color.startsWith("rgba")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] !== "" ? parseFloat(match[4]) : 1;
      const bg = blendBg ? hexToRgb(resolveColor(blendBg)) : { r: 0, g: 0, b: 0 };
      const blendR = Math.round(r * a + bg.r * (1 - a));
      const blendG = Math.round(g * a + bg.g * (1 - a));
      const blendB = Math.round(b * a + bg.b * (1 - a));
      return `#${blendR.toString(16).padStart(2, "0")}${blendG.toString(16).padStart(2, "0")}${blendB.toString(16).padStart(2, "0")}`;
    }
    return "#999999";
  }
  return "#333333";
}
