/**
 * Deck critique LENSES — modular, per-dimension quality checks ("skills").
 *
 * The critic used to be one hardcoded block that judged the image ONLY ("not
 * intent") — so it could never check whether a slide matched the BRIEF or the
 * BRAND, because it never saw them. This splits the rubric into named lenses,
 * each declaring what INPUTS it needs:
 *
 *   - "image"  → judged from the rendered screenshot alone (always available)
 *   - "brand"  → also needs the brand/style hint
 *   - "brief"  → also needs what the user asked the deck to be about
 *
 * `buildCritiqueRubric()` composes only the lenses whose inputs are present, and
 * normalizes their weights to sum to 100 over the ACTIVE set — so a critique with
 * no brand context simply drops the brand lens and reweights the rest, rather
 * than judging against a dimension it can't see.
 *
 * Each lens body is deliberately concrete and demanding (failure-grounded), the
 * same voice as the original rubric. Lenses are plain data so they unit-test and
 * can graduate to standalone `.md` files later without changing the pipeline.
 */
import type { IssueCategory } from "./critiqueRubric";

export type LensInput = "image" | "brand" | "brief";

export interface Lens {
  id: string;
  /** Human title shown in the composed rubric. */
  title: string;
  /** Issue category the model should tag findings from this lens with. */
  category: IssueCategory;
  /** Relative importance; normalized to 100 across the active set. */
  weight: number;
  /** Extra inputs (beyond the image) this lens needs to be meaningful. */
  inputs: LensInput[];
  /** The concrete judging instruction. */
  body: string;
}

export const LENSES: Lens[] = [
  {
    id: "readability",
    title: "Readability & contrast",
    category: "readability",
    weight: 24,
    inputs: ["image"],
    body: "Is every text element clearly legible against its actual background? Flag any text that is low-contrast, washed out, sitting on a busy area, or invisible (same-on-same color). Body text must be comfortably readable, not just technically present.",
  },
  {
    id: "accessibility",
    title: "Accessibility",
    category: "accessibility",
    weight: 8,
    inputs: ["image"],
    body: "Would this pass a basic accessibility bar? Flag text that is too small to read at presentation distance (body copy that looks under ~16px), insufficient color contrast for the text size, or meaning carried by color alone.",
  },
  {
    id: "overflow",
    title: "Layout & overflow",
    category: "overflow",
    weight: 20,
    inputs: ["image"],
    body: "Does all content fit inside the 960×540 frame with comfortable margins? Flag anything clipped, cut off at an edge, overlapping, colliding, or crammed against the border. Charts and images must sit fully inside the frame.",
  },
  {
    id: "hierarchy",
    title: "Visual hierarchy",
    category: "hierarchy",
    weight: 16,
    inputs: ["image"],
    body: "Is there one clear focal point and a sensible reading order? Flag competing emphasis, a flat hierarchy, a title that doesn't lead, or body text that out-weighs the headline.",
  },
  {
    id: "balance",
    title: "Balance & composition",
    category: "balance",
    weight: 11,
    inputs: ["image"],
    body: "Is whitespace distributed well and is the slide composed, not lopsided? Flag large dead zones (e.g. a bottom half left empty), weight piled on one side, or elements floating without alignment to a grid.",
  },
  {
    id: "neatness",
    title: "Neatness & alignment",
    category: "neatness",
    weight: 8,
    inputs: ["image"],
    body: "Is it tidy and precisely aligned? Flag misaligned edges, inconsistent gaps/margins between sibling elements, ragged card heights, stray characters or punctuation, and uneven padding.",
  },
  {
    id: "creativity",
    title: "Creativity & distinctiveness",
    category: "creativity",
    weight: 8,
    inputs: ["image"],
    body: "Does it look intentionally designed and premium, or generic/template-y? Reward a distinctive, considered visual idea (a motif, a confident type treatment, a real composition). Flag default-looking, AI-slop layouts a viewer has seen a thousand times.",
  },
  {
    id: "brand-adherence",
    title: "Brand adherence",
    category: "brand",
    weight: 5,
    inputs: ["image", "brand"],
    body: "Does the slide honor the intended brand/style below? Flag colors, fonts, or tone that fight the brand, an accent used inconsistently, or styling that ignores the requested look. INTENDED BRAND/STYLE: {{brand}}",
  },
  {
    id: "prompt-adherence",
    title: "Prompt adherence",
    category: "prompt",
    weight: 12,
    inputs: ["image", "brief"],
    body: "Does this slide actually deliver what the deck was asked to be about? Flag off-topic content, a slide that ignores the subject, placeholder/lorem text, or fabricated specifics that drift from the brief. DECK BRIEF: {{brief}}",
  },
];

export interface RubricContext {
  /** What the user asked the deck to be about (enables prompt-adherence). */
  brief?: string;
  /** Brand/style hint (enables brand-adherence). */
  brand?: string;
}

/** Inputs available given the supplied context. */
function availableInputs(ctx: RubricContext): Set<LensInput> {
  const set = new Set<LensInput>(["image"]);
  if (ctx.brand && ctx.brand.trim()) set.add("brand");
  if (ctx.brief && ctx.brief.trim()) set.add("brief");
  return set;
}

/** The lenses that are active given the available inputs. */
export function activeLenses(ctx: RubricContext): Lens[] {
  const have = availableInputs(ctx);
  return LENSES.filter((l) => l.inputs.every((i) => have.has(i)));
}

/** Fill {{brand}} / {{brief}} placeholders in a lens body. */
function renderBody(body: string, ctx: RubricContext): string {
  return body
    .replace("{{brand}}", (ctx.brand || "").trim())
    .replace("{{brief}}", (ctx.brief || "").trim());
}

const RUBRIC_HEADER = `You are a world-class presentation design critic. You are shown a SCREENSHOT of a single rendered 960×540 slide. Judge what is visible in the image (plus the brief/brand context provided), not the HTML source.

Score the slide 0–100 on these weighted dimensions:`;

const RUBRIC_FOOTER = `Severity guidance:
- critical = makes the slide unusable as shown (unreadable text, clipped headline, broken layout, off-brief content).
- major = clearly hurts quality but the slide is still usable (weak hierarchy, cramped spacing, off-brand accent).
- minor = polish nitpick.

For each issue, tag it with the matching category and give a specific, actionable fix (e.g. "change the subtitle color from #221f1a to #f0f0f5; it is near-black on a dark slide"). If the slide is excellent, return an empty issues array and a high score. Be honest and demanding — most AI-generated slides have at least one real problem.`;

/**
 * Compose the critique rubric from the lenses whose inputs are satisfied by
 * `ctx`. Weights are normalized to sum to 100 over the active set, so dropping
 * the brand/prompt lens reweights the rest instead of judging blind.
 */
export function buildCritiqueRubric(ctx: RubricContext = {}): string {
  const active = activeLenses(ctx);
  const total = active.reduce((s, l) => s + l.weight, 0) || 1;
  const lines = active.map((l) => {
    const pct = Math.round((l.weight / total) * 100);
    return `- ${l.title} (${pct}) [tag: ${l.category}]: ${renderBody(l.body, ctx)}`;
  });
  return `${RUBRIC_HEADER}\n${lines.join("\n")}\n\n${RUBRIC_FOOTER}`;
}
