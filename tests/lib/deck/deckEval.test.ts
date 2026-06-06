import { describe, it, expect } from "vitest";
import {
  STRESS_DECK_MIN,
  STRESS_DECK_MAX,
  evaluateDeckDsl,
  checkSlide,
} from "@/lib/deck/deckEval";
import { DSL_CORE_LAYOUTS } from "@/lib/deck/dslToHtml";

describe("deck-eval static harness", () => {
  it("every layout passes structural checks at MINIMUM content", () => {
    const report = evaluateDeckDsl(STRESS_DECK_MIN);
    const failures = report.slides.filter((s) => !s.pass);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
    expect(report.passed).toBe(report.total);
  });

  it("every layout passes structural checks at MAXIMUM content", () => {
    const report = evaluateDeckDsl(STRESS_DECK_MAX);
    const failures = report.slides.filter((s) => !s.pass);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
    expect(report.passed).toBe(report.total);
  });

  it("covers all 10 core layouts in the stress deck", () => {
    const report = evaluateDeckDsl(STRESS_DECK_MAX);
    const seen = new Set(report.slides.map((s) => s.layout));
    for (const layout of DSL_CORE_LAYOUTS) {
      expect(seen.has(layout), `stress deck missing layout: ${layout}`).toBe(true);
    }
  });

  it("content slides get a footer; focal slides (title/section/quote/statement) do not", () => {
    const report = evaluateDeckDsl(STRESS_DECK_MAX);
    const byLayout = Object.fromEntries(report.slides.map((s) => [s.layout, s]));
    // focal layouts pass means: no footer present (checkSlide flags it otherwise)
    for (const focal of ["title", "section", "quote", "statement"] as const) {
      expect(byLayout[focal]?.pass).toBe(true);
    }
  });

  it("flags a genuinely broken slide (blank / missing tokens / leaked backslash)", () => {
    const blank = checkSlide("<div></div>", "bullets", 1);
    expect(blank.pass).toBe(false);
    expect(blank.issues.some((i) => i.startsWith("blank"))).toBe(true);

    const leaked = checkSlide(
      `<div class="slide" style="--bg:#000;--text:#fff;--accent:#0f0;width:960px;height:540px;overflow:hidden"><h2>Title</h2>x\\\n<div class="slide-footer"></div></div>`,
      "bullets",
      2,
    );
    expect(leaked.issues).toContain("leaked line-continuation backslash");
  });
});
