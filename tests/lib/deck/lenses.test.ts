import { describe, it, expect } from "vitest";
import { buildCritiqueRubric, activeLenses, LENSES } from "@/lib/ai/deck/lenses";
import { CRITIQUE_RUBRIC, ISSUE_CATEGORIES, normalizeVerdict } from "@/lib/ai/deck/critiqueRubric";

describe("activeLenses", () => {
  it("image-only by default — no brand/prompt lens without their inputs", () => {
    const ids = activeLenses({}).map((l) => l.id);
    expect(ids).toContain("readability");
    expect(ids).toContain("overflow");
    expect(ids).not.toContain("brand-adherence");
    expect(ids).not.toContain("prompt-adherence");
  });

  it("activates brand-adherence only with brand", () => {
    const ids = activeLenses({ brand: "Acme, accent #4285F4" }).map((l) => l.id);
    expect(ids).toContain("brand-adherence");
    expect(ids).not.toContain("prompt-adherence");
  });

  it("activates prompt-adherence only with brief", () => {
    const ids = activeLenses({ brief: "Verification Engine" }).map((l) => l.id);
    expect(ids).toContain("prompt-adherence");
    expect(ids).not.toContain("brand-adherence");
  });

  it("blank strings do not activate intent lenses", () => {
    const ids = activeLenses({ brand: "   ", brief: "" }).map((l) => l.id);
    expect(ids).not.toContain("brand-adherence");
    expect(ids).not.toContain("prompt-adherence");
  });
});

describe("buildCritiqueRubric", () => {
  it("injects the brief/brand text and leaves no placeholders", () => {
    const r = buildCritiqueRubric({ brief: "PsycHIRE Verification Engine", brand: "navy + blue accent" });
    expect(r).toContain("PsycHIRE Verification Engine");
    expect(r).toContain("navy + blue accent");
    expect(r).not.toContain("{{brief}}");
    expect(r).not.toContain("{{brand}}");
    expect(r).toContain("Prompt adherence");
    expect(r).toContain("Brand adherence");
  });

  it("normalizes displayed weights to ~100 over the active set", () => {
    const r = buildCritiqueRubric({});
    const pcts = [...r.matchAll(/\((\d+)\) \[tag:/g)].map((m) => Number(m[1]));
    const sum = pcts.reduce((a, b) => a + b, 0);
    expect(pcts.length).toBe(activeLenses({}).length);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2); // rounding slack
  });

  it("CRITIQUE_RUBRIC equals the no-context build (back-compat)", () => {
    expect(CRITIQUE_RUBRIC).toBe(buildCritiqueRubric());
  });
});

describe("category coverage", () => {
  it("every lens category is a valid issue category", () => {
    for (const lens of LENSES) {
      expect(ISSUE_CATEGORIES).toContain(lens.category);
    }
  });

  it("normalizeVerdict keeps the new categories (prompt/accessibility) and floors junk to 'other'", () => {
    const v = normalizeVerdict({
      score: 70,
      issues: [
        { severity: "major", category: "prompt", detail: "off topic", fix: "make it about X" },
        { severity: "minor", category: "accessibility", detail: "tiny text", fix: "bump size" },
        { severity: "critical", category: "bogus", detail: "x", fix: "y" },
      ],
    });
    expect(v.issues[0].category).toBe("prompt");
    expect(v.issues[1].category).toBe("accessibility");
    expect(v.issues[2].category).toBe("other");
  });
});
