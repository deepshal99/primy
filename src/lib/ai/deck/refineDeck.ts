/**
 * Render → vision-critique → repair loop (Slice V1 of the deck-100x plan).
 *
 * Takes finished HTML slides and lifts their quality by actually LOOKING at
 * each rendered slide and fixing what's broken — the thing single-shot
 * generation can't do because the model writes HTML blind.
 *
 *   slides ──► renderSlides() ──► [png per slide]
 *      │                              │
 *      │                              ▼
 *      │                      critiqueSlide() ──► verdict (score+issues)
 *      │                              │
 *      │                    needsRepair? ──no──► keep original
 *      │                              │yes
 *      │                              ▼
 *      └──────── repair ⟳ (≤maxRounds): repairSlide → render → critique
 *                                     │
 *                                     ▼
 *                          pickBestVersion() across all rounds
 *
 * Fail-open everywhere: a render miss, a flaky critique, or a worse repair can
 * never degrade a slide below what came in. The worst case is "no change".
 */
import { generateObject, generateText, jsonSchema } from "ai";
import { getModel, getModelConfig } from "@/lib/ai/modelRouter";
import { withRenderBrowser, type SlideInput } from "@/lib/deck/renderSlide";
import {
  CRITIQUE_RUBRIC,
  VERDICT_JSON_SCHEMA,
  normalizeVerdict,
  needsRepair,
  pickBestVersion,
  formatIssuesForRepair,
  extractSlideHtml,
  PASS_THRESHOLD,
  type SlideVerdict,
  type ScoredVersion,
} from "./critiqueRubric";

export interface RefineSlide {
  id: string;
  html: string;
}

export interface RefinedSlide {
  id: string;
  html: string;
  changed: boolean;
  scoreBefore: number;
  scoreAfter: number;
}

export interface RefineSummary {
  critiqued: number;
  repaired: number;
  skipped: number;
  avgBefore: number;
  avgAfter: number;
}

export interface RefineResult {
  slides: RefinedSlide[];
  summary: RefineSummary;
}

export type RefineProgress =
  | { stage: "render"; total: number }
  | { stage: "critique"; id: string; index: number; total: number; score: number }
  | { stage: "repair"; id: string; index: number; round: number }
  | { stage: "done"; summary: RefineSummary };

export interface RefineOptions {
  /** Short description of intended brand/theme, used for brand-fit judging. */
  brandContext?: string;
  /** Max repair rounds per slide. Default 2. */
  maxRounds?: number;
  /** Score below which a slide is repaired. Default {@link PASS_THRESHOLD}. */
  threshold?: number;
  onProgress?: (e: RefineProgress) => void;
}

const REPAIR_INSTRUCTIONS = `You are fixing ONE slide of a presentation. You are given the current slide HTML and a list of concrete design problems found by looking at the rendered slide. Apply the fixes precisely.

HARD RULES:
- Return ONLY the corrected slide HTML — one root <div id='slide-...' style='width:960px;height:540px;...'>…</div>. No commentary, no markdown fence.
- Keep the SAME root element, the SAME id, and EVERY existing data-field='…' attribute (these power inline editing — do not drop or rename them).
- Keep the slide's overall concept, copy, fonts, --accent, and color mode. Change ONLY what the issues call for.
- All content MUST fit within 960×540 with comfortable margins. If content overflows, reduce sizes/spacing or trim — never let it clip.
- Use single quotes for all HTML attributes (this HTML is embedded in JSON).`;

/**
 * Vision-critique a rendered slide PNG. Returns `null` when the critique
 * itself is unavailable (model error / misconfig) so the caller can SKIP the
 * slide rather than falsely treat it as a perfect pass — avoids a silent
 * "all looked great" when vision is broken.
 */
async function critiqueSlide(
  model: ReturnType<typeof getModel>,
  pngBase64: string,
  brandContext?: string
): Promise<SlideVerdict | null> {
  try {
    const text = brandContext
      ? `${CRITIQUE_RUBRIC}\n\nIntended brand / visual style for brand-fit judging: ${brandContext}`
      : CRITIQUE_RUBRIC;
    const { object } = await generateObject({
      model,
      schema: jsonSchema(VERDICT_JSON_SCHEMA),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text },
            // Pass RAW BYTES, not a `data:` URL string — the AI SDK treats a
            // string image as a URL to download (throws AI_DownloadError on
            // data URLs). A Buffer is sent inline, no download attempted.
            { type: "image", image: Buffer.from(pngBase64, "base64"), mediaType: "image/png" },
          ],
        },
      ],
    });
    return normalizeVerdict(object);
  } catch (err) {
    console.error("[deck-refine] critique failed:", err);
    return null;
  }
}

