import DOMPurify from "dompurify";

/**
 * Sanitize AI-generated slide HTML.
 * Allows all CSS, style blocks, images, SVG — strips scripts and event handlers.
 */
export function sanitizeSlideHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["style", "svg", "path", "circle", "rect", "line", "polyline",
               "polygon", "ellipse", "g", "defs", "linearGradient", "radialGradient",
               "stop", "clipPath", "mask", "use", "text", "tspan", "image",
               "foreignObject", "pattern", "symbol"],
    ADD_ATTR: ["data-field", "data-slide-id", "viewBox", "xmlns", "fill",
               "stroke", "stroke-width", "d", "cx", "cy", "r", "rx", "ry",
               "x", "y", "x1", "y1", "x2", "y2", "width", "height",
               "transform", "opacity", "offset", "stop-color", "stop-opacity",
               "gradientUnits", "gradientTransform", "clip-path", "mask",
               "font-family", "font-size", "font-weight", "text-anchor",
               "dominant-baseline", "letter-spacing", "points", "preserveAspectRatio"],
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
