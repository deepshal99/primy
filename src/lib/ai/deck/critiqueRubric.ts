/**
 * Vision-critique rubric + scoring — PURE logic only (no AI SDK imports).
 *
 * The render→critique→repair loop renders each slide to a PNG, shows it to a
 * vision model, and gets back a {@link SlideVerdict}. This module owns the
 * contract: the rubric prompt, the structured-output JSON schema, and the
 * deterministic decisions (which slides fail, which repaired version wins).
 *
 * Kept free of `ai`/provider imports so it unit-tests without API keys or
 * network. The impure orchestration lives in `refineDeck.ts`.
 *
 *   verdict.score (0-100) ─┐
 *                          ├─► needsRepair() ─► repair round ─► re-critique
 *   verdict.issues[crit] ──┘                                        │
 *                                                                   ▼
 *                              pickBestVersion()  ◄── all scored versions
 */
import type { JSONSchema7 } from "json-schema";
import { buildCritiqueRubric } from "./lenses";

export type IssueSeverity = "critical" | "major" | "minor";

export type IssueCategory =
  | "contrast"
  | "overflow"
  | "hierarchy"
  | "balance"
  | "readability"
  | "spacing"
  | "brand"
  | "accessibility"
  | "neatness"
  | "creativity"
  | "prompt"
  | "other";

/** Every valid issue category — single source of truth for the schema + validator. */
export const ISSUE_CATEGORIES: IssueCategory[] = [
  "contrast",
  "overflow",
  "hierarchy",
  "balance",
  "readability",
  "spacing",
  "brand",
  "accessibility",
  "neatness",
  "creativity",
  "prompt",
  "other",
];

export interface CritiqueIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  /** What is wrong, grounded in the rendered image. */
  detail: string;
  /** Concrete, actionable fix the repair step can apply. */
  fix: string;
}

export interface SlideVerdict {
  /** 0–100 overall design quality of the RENDERED slide. */
  score: number;
  issues: CritiqueIssue[];
}

/** Below this score (or any critical issue) a slide is sent for repair. */
export const PASS_THRESHOLD = 78;

/**
 * The default (image-only) critique rubric, composed from the lens registry
 * (see `lenses.ts`). Callers with a brief/brand should prefer
 * {@link buildCritiqueRubric} so the prompt-adherence and brand-adherence lenses
 * activate. Kept as a constant for back-compat and the no-context path.
 */
export const CRITIQUE_RUBRIC = buildCritiqueRubric();

/** JSON schema (AI-SDK `jsonSchema()` compatible) for a {@link SlideVerdict}. */
export const VERDICT_JSON_SCHEMA: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["score", "issues"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "category", "detail", "fix"],
        properties: {
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          category: {
            type: "string",
            enum: ISSUE_CATEGORIES,
          },
          detail: { type: "string" },
          fix: { type: "string" },
        },
      },
    },
  },
};

/**
 * Coerce arbitrary model output into a valid {@link SlideVerdict}. Tolerates
 * missing/garbage fields so a flaky critique never crashes the loop. An
 * unparseable verdict is treated as a PASS (score 100, no issues) — we never
 * "repair" a slide on the basis of noise.
 */
export function normalizeVerdict(raw: unknown): SlideVerdict {
  if (!raw || typeof raw !== "object") return { score: 100, issues: [] };
  const obj = raw as Record<string, unknown>;

  let score = typeof obj.score === "number" && Number.isFinite(obj.score) ? obj.score : 100;
  score = Math.max(0, Math.min(100, score));

  const validSeverity: IssueSeverity[] = ["critical", "major", "minor"];
  const validCategory: IssueCategory[] = ISSUE_CATEGORIES;

  const issues: CritiqueIssue[] = Array.isArray(obj.issues)
    ? obj.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({
          severity: validSeverity.includes(i.severity as IssueSeverity)
            ? (i.severity as IssueSeverity)
            : "minor",
          category: validCategory.includes(i.category as IssueCategory)
            ? (i.category as IssueCategory)
            : "other",
          detail: typeof i.detail === "string" ? i.detail : "",
          fix: typeof i.fix === "string" ? i.fix : "",
        }))
    : [];

  return { score, issues };
}

/** True when a slide has at least one critical issue. */
export function hasCriticalIssue(verdict: SlideVerdict): boolean {
  return verdict.issues.some((i) => i.severity === "critical");
}

/**
 * Should this slide be repaired? Yes when it scores below threshold OR has any
 * critical (unusable-as-shown) issue regardless of score.
 */
export function needsRepair(verdict: SlideVerdict, threshold = PASS_THRESHOLD): boolean {
  return verdict.score < threshold || hasCriticalIssue(verdict);
}

export interface ScoredVersion {
  html: string;
  verdict: SlideVerdict;
}

/**
 * Pick the best version of a slide across repair rounds. Highest score wins;
 * ties broken by fewest critical issues, then fewest total issues, then the
 * EARLIEST version (don't churn HTML for no measurable gain).
 */
export function pickBestVersion(versions: ScoredVersion[]): ScoredVersion {
  if (versions.length === 0) throw new Error("pickBestVersion: no versions provided");
  return versions.reduce((best, cur) => {
    if (cur.verdict.score !== best.verdict.score) {
      return cur.verdict.score > best.verdict.score ? cur : best;
    }
    const curCrit = cur.verdict.issues.filter((i) => i.severity === "critical").length;
    const bestCrit = best.verdict.issues.filter((i) => i.severity === "critical").length;
    if (curCrit !== bestCrit) return curCrit < bestCrit ? cur : best;
    if (cur.verdict.issues.length !== best.verdict.issues.length) {
      return cur.verdict.issues.length < best.verdict.issues.length ? cur : best;
    }
    return best; // equal ⇒ keep earliest (already `best`)
  });
}

/**
 * Extract a single slide's HTML from a repair model's reply. The model may
 * wrap it in a ```html fence, add prose, or return it raw. We strip fences and
 * keep the outermost `<div …>…</div>`. Returns null when no slide markup is
 * found (caller keeps the original). Exported for unit testing.
 */
export function extractSlideHtml(reply: string): string | null {
  if (typeof reply !== "string") return null;

  // Drop a leading ```html / ``` fence and its closing fence if present.
  let text = reply.trim();
  const fence = text.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence) text = fence[1].trim();

  const first = text.indexOf("<div");
  const last = text.lastIndexOf("</div>");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + "</div>".length).trim();
}

/** Render the issue list into a compact instruction block for the repair model. */
export function formatIssuesForRepair(verdict: SlideVerdict): string {
  if (verdict.issues.length === 0) return "";
  return verdict.issues
    .map((i, n) => `${n + 1}. [${i.severity}/${i.category}] ${i.detail} → FIX: ${i.fix}`)
    .join("\n");
}
