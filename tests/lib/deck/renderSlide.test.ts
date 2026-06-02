/**
 * buildSlideDocument — wraps a slide's inner HTML into a self-contained
 * 960×540 document for screenshotting. (The Puppeteer path is integration-only.)
 */
import { describe, expect, test } from "vitest";
import { buildSlideDocument, SLIDE_W, SLIDE_H } from "@/lib/deck/renderSlide";

describe("buildSlideDocument", () => {
  test("embeds the slide html verbatim inside the body", () => {
    const slide = "<div id='slide-1' style='width:960px'>Hello</div>";
    const doc = buildSlideDocument(slide);
    expect(doc).toContain(slide);
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<body>");
  });

  test("locks the canvas to the slide dimensions", () => {
    const doc = buildSlideDocument("<div></div>");
    expect(doc).toContain(`width:${SLIDE_W}px`);
    expect(doc).toContain(`height:${SLIDE_H}px`);
    expect(SLIDE_W).toBe(960);
    expect(SLIDE_H).toBe(540);
  });

  test("applies a box-sizing/margin reset so the clip lines up", () => {
    const doc = buildSlideDocument("<div></div>");
    expect(doc).toContain("box-sizing:border-box");
    expect(doc).toContain("overflow:hidden");
  });
});
