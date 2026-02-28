import { DeckSlide } from "@/lib/types";
import { ThemeConfig, getThemeConfig } from "./deckThemes";

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
        <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border:2px solid ${t.accentLight};border-radius:16px;transform:rotate(45deg)"></div>
        <div style="position:absolute;bottom:40px;left:-20px;width:60px;height:60px;background:${t.accentLight};border-radius:8px;transform:rotate(15deg)"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>`;
    case "organic":
      return `
        <div style="position:absolute;top:-120px;right:-80px;width:400px;height:400px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 70%);border-radius:50%"></div>
        <div style="position:absolute;bottom:-100px;left:-60px;width:300px;height:300px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 70%);border-radius:50%"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 0%,${t.accent} 50%,transparent 100%);opacity:0.4"></div>`;
    case "minimal":
      return `
        <div style="position:absolute;top:48px;left:0;width:4px;height:80px;background:${t.accent};border-radius:0 2px 2px 0;opacity:0.8"></div>
        <div style="position:absolute;bottom:0;left:72px;right:72px;height:1px;background:${t.divider}"></div>`;
    case "gradient":
      return `
        <div style="position:absolute;top:-150px;right:-100px;width:500px;height:500px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 60%);border-radius:50%"></div>
        <div style="position:absolute;bottom:-120px;left:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(255,60,172,0.08) 0%,transparent 60%);border-radius:50%"></div>`;
    case "dots":
      return `
        <div style="position:absolute;inset:0;opacity:0.04;background-image:radial-gradient(${t.accent} 1px,transparent 1px);background-size:24px 24px"></div>
        <div style="position:absolute;top:-80px;right:-80px;width:300px;height:300px;background:radial-gradient(circle,${t.accentLight} 0%,transparent 60%);border-radius:50%"></div>
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>`;
    case "lines":
      return `
        <div style="position:absolute;top:0;right:0;width:200px;height:200px;opacity:0.03;background-image:repeating-linear-gradient(-45deg,${t.accent},${t.accent} 1px,transparent 1px,transparent 16px)"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>
        <div style="position:absolute;top:24px;right:24px;width:48px;height:48px;border:1.5px solid ${t.accentLight};border-radius:8px;transform:rotate(45deg)"></div>`;
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
  const isCentered = slide.layout === "title" || slide.layout === "section" || slide.layout === "quote";
  const padding = isCentered ? "64px 80px" : "56px 72px";
  const justify = isCentered ? "center" : "flex-start";
  const headingCss = `font-weight:${t.headingWeight};font-family:${t.headingFont};letter-spacing:-0.02em;color:${t.text};${t.headingCase === "uppercase" ? "text-transform:uppercase;" : ""}`;

  switch (slide.layout) {
    case "title":
      return `<div style="text-align:center;max-width:800px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:${justify};padding:${padding};box-sizing:border-box;height:100%">
        <div style="width:48px;height:4px;border-radius:2px;background:linear-gradient(90deg,${t.accent},${t.accentAlt});margin-bottom:28px"></div>
        <div style="font-size:52px;line-height:1.12;letter-spacing:-0.03em;text-align:center;${headingCss}">${esc(slide.title || "Untitled")}</div>
        ${slide.subtitle ? `<div style="font-size:21px;color:${t.textSecondary};line-height:1.55;font-weight:400;letter-spacing:0.01em;text-align:center;margin-top:20px;font-family:${t.bodyFont}">${esc(slide.subtitle)}</div>` : ""}
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
            icon = `<span style="flex-shrink:0;width:4px;height:20px;border-radius:2px;background:${t.accent};margin-top:5px"></span>`;
            break;
          default:
            icon = `<span style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${t.accent};margin-top:10px"></span>`;
        }
        return `<div style="display:flex;align-items:flex-start;gap:14px;padding:10px 16px;background:${t.cardBg};border:1px solid ${t.cardBorder};border-radius:10px">
          ${icon}
          <span style="font-size:19px;line-height:1.5;flex:1;font-family:${t.bodyFont}">${esc(b)}</span>
        </div>`;
      }).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:34px;margin-bottom:32px;line-height:1.2;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:flex;flex-direction:column;gap:10px;overflow:hidden;flex:1">${bulletItems}</div>
      </div>`;
    }

    case "stats": {
      const stats = slide.stats || [];
      const statCards = stats.map((s) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 20px;border-radius:14px;background:${t.cardBg};border:1px solid ${t.cardBorder};text-align:center;gap:8px">
          <div style="font-size:48px;font-weight:${t.headingWeight};font-family:${t.headingFont};color:${t.accent};letter-spacing:-0.03em;line-height:1.1">${esc(s.value)}</div>
          <div style="font-size:14px;font-weight:600;font-family:${t.bodyFont};color:${t.textSecondary};letter-spacing:0.04em;text-transform:uppercase">${esc(s.label)}</div>
        </div>`).join("\n");

      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:34px;margin-bottom:36px;line-height:1.2;${headingCss}">${esc(slide.title)}</div>` : ""}
        <div style="display:flex;gap:20px;flex:1;align-items:stretch">${statCards}</div>
      </div>`;
    }

    case "quote":
      return `<div style="text-align:center;max-width:720px;margin:0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${padding};box-sizing:border-box;height:100%">
        <div style="font-size:120px;line-height:0.6;font-family:${t.headingFont};color:${t.accent};opacity:0.25;margin-bottom:12px;font-weight:${t.headingWeight}">&ldquo;</div>
        <div style="font-size:28px;font-style:italic;line-height:1.55;font-weight:400;letter-spacing:0.005em;color:${t.text};font-family:${t.headingFont};text-align:center">${esc(slide.content || "")}</div>
        ${slide.title ? `<div style="margin-top:32px;display:flex;align-items:center;justify-content:center;gap:12px">
          <div style="width:24px;height:2px;background:${t.accent};border-radius:1px"></div>
          <div style="font-size:16px;color:${t.textSecondary};font-weight:500;letter-spacing:0.03em;font-family:${t.bodyFont}">${esc(slide.title)}</div>
          <div style="width:24px;height:2px;background:${t.accent};border-radius:1px"></div>
        </div>` : ""}
      </div>`;

    case "twoColumn":
      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:34px;margin-bottom:12px;line-height:1.2;${headingCss}">${esc(slide.title)}</div>
        <div style="width:48px;height:3px;border-radius:2px;margin-bottom:32px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>` : ""}
        <div style="display:flex;gap:28px;flex:1">
          <div style="flex:1;padding:20px 24px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
            <div style="font-size:17px;line-height:1.65;color:${t.textSecondary};white-space:pre-wrap;font-family:${t.bodyFont}">${esc(slide.content || "")}</div>
          </div>
          <div style="flex:1;padding:20px 24px;border-radius:12px;background:${t.cardBg};border:1px solid ${t.cardBorder}">
            <div style="font-size:17px;line-height:1.65;color:${t.textSecondary};white-space:pre-wrap;font-family:${t.bodyFont}">${esc(slide.subtitle || "")}</div>
          </div>
        </div>
      </div>`;

    case "titleContent":
    default:
      return `<div style="display:flex;flex-direction:column;justify-content:flex-start;padding:${padding};box-sizing:border-box;height:100%">
        ${slide.title ? `<div style="font-size:34px;margin-bottom:12px;line-height:1.2;${headingCss}">${esc(slide.title)}</div>
        <div style="width:48px;height:3px;border-radius:2px;margin-bottom:28px;background:linear-gradient(90deg,${t.accent},${t.accentAlt})"></div>` : ""}
        ${slide.content ? `<div style="font-size:19px;line-height:1.7;color:${t.textSecondary};white-space:pre-wrap;max-width:780px;font-family:${t.bodyFont};flex:1">${esc(slide.content)}</div>` : ""}
      </div>`;
  }
}

/**
 * Render a full slide (background + decor + content) as standalone HTML.
 */
function slideToHtml(slide: DeckSlide, t: ThemeConfig): string {
  // HTML slides already have their own markup
  if (slide.layout === "html" && slide.html) {
    return slide.html;
  }

  return `<div style="width:960px;height:540px;position:relative;overflow:hidden;background:${t.bg};color:${t.text};font-family:${t.bodyFont};box-sizing:border-box">
    ${decorHtml(t)}
    <div style="position:relative;z-index:1;width:100%;height:100%">
      ${slideContentHtml(slide, t)}
    </div>
  </div>`;
}

/**
 * Export deck as PDF via server-side Puppeteer rendering.
 * Each slide becomes a separate landscape page.
 */
export async function exportDeckToPDF(slides: DeckSlide[], theme: string) {
  const t = getThemeConfig(theme);

  // Build a single HTML document with all slides as page-break-separated sections
  const slidePages = slides.map((slide) => slideToHtml(slide, t)).join("\n");

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 960px 540px; margin: 0; }
    body { width: 960px; margin: 0; padding: 0; }
    .slide-page { width: 960px; height: 540px; overflow: hidden; page-break-after: always; position: relative; }
    .slide-page:last-child { page-break-after: auto; }
  `;

  // Wrap each slide in a page container
  const wrappedSlides = slides.map((slide) =>
    `<div class="slide-page">${slideToHtml(slide, t)}</div>`
  ).join("\n");

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
/* PPTX export — unchanged, uses pptxgenjs                                      */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function exportDeckToPPTX(slides: DeckSlide[], theme: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const t = getThemeConfig(theme);
  const pptx = new PptxGenJS();

  const bgColor = resolveColor(t.bg).replace("#", "");
  const textColor = resolveColor(t.text, t.bg).replace("#", "");
  const subtitleColorHex = resolveColor(t.textSecondary, t.bg).replace("#", "");
  const accentColorHex = t.accent.replace("#", "");

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();

    // HTML slides: just show title as fallback (no html2canvas)
    if (slide.layout === "html" && slide.html) {
      pptSlide.background = { color: "888888" };
      pptSlide.addText(slide.title || "HTML Slide", {
        x: 0, y: 2, w: 10, h: 1.5,
        fontSize: 24, color: "FFFFFF", align: "center",
      });
      continue;
    }

    pptSlide.background = { color: bgColor };

    // Bottom accent bar
    pptSlide.addShape("rect" as any, {
      x: 0, y: 5.34, w: 10, h: 0.04, fill: { color: accentColorHex },
    });

    switch (slide.layout) {
      case "title":
        pptSlide.addText(slide.title || "Untitled", {
          x: 0.8, y: 1.8, w: 8.4, h: 1.5,
          fontSize: 40, bold: true, color: textColor, align: "center", valign: "bottom",
        });
        if (slide.subtitle) {
          pptSlide.addText(slide.subtitle, {
            x: 0.8, y: 3.4, w: 8.4, h: 0.8,
            fontSize: 20, color: subtitleColorHex, align: "center",
          });
        }
        break;

      case "section":
        pptSlide.addText(slide.title || "Section", {
          x: 0.5, y: 2.2, w: 9, h: 1,
          fontSize: 36, bold: true, color: textColor, align: "center",
        });
        break;

      case "bullets":
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: textColor,
          });
        }
        if (slide.bullets?.length) {
          pptSlide.addText(
            slide.bullets.map((b) => ({
              text: b,
              options: { bullet: { type: "bullet" as const }, color: textColor, fontSize: 18 },
            })),
            { x: 0.7, y: slide.title ? 1.5 : 0.5, w: 8.5, h: 3.5 }
          );
        }
        break;

      case "stats": {
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: textColor,
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
              fontSize: 36, bold: true, color: accentColorHex, align: "center", valign: "bottom",
            });
            pptSlide.addText(stats[si].label.toUpperCase(), {
              x: cx, y: cy + 1.2, w: cardW, h: 0.5,
              fontSize: 10, color: subtitleColorHex, align: "center", valign: "top",
            });
          }
        }
        break;
      }

      case "quote":
        pptSlide.addText(`"${slide.content || ""}"`, {
          x: 1.5, y: 1.5, w: 7, h: 2,
          fontSize: 24, italic: true, color: textColor, align: "center", valign: "middle",
        });
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 1.5, y: 3.5, w: 7, h: 0.6,
            fontSize: 14, color: subtitleColorHex, align: "center",
          });
        }
        break;

      case "twoColumn":
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: textColor,
          });
        }
        pptSlide.addText(slide.content || "", {
          x: 0.7, y: slide.title ? 1.6 : 0.5, w: 4, h: 3.2,
          fontSize: 16, color: subtitleColorHex, valign: "top",
        });
        pptSlide.addText(slide.subtitle || "", {
          x: 5.2, y: slide.title ? 1.6 : 0.5, w: 4, h: 3.2,
          fontSize: 16, color: subtitleColorHex, valign: "top",
        });
        break;

      default:
        if (slide.title) {
          pptSlide.addText(slide.title, {
            x: 0.7, y: 0.5, w: 8.5, h: 0.8,
            fontSize: 26, bold: true, color: textColor,
          });
        }
        if (slide.content) {
          pptSlide.addText(slide.content, {
            x: 0.7, y: slide.title ? 1.5 : 0.5, w: 8.5, h: 3.5,
            fontSize: 16, color: subtitleColorHex,
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
