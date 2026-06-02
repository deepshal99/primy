/**
 * Pure critique-rubric logic: verdict normalization, repair gating, best-version
 * selection, and repair-output HTML extraction. No AI/network involved.
 */
import { describe, expect, test } from "vitest";
import {
  normalizeVerdict,
  hasCriticalIssue,
  needsRepair,
  pickBestVersion,
  extractSlideHtml,
  formatIssuesForRepair,
  PASS_THRESHOLD,
  type SlideVerdict,
  type ScoredVersion,
} from "@/lib/ai/deck/critiqueRubric";

const verdict = (score: number, issues: SlideVerdict["issues"] = []): SlideVerdict => ({ score, issues });
const issue = (severity: "critical" | "major" | "minor"): SlideVerdict["issues"][number] => ({
  severity,
  category: "contrast",
  detail: "d",
  fix: "f",
});

describe("normalizeVerdict", () => {
  test("treats null/garbage as a clean pass (never repair on noise)", () => {
    expect(normalizeVerdict(null)).toEqual({ score: 100, issues: [] });
    expect(normalizeVerdict("nope")).toEqual({ score: 100, issues: [] });
    expect(normalizeVerdict(42)).toEqual({ score: 100, issues: [] });
  });

  test("clamps score into 0–100", () => {
    expect(normalizeVerdict({ score: 150, issues: [] }).score).toBe(100);
    expect(normalizeVerdict({ score: -10, issues: [] }).score).toBe(0);
    expect(normalizeVerdict({ score: 73, issues: [] }).score).toBe(73);
  });

  test("defaults a non-numeric score to 100", () => {
    expect(normalizeVerdict({ score: "bad", issues: [] }).score).toBe(100);
    expect(normalizeVerdict({ issues: [] }).score).toBe(100);
  });

  test("coerces invalid severity/category to safe defaults and drops junk issues", () => {
    const v = normalizeVerdict({
      score: 50,
      issues: [
        { severity: "explosive", category: "vibes", detail: "x", fix: "y" },
        null,
        "string",
        { severity: "critical", category: "overflow", detail: "clip", fix: "shrink" },
      ],
    });
    expect(v.issues).toHaveLength(2);
    expect(v.issues[0]).toEqual({ severity: "minor", category: "other", detail: "x", fix: "y" });
    expect(v.issues[1].severity).toBe("critical");
    expect(v.issues[1].category).toBe("overflow");
  });

  test("non-array issues become an empty list", () => {
    expect(normalizeVerdict({ score: 80, issues: "lots" }).issues).toEqual([]);
  });
});

describe("needsRepair / hasCriticalIssue", () => {
  test("below-threshold score needs repair", () => {
    expect(needsRepair(verdict(PASS_THRESHOLD - 1))).toBe(true);
    expect(needsRepair(verdict(PASS_THRESHOLD))).toBe(false);
    expect(needsRepair(verdict(95))).toBe(false);
  });

  test("a critical issue forces repair even with a high score", () => {
    const v = verdict(99, [issue("critical")]);
    expect(hasCriticalIssue(v)).toBe(true);
    expect(needsRepair(v)).toBe(true);
  });

  test("major/minor issues alone do not force repair when score passes", () => {
    expect(needsRepair(verdict(90, [issue("major"), issue("minor")]))).toBe(false);
  });

  test("respects a custom threshold", () => {
    expect(needsRepair(verdict(85), 90)).toBe(true);
    expect(needsRepair(verdict(85), 80)).toBe(false);
  });
});

describe("pickBestVersion", () => {
  const v = (html: string, score: number, issues: SlideVerdict["issues"] = []): ScoredVersion => ({
    html,
    verdict: verdict(score, issues),
  });

  test("throws on empty input", () => {
    expect(() => pickBestVersion([])).toThrow();
  });

  test("returns the only version", () => {
    expect(pickBestVersion([v("a", 60)]).html).toBe("a");
  });

  test("highest score wins", () => {
    expect(pickBestVersion([v("a", 60), v("b", 88), v("c", 70)]).html).toBe("b");
  });

  test("score tie broken by fewest critical issues", () => {
    const best = pickBestVersion([
      v("a", 80, [issue("critical"), issue("critical")]),
      v("b", 80, [issue("critical")]),
    ]);
    expect(best.html).toBe("b");
  });

  test("score+critical tie broken by fewest total issues", () => {
    const best = pickBestVersion([
      v("a", 80, [issue("minor"), issue("minor")]),
      v("b", 80, [issue("minor")]),
    ]);
    expect(best.html).toBe("b");
  });

  test("full tie keeps the earliest version (no churn)", () => {
    const best = pickBestVersion([v("original", 80), v("rewrite", 80)]);
    expect(best.html).toBe("original");
  });
});

describe("extractSlideHtml", () => {
  test("pulls HTML out of a ```html fence", () => {
    const reply = "Sure!\n```html\n<div id='slide-1'>hi</div>\n```\nDone.";
    expect(extractSlideHtml(reply)).toBe("<div id='slide-1'>hi</div>");
  });

  test("handles a bare ``` fence with no language", () => {
    expect(extractSlideHtml("```\n<div>x</div>\n```")).toBe("<div>x</div>");
  });

  test("extracts a raw div with surrounding prose", () => {
    expect(extractSlideHtml("Here you go: <div id='s'>y</div> hope that helps")).toBe(
      "<div id='s'>y</div>"
    );
  });

  test("keeps the OUTERMOST div for nested markup", () => {
    const html = "<div id='root'><div class='inner'>z</div></div>";
    expect(extractSlideHtml(`prefix ${html} suffix`)).toBe(html);
  });

  test("returns null when there's no slide markup", () => {
    expect(extractSlideHtml("I couldn't fix it, sorry.")).toBeNull();
    expect(extractSlideHtml("<span>not a div</span>")).toBeNull();
    expect(extractSlideHtml("")).toBeNull();
  });
});

describe("formatIssuesForRepair", () => {
  test("empty issues → empty string", () => {
    expect(formatIssuesForRepair(verdict(100))).toBe("");
  });

  test("renders a numbered, severity-tagged list with fixes", () => {
    const out = formatIssuesForRepair(
      verdict(40, [
        { severity: "critical", category: "contrast", detail: "title invisible", fix: "use --text" },
      ])
    );
    expect(out).toContain("1.");
    expect(out).toContain("[critical/contrast]");
    expect(out).toContain("title invisible");
    expect(out).toContain("FIX: use --text");
  });
});
