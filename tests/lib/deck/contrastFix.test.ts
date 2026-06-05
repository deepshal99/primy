import { describe, it, expect } from "vitest";
import {
  parseRenderedColor,
  colorFromGradient,
  composite,
  relLuminance,
  contrastRatio,
  readableInk,
  type Rgba,
} from "@/components/deck/contrastFix";

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

describe("parseRenderedColor", () => {
  it("parses rgb/rgba/hex and transparent", () => {
    expect(parseRenderedColor("rgb(34, 31, 26)")).toEqual({ r: 34, g: 31, b: 26, a: 1 });
    expect(parseRenderedColor("rgba(255, 252, 245, 0.055)")).toEqual({ r: 255, g: 252, b: 245, a: 0.055 });
    expect(parseRenderedColor("#1A1815")).toEqual({ r: 26, g: 24, b: 21, a: 1 });
    expect(parseRenderedColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseRenderedColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseRenderedColor("teal")).toBeNull();
  });
});

describe("colorFromGradient", () => {
  it("extracts the first color stop from a gradient", () => {
    expect(colorFromGradient("linear-gradient(135deg, #27385C 0%, #0e1626 100%)")).toEqual({
      r: 39, g: 56, b: 92, a: 1,
    });
    expect(colorFromGradient("none")).toBeNull();
  });
});

describe("contrast math", () => {
  it("black/white is the maximal 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 0);
  });

  it("flags the real failing case (near-black on dark navy ≈ 1.28)", () => {
    const text = { r: 34, g: 31, b: 26, a: 1 };
    const bg = { r: 39, g: 56, b: 92, a: 1 }; // #27385C
    expect(contrastRatio(text, bg)).toBeLessThan(2);
  });

  it("luminance orders dark < light", () => {
    expect(relLuminance(BLACK)).toBeLessThan(relLuminance(WHITE));
  });
});

describe("composite", () => {
  it("a ghost (alpha 0.055) over dark stays near the background", () => {
    const ghost = { r: 255, g: 252, b: 245, a: 0.055 };
    const bg = { r: 39, g: 56, b: 92, a: 1 };
    const out = composite(ghost, bg);
    // barely lifted off the background → unreadable, which the fixer treats as ghost
    expect(contrastRatio(out, bg)).toBeLessThan(1.3);
  });
});

describe("readableInk", () => {
  it("picks light ink on a dark background and dark ink on a light one", () => {
    const darkBg = { r: 39, g: 56, b: 92, a: 1 };
    const lightBg = { r: 252, g: 251, b: 248, a: 1 };
    expect(relLuminance(readableInk(darkBg))).toBeGreaterThan(0.5);
    expect(relLuminance(readableInk(lightBg))).toBeLessThan(0.1);
  });
});
