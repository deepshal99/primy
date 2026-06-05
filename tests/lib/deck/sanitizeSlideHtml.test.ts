import { describe, it, expect } from "vitest";
import {
  stripContinuationBackslashes,
  enforceSlideContrast,
} from "@/components/deck/sanitizeSlideHtml";

describe("stripContinuationBackslashes", () => {
  it("removes a backslash that ends a line (the observed `</h1>\\` artifact)", () => {
    const input = '<div style="color:#fff">\\\n  <h1>Verification Engine</h1>\\\n</div>';
    const out = stripContinuationBackslashes(input);
    expect(out).not.toMatch(/\\\s*\n/);
    expect(out).toContain("Verification Engine");
  });

  it("preserves CSS escapes (backslash + hex, not a line end)", () => {
    const css = '<style>.x::before{content:"\\2014"}</style>';
    expect(stripContinuationBackslashes(css)).toBe(css);
  });

  it("strips a trailing-whitespace continuation too", () => {
    expect(stripContinuationBackslashes("a\\   \nb")).toBe("a   \nb");
  });
});

describe("enforceSlideContrast", () => {
  it("strips continuation backslashes as part of the pass", () => {
    const html = '<div style="background:#0e1626;color:#f0f0f5">\\\n<p>Hi</p></div>';
    expect(enforceSlideContrast(html)).not.toMatch(/\\\s*\n/);
  });

  it("resolves a gradient background and fixes dark-on-dark --text", () => {
    const html =
      '<div style="background:linear-gradient(135deg,#27385C,#0e1626)"><style>:root{--bg:#27385C;--text:#221f1a}</style><p style="color:var(--text)">x</p></div>';
    const out = enforceSlideContrast(html);
    // dark text var on a dark gradient bg → rewritten to a light readable value
    expect(out).toMatch(/--text:#f0f0f5/);
  });

  it("fixes hard-coded near-black inline text on a dark gradient slide", () => {
    const html =
      '<div style="background:linear-gradient(135deg,#27385C,#0e1626)"><p style="color:#221f1a">Supervisor Validation</p></div>';
    const out = enforceSlideContrast(html);
    expect(out).not.toContain("color:#221f1a");
    expect(out).toContain("color:#f0f0f5");
  });

  it("leaves a slide alone when text already contrasts", () => {
    const html = '<div style="background:#0e1626"><p style="color:#ffffff">readable</p></div>';
    expect(enforceSlideContrast(html)).toContain("color:#ffffff");
  });
});
