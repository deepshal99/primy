/**
 * Runtime computed-contrast enforcement for rendered slides.
 *
 * The string-based `enforceSlideContrast` (regex over the HTML source) is
 * fundamentally blind: it can't resolve a color painted by a gradient, a
 * `var()` chain, inherited backgrounds, or alpha compositing. Real AI slides
 * fail exactly there — e.g. near-black body text (`rgb(34,31,26)`) sitting on a
 * slide whose dark background is painted by a child gradient (root bg is
 * `transparent`), which the regex bails on (`if (!bgColor) return html`). The
 * result is contrast 1.28 — invisible — shipping to users.
 *
 * This pass runs AFTER the slide is in the DOM (shadow root in-app, or the
 * Puppeteer page on export), so `getComputedStyle` gives us the *actual* painted
 * colors. We walk every text-bearing element, resolve its effective foreground
 * and background, and rewrite the color only when it fails WCAG. Deterministic,
 * no model call — it doubles as the deterministic guard the critique loop can
 * lean on (Chunk 3).
 *
 * Pure helpers (luminance, ratio, parsing, picking a readable ink) are exported
 * for unit testing; the DOM walk needs a real layout engine and is exercised in
 * the app / Puppeteer, not jsdom.
 */

/** WCAG AA contrast floors. */
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
/** Below this foreground alpha, text reads as a ghost regardless of hue. */
const MIN_TEXT_ALPHA = 0.5;

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse an rgb()/rgba()/#hex color into RGBA (0-255, a 0-1). null if unparseable. */
export function parseRenderedColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const rgb = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] !== undefined ? +rgb[4] : 1 };
  }
  const hex6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (hex6) return { r: parseInt(hex6[1], 16), g: parseInt(hex6[2], 16), b: parseInt(hex6[3], 16), a: 1 };
  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
      a: 1,
    };
  }
  return null;
}

/** First literal rgb/hex color inside a `linear-gradient(...)` / image string. */
export function colorFromGradient(bgImage: string): Rgba | null {
  if (!bgImage || bgImage === "none") return null;
  const m = bgImage.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,6}/);
  return m ? parseRenderedColor(m[0]) : null;
}

/** Composite a (possibly translucent) color over an opaque backdrop. */
export function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
    a,
  };
}

/** WCAG relative luminance (0 black → 1 white). */
export function relLuminance({ r, g, b }: Rgba): number {
  const lin = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two opaque colors. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Readable ink for a background: brand light or dark, whichever contrasts more. */
const INK_LIGHT: Rgba = { r: 245, g: 243, b: 238, a: 1 }; // #F5F3EE
const INK_DARK: Rgba = { r: 26, g: 24, b: 21, a: 1 }; // #1A1815
export function readableInk(bg: Rgba): Rgba {
  return contrastRatio(INK_LIGHT, bg) >= contrastRatio(INK_DARK, bg) ? INK_LIGHT : INK_DARK;
}

function toCss({ r, g, b }: Rgba): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Large text gets the AA_LARGE floor (≥24px, or ≥18.66px bold). */
function floorFor(fontSizePx: number, weight: number): number {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && weight >= 700);
  return large ? AA_LARGE : AA_NORMAL;
}

/**
 * Resolve the effective (opaque) background painted behind `el` by walking
 * ancestors until an opaque-enough fill or a gradient color is found. Falls back
 * to white — the same assumption the browser makes for an unpainted page.
 */
function effectiveBg(el: Element, root: ParentNode): Rgba {
  let node: Element | null = el;
  let acc: Rgba | null = null;
  const stopHost = (root as ShadowRoot).host ?? null;
  while (node && node !== stopHost) {
    const cs = getComputedStyle(node);
    const own = parseRenderedColor(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 };
    let layer: Rgba | null = own.a > 0 ? own : null;
    if (!layer) {
      const grad = colorFromGradient(cs.backgroundImage);
      if (grad) layer = grad;
    }
    if (layer) {
      acc = acc ? composite(acc, layer) : layer;
      if (acc.a >= 0.95) return acc;
    }
    node = node.parentElement;
  }
  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  return acc ? composite(acc, white) : white;
}

/** True when an element directly holds visible (non-whitespace) text. */
function hasOwnText(el: Element): boolean {
  for (const n of el.childNodes) {
    if (n.nodeType === 3 && (n.textContent || "").trim().length > 0) return true;
  }
  return false;
}

export interface ContrastFixStats {
  scanned: number;
  fixed: number;
}

/**
 * Walk a rendered slide subtree and rewrite any text color that fails WCAG
 * against its real background, or that is too translucent to read. Mutates the
 * DOM in place (sets inline `color`). Returns counts for telemetry/guards.
 */
export function fixContrastInRoot(root: ParentNode): ContrastFixStats {
  const els = root.querySelectorAll<HTMLElement>("*");
  let scanned = 0;
  let fixed = 0;
  els.forEach((el) => {
    if (!hasOwnText(el)) return;
    scanned++;
    const cs = getComputedStyle(el);
    const fg = parseRenderedColor(cs.color);
    if (!fg) return;
    const bg = effectiveBg(el, root);
    const fgOpaque = composite(fg, bg);
    const ratio = contrastRatio(fgOpaque, bg);
    const floor = floorFor(parseFloat(cs.fontSize) || 16, parseInt(cs.fontWeight) || 400);
    const ghost = fg.a < MIN_TEXT_ALPHA;
    if (ratio >= floor && !ghost) return;
    el.style.setProperty("color", toCss(readableInk(bg)), "important");
    fixed++;
  });
  return { scanned, fixed };
}
