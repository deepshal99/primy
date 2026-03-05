import DOMPurify from "dompurify";

// ─── Contrast enforcement utilities ───────────────────────────────────────────

/** Parse a CSS color string into [r, g, b] (0-255). Supports hex and rgb(). */
function parseColor(color: string): [number, number, number] | null {
  const s = color.trim().toLowerCase();
  // #rgb
  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) return [parseInt(hex3[1] + hex3[1], 16), parseInt(hex3[2] + hex3[2], 16), parseInt(hex3[3] + hex3[3], 16)];
  // #rrggbb
  const hex6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (hex6) return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
}

/** Relative luminance (0 = black, 1 = white). */
function luminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Is the color dark? (luminance < 0.35) */
function isDark(rgb: [number, number, number]): boolean {
  return luminance(rgb) < 0.35;
}

/** Escape string for use in RegExp constructor. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Post-process slide HTML to enforce text/background contrast.
 * Extracts --bg and --text CSS variables, checks luminance, and fixes mismatches.
 * Also scans inline color styles for hardcoded dark-on-dark or light-on-light issues.
 */
export function enforceSlideContrast(html: string): string {
  // Extract CSS variable definitions from <style> block
  const varRegex = /--bg\s*:\s*([^;}\s]+)/;
  const textVarRegex = /--text\s*:\s*([^;}\s]+)/;
  const accentVarRegex = /--accent\s*:\s*([^;}\s]+)/;

  const bgMatch = html.match(varRegex);
  const textMatch = html.match(textVarRegex);
  const accentMatch = html.match(accentVarRegex);
  const accentColor = accentMatch ? parseColor(accentMatch[1]) : null;

  // Also try to extract bg from inline style on root div (background:#... or background:linear-gradient(...))
  let bgColor: [number, number, number] | null = null;
  if (bgMatch) {
    bgColor = parseColor(bgMatch[1]);
  }
  // Fallback: extract first hex color from inline background style
  if (!bgColor) {
    const inlineBg = html.match(/background\s*:\s*(?:linear-gradient\([^,]+,\s*)?([#][0-9a-fA-F]{3,6})/);
    if (inlineBg) bgColor = parseColor(inlineBg[1]);
  }
  if (!bgColor) return html; // Can't determine bg color

  const bgIsDark = isDark(bgColor);
  let result = html;

  // Fix --text if it has wrong contrast
  if (textMatch) {
    const textColor = parseColor(textMatch[1]);
    if (textColor) {
      const textIsDark = isDark(textColor);
      // Both dark or both light = contrast problem
      if (bgIsDark && textIsDark) {
        // Dark bg + dark text → force white text
        result = result.replace(
          /--text\s*:\s*[^;}\s]+/,
          "--text:#f0f0f5"
        );
      } else if (!bgIsDark && !textIsDark) {
        // Light bg + light text → force dark text
        result = result.replace(
          /--text\s*:\s*[^;}\s]+/,
          "--text:#1a1a2e"
        );
      }
    }
  }

  // Fix --muted if present (ensure it's also readable)
  const mutedVarRegex = /--muted\s*:\s*([^;}\s]+)/;
  const mutedMatch = result.match(mutedVarRegex);
  if (mutedMatch) {
    const mutedColor = parseColor(mutedMatch[1]);
    if (mutedColor && bgIsDark && isDark(mutedColor)) {
      result = result.replace(
        /--muted\s*:\s*[^;}\s]+/,
        "--muted:rgba(255,255,255,0.5)"
      );
    } else if (mutedColor && !bgIsDark && !isDark(mutedColor)) {
      result = result.replace(
        /--muted\s*:\s*[^;}\s]+/,
        "--muted:#6b6b80"
      );
    }
  }

  // Fix inline hardcoded color values on text elements.
  // Look for color: followed by a hex or rgb value inside style attributes.
  // If the bg is dark and the inline color is also dark, replace with white.
  // If the bg is light and the inline color is also light, replace with dark.
  result = result.replace(
    /color\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/g,
    (match, colorStr) => {
      // Skip var() references — those are already handled above
      if (colorStr.startsWith("var(")) return match;
      const rgb = parseColor(colorStr);
      if (!rgb) return match;
      const colorIsDark = isDark(rgb);
      // Don't fix accent-like colors used for decorative spans — only fix
      // colors that clearly violate contrast (same darkness as background)
      if (bgIsDark && colorIsDark) {
        return "color:#f0f0f5";
      }
      if (!bgIsDark && !colorIsDark && luminance(rgb) > 0.6) {
        return "color:#1a1a2e";
      }
      return match;
    }
  );

  // Build a map of known CSS variable values for resolving var() references
  const varMap: Record<string, [number, number, number] | null> = {
    "--accent": accentColor,
    "--bg": bgColor,
    "--text": textMatch ? parseColor(textMatch[1]) : null,
  };

  /** Resolve a CSS color value which may be a var() reference or a literal color. */
  function resolveColor(val: string): [number, number, number] | null {
    const trimmed = val.trim();
    const varRef = trimmed.match(/^var\(\s*(--[a-zA-Z-]+)\s*\)$/);
    if (varRef) return varMap[varRef[1]] || null;
    return parseColor(trimmed);
  }

  /** Extract background color from a style string, resolving var() refs. */
  function extractBgFromStyle(style: string): [number, number, number] | null {
    // Match var(--xxx) in background
    const varBg = style.match(/background(?:-color)?\s*:\s*var\(\s*(--[a-zA-Z-]+)\s*\)/);
    if (varBg) return varMap[varBg[1]] || null;
    // Match literal color
    const litBg = style.match(/background(?:-color)?\s*:\s*(?:linear-gradient\([^,]+,\s*)?([#][0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
    if (litBg) return parseColor(litBg[1]);
    return null;
  }

  /** Extract text color from a style string, resolving var() refs. */
  function extractColorFromStyle(style: string): { raw: string; rgb: [number, number, number] } | null {
    // Match var(--xxx) color
    const varColor = style.match(/(?:^|;)\s*color\s*:\s*(var\(\s*--[a-zA-Z-]+\s*\))/);
    if (varColor) {
      const rgb = resolveColor(varColor[1]);
      return rgb ? { raw: varColor[1], rgb } : null;
    }
    // Match literal color
    const litColor = style.match(/(?:^|;)\s*color\s*:\s*([#][0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
    if (litColor) {
      const rgb = parseColor(litColor[1]);
      return rgb ? { raw: litColor[1], rgb } : null;
    }
    return null;
  }

  // Fix per-element contrast: scan ALL style attributes for background+color mismatches.
  // Catches buttons, cards, badges where bg and text color don't contrast.
  result = result.replace(
    /style\s*=\s*['"]([^'"]+)['"]/gi,
    (fullMatch, styleContent: string) => {
      const elBg = extractBgFromStyle(styleContent);
      if (!elBg) return fullMatch; // No background — skip

      const elBgIsDark = isDark(elBg);
      const colorInfo = extractColorFromStyle(styleContent);

      if (!colorInfo) {
        // Has background but no explicit color — check if bg differs from root (likely button/card)
        const elBgLum = luminance(elBg);
        const rootBgLum = luminance(bgColor!);
        if (Math.abs(elBgLum - rootBgLum) > 0.15) {
          const safeColor = elBgIsDark ? "#ffffff" : "#1a1a2e";
          const newStyle = styleContent + `;color:${safeColor}`;
          return fullMatch.replace(styleContent, newStyle);
        }
        return fullMatch;
      }

      const elColorIsDark = isDark(colorInfo.rgb);

      // Both dark = contrast violation → force white
      if (elBgIsDark && elColorIsDark) {
        const fixed = styleContent.replace(
          new RegExp(`color\\s*:\\s*${escapeRegExp(colorInfo.raw)}`),
          "color:#ffffff"
        );
        return fullMatch.replace(styleContent, fixed);
      }
      // Both light = contrast violation → force dark
      if (!elBgIsDark && !elColorIsDark && luminance(colorInfo.rgb) > 0.6) {
        const fixed = styleContent.replace(
          new RegExp(`color\\s*:\\s*${escapeRegExp(colorInfo.raw)}`),
          "color:#1a1a2e"
        );
        return fullMatch.replace(styleContent, fixed);
      }

      return fullMatch;
    }
  );

  return result;
}

/**
 * Sanitize AI-generated slide HTML.
 * Allows all CSS, style blocks, images, SVG — strips scripts and event handlers.
 */
export function sanitizeSlideHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["style", "svg", "path", "circle", "rect", "line", "polyline",
               "polygon", "ellipse", "g", "defs", "linearGradient", "radialGradient",
               "stop", "clipPath", "mask", "use", "text", "tspan", "image",
               "foreignObject", "pattern", "symbol",
               "filter", "feGaussianBlur", "feTurbulence", "feBlend", "feComposite",
               "feColorMatrix", "feMorphology", "feOffset", "feFlood",
               "feMerge", "feMergeNode"],
    ADD_ATTR: ["data-field", "data-slide-id", "viewBox", "xmlns", "fill",
               "stroke", "stroke-width", "d", "cx", "cy", "r", "rx", "ry",
               "x", "y", "x1", "y1", "x2", "y2", "width", "height",
               "transform", "opacity", "offset", "stop-color", "stop-opacity",
               "gradientUnits", "gradientTransform", "clip-path", "mask",
               "font-family", "font-size", "font-weight", "text-anchor",
               "dominant-baseline", "letter-spacing", "points", "preserveAspectRatio",
               "stdDeviation", "in", "in2", "result", "baseFrequency",
               "numOctaves", "mode", "flood-color", "flood-opacity",
               "patternUnits", "patternTransform"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input",
                  "textarea", "select", "button", "link", "meta", "base"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "onmouseout",
                  "onfocus", "onblur", "onchange", "onsubmit", "onkeydown",
                  "onkeyup", "onkeypress"],
    ALLOW_DATA_ATTR: true,
    WHOLE_DOCUMENT: false,
  });
}

/**
 * Extract Google Font URLs from slide HTML for preloading.
 */
export function extractGoogleFontUrls(html: string): string[] {
  const urls: string[] = [];
  const importRegex = /@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com\/[^'")\s]+)['"]?\)/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}
