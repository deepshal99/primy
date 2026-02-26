import { DeckSlide, DeckTheme } from "@/lib/types";
import { deckThemes } from "./deckThemes";

export async function exportDeckToPDF(slides: DeckSlide[], theme: DeckTheme) {
  const { jsPDF } = await import("jspdf");
  const t = deckThemes[theme];
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540] });

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([960, 540], "landscape");

    const slide = slides[i];

    // Background
    if (!t.bg.startsWith("linear-gradient")) {
      pdf.setFillColor(t.bg);
      pdf.rect(0, 0, 960, 540, "F");
    } else {
      // Fallback solid for gradient
      pdf.setFillColor("#1e1b4b");
      pdf.rect(0, 0, 960, 540, "F");
    }

    // Accent top bar for corporate/dark themes
    if (theme === "corporate" || theme === "dark") {
      const accentRgb = hexToRgb(t.accent);
      pdf.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
      pdf.rect(0, 0, 960, 4, "F");
    }

    // Bottom accent bar for light theme
    if (theme === "light") {
      const accentRgb = hexToRgb(t.accent);
      pdf.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
      pdf.rect(0, 536, 960, 4, "F");
    }

    pdf.setFont("helvetica");
    const textColor = hexToRgb(resolveColor(t.text));
    const subtitleColor = hexToRgb(resolveColor(t.subtitle));
    const accentColor = hexToRgb(t.accent);

    switch (slide.layout) {
      case "title": {
        // Accent bar centered
        pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
        pdf.roundedRect(456, 200, 48, 4, 2, 2, "F");
        // Title
        pdf.setFontSize(44);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(textColor.r, textColor.g, textColor.b);
        const titleLines = pdf.splitTextToSize(slide.title || "Untitled", 760);
        pdf.text(titleLines, 480, 240, { align: "center" });
        // Subtitle
        if (slide.subtitle) {
          pdf.setFontSize(20);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(subtitleColor.r, subtitleColor.g, subtitleColor.b);
          pdf.text(slide.subtitle, 480, 240 + titleLines.length * 50 + 16, { align: "center" });
        }
        break;
      }
      case "section": {
        // Decorative lines + circle
        pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
        pdf.setLineWidth(1);
        pdf.line(410, 240, 450, 240);
        pdf.circle(480, 240, 5);
        pdf.line(510, 240, 550, 240);
        // Title
        pdf.setFontSize(36);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(textColor.r, textColor.g, textColor.b);
        pdf.text(slide.title || "Section", 480, 280, { align: "center" });
        break;
      }
      case "bullets": {
        let y = 56;
        if (slide.title) {
          pdf.setFontSize(28);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          pdf.text(slide.title, 72, y + 28);
          y += 64;
        }
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "normal");
        for (const bullet of slide.bullets || []) {
          // Bullet dot
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.circle(84, y + 16, 4, "F");
          // Text
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          const lines = pdf.splitTextToSize(bullet, 780);
          pdf.text(lines, 100, y + 20);
          y += lines.length * 24 + 20;
        }
        break;
      }
      case "quote": {
        // Large quote mark
        pdf.setFontSize(80);
        pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
        pdf.setFont("helvetica", "bold");
        pdf.text('"', 480, 190, { align: "center" });
        // Quote text
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(textColor.r, textColor.g, textColor.b);
        const quoteLines = pdf.splitTextToSize(slide.content || "", 620);
        pdf.text(quoteLines, 480, 230, { align: "center" });
        // Attribution
        if (slide.title) {
          const attrY = 230 + quoteLines.length * 28 + 28;
          // Decorative lines
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.rect(456, attrY - 6, 24, 2, "F");
          pdf.rect(480 + 4, attrY - 6, 24, 2, "F");
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(subtitleColor.r, subtitleColor.g, subtitleColor.b);
          pdf.text(slide.title, 480, attrY + 10, { align: "center" });
        }
        break;
      }
      case "twoColumn": {
        let y = 56;
        if (slide.title) {
          pdf.setFontSize(28);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          pdf.text(slide.title, 72, y + 28);
          // Accent bar
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.roundedRect(72, y + 40, 48, 3, 1, 1, "F");
          y += 72;
        }
        // Left column
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(subtitleColor.r, subtitleColor.g, subtitleColor.b);
        const leftLines = pdf.splitTextToSize(slide.content || "Left column", 380);
        pdf.text(leftLines, 72, y + 18);
        // Right column
        const rightLines = pdf.splitTextToSize(slide.subtitle || "Right column", 380);
        pdf.text(rightLines, 504, y + 18);
        break;
      }
      default: {
        // titleContent, blank
        let y = 56;
        if (slide.title) {
          pdf.setFontSize(28);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(textColor.r, textColor.g, textColor.b);
          pdf.text(slide.title, 72, y + 28);
          // Accent bar
          pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.roundedRect(72, y + 40, 48, 3, 1, 1, "F");
          y += 68;
        }
        if (slide.content) {
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(subtitleColor.r, subtitleColor.g, subtitleColor.b);
          const lines = pdf.splitTextToSize(slide.content, 816);
          pdf.text(lines, 72, y + 18);
        }
        break;
      }
    }
  }

  pdf.save("presentation.pdf");
}

export async function exportDeckToPPTX(slides: DeckSlide[], theme: DeckTheme) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const t = deckThemes[theme];
  const pptx = new PptxGenJS();

  const textColor = resolveColor(t.text).replace("#", "");
  const subtitleColorHex = resolveColor(t.subtitle).replace("#", "");
  const accentColorHex = t.accent.replace("#", "");
  const bgColor = t.bg.startsWith("linear-gradient") ? "1e1b4b" : t.bg.replace("#", "");

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: bgColor };

    // Top accent bar for corporate/dark
    if (theme === "corporate" || theme === "dark") {
      pptSlide.addShape("rect" as any, {
        x: 0, y: 0, w: 10, h: 0.06, fill: { color: accentColorHex },
      });
    }

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
        pptSlide.addText(slide.content || "Left column", {
          x: 0.7, y: slide.title ? 1.6 : 0.5, w: 4, h: 3.2,
          fontSize: 16, color: subtitleColorHex, valign: "top",
        });
        pptSlide.addText(slide.subtitle || "Right column", {
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
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

/** Resolve rgba/non-hex colors to a hex fallback */
function resolveColor(color: string): string {
  if (color.startsWith("#")) return color;
  if (color.startsWith("rgba")) return "#999999";
  return "#333333";
}