/** Ask the repair model to rewrite the slide HTML to fix the verdict's issues. */
async function repairSlide(
  slideHtml: string,
  verdict: SlideVerdict,
  brandContext?: string
): Promise<string | null> {
  const model = getModel("deck-edit");
  const maxOutputTokens = getModelConfig("deck-edit").maxOutputTokens;
  const prompt =
    `${REPAIR_INSTRUCTIONS}\n\n` +
    (brandContext ? `INTENDED BRAND/STYLE: ${brandContext}\n\n` : "") +
    `PROBLEMS TO FIX:\n${formatIssuesForRepair(verdict)}\n\n` +
    `CURRENT SLIDE HTML:\n${slideHtml}`;
  try {
    const { text } = await generateText({ model, prompt, maxOutputTokens });
    return extractSlideHtml(text);
  } catch {
    return null;
  }
}

/** Average a list of numbers, rounded; 0 for an empty list. */
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Run the full render→critique→repair loop over a deck's HTML slides.
 *
 * Slides without HTML, or whose render fails, are passed through untouched
 * (counted as "skipped"). The returned slides preserve input order.
 */
export async function refineDeck(
  slides: RefineSlide[],
  opts: RefineOptions = {}
): Promise<RefineResult> {
  const maxRounds = opts.maxRounds ?? 2;
  const threshold = opts.threshold ?? PASS_THRESHOLD;
  const brandContext = opts.brandContext;

  const renderable = slides.filter((s) => typeof s.html === "string" && s.html.trim().length > 0);
  opts.onProgress?.({ stage: "render", total: renderable.length });

  // Nothing renderable → pass everything through untouched, don't boot Chromium.
  if (renderable.length === 0) {
    const out: RefinedSlide[] = slides.map((s) => ({
      id: s.id,
      html: s.html,
      changed: false,
      scoreBefore: 0,
      scoreAfter: 0,
    }));
    const summary: RefineSummary = {
      critiqued: 0,
      repaired: 0,
      skipped: slides.length,
      avgBefore: 0,
      avgAfter: 0,
    };
    opts.onProgress?.({ stage: "done", summary });
    return { slides: out, summary };
  }

  // One warm browser for the WHOLE run — the initial batch AND every per-slide
  // repair re-render. Paying the Chromium cold-start once, not per repair.
  const critiqueModel = getModel("deck-critique");

  return withRenderBrowser(async (render) => {
    const rendered = await render(renderable.map((s): SlideInput => ({ id: s.id, html: s.html })));
    const pngById = new Map(rendered.map((r) => [r.id, r.png]));

    const out: RefinedSlide[] = [];
    const before: number[] = [];
    const after: number[] = [];
    let repaired = 0;
    let skipped = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const png = pngById.get(slide.id);

      // Couldn't render (no html / render failure) → keep original, count skipped.
      if (!png) {
        out.push({ id: slide.id, html: slide.html, changed: false, scoreBefore: 0, scoreAfter: 0 });
        skipped++;
        continue;
      }

      const verdict0 = await critiqueSlide(critiqueModel, png, brandContext);

      // Critique unavailable (vision error/misconfig) → keep original, count as
      // skipped. Never report a broken critique as a flawless slide.
      if (!verdict0) {
        out.push({ id: slide.id, html: slide.html, changed: false, scoreBefore: 0, scoreAfter: 0 });
        skipped++;
        continue;
      }

      opts.onProgress?.({
        stage: "critique",
        id: slide.id,
        index: i,
        total: slides.length,
        score: verdict0.score,
      });
      before.push(verdict0.score);

      const versions: ScoredVersion[] = [{ html: slide.html, verdict: verdict0 }];

      let current = verdict0;
      let currentHtml = slide.html;
      let round = 0;
      while (needsRepair(current, threshold) && round < maxRounds) {
        round++;
        opts.onProgress?.({ stage: "repair", id: slide.id, index: i, round });

        const fixedHtml = await repairSlide(currentHtml, current, brandContext);
        if (!fixedHtml) break; // repair produced nothing usable → stop, keep best so far

        const [reRendered] = await render([{ id: slide.id, html: fixedHtml }]);
        if (!reRendered?.png) break; // can't verify the fix → don't trust it

        const verdict = await critiqueSlide(critiqueModel, reRendered.png, brandContext);
        if (!verdict) break; // can't score the fix → don't adopt an unverified change
        versions.push({ html: fixedHtml, verdict });
        current = verdict;
        currentHtml = fixedHtml;
      }

      const best = pickBestVersion(versions);
      const changed = best.html !== slide.html;
      if (changed) repaired++;
      after.push(best.verdict.score);
      out.push({
        id: slide.id,
        html: best.html,
        changed,
        scoreBefore: verdict0.score,
        scoreAfter: best.verdict.score,
      });
    }

    const summary: RefineSummary = {
      critiqued: before.length,
      repaired,
      skipped,
      avgBefore: avg(before),
      avgAfter: avg(after),
    };
    opts.onProgress?.({ stage: "done", summary });
    return { slides: out, summary };
  });
}
