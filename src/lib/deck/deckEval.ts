/**
 * Deck-eval — the measurable substrate that ends the "send me another broken
 * deck" loop.
 *
 * Quality stops being something a human eyeballs per deck and becomes a property
 * of the deterministic layout code, asserted by a fixed harness:
 *
 *   STRESS_DECK_{MIN,MAX}  →  dslToHtmlSlides  →  static validators (here)
 *                                              →  render checks (scripts/deck-eval)
 *
 * The STATIC validators in this module need no browser, so they run in vitest /
 * CI on every change: every layout must produce a non-empty, brand-tokened slide
 * with the right footer policy and no leaked artifacts, at BOTH minimum and
 * maximum content. The render-based overflow/contrast/vision scoring lives in
 * `scripts/deck-eval/run.ts` (needs Chromium).
 */
import { dslToHtmlSlides, parseDeckDsl, type DslLayout } from "./dslToHtml";
import { getThemeConfig } from "@/components/deck/deckThemes";
import type { HtmlDeckSlide } from "@/lib/types";

/** Long filler (full sentence) — for roomy slots: subtitles, columns, quotes. */
const LONG =
  "Adaptive, on-device intelligence that turns scattered inputs into a clear, measurable plan people actually follow.";
/** Medium filler (~1 line) — realistic ceiling for list items / cards. A deck
 *  that needs more than this per bullet should split the slide, not shrink. */
const MED = "Adaptive on-device plans people actually follow, privately.";

/** A deck that exercises every layout at its MAXIMUM realistic content. */
export const STRESS_DECK_MAX = `<deck title="Stress Deck" theme="pitch">
  <slide layout="title"><eyebrow>AI • COACHING • WELLNESS</eyebrow><h1>A long cover headline that wraps across two lines comfortably</h1><subtitle>${LONG}</subtitle></slide>
  <slide layout="section"><h1>A section divider with a reasonably long title</h1><subtitle>${LONG}</subtitle></slide>
  <slide layout="bullets"><h2>Bullets at maximum density for overflow testing</h2><bullet>${MED}</bullet><bullet>${MED}</bullet><bullet>${MED}</bullet><bullet>${MED}</bullet><bullet>${MED}</bullet></slide>
  <slide layout="stats"><h2>Key metrics that prove the thesis</h2><stat value="$15B" label="Connected fitness market (2026 est.)"/><stat value="40%" label="Open to AI coaching today"/><stat value="+28%" label="Avg session completion lift"/><stat value="38%" label="30-day retention in pilot"/></slide>
  <slide layout="twoColumn"><h2>Two-column comparison with long bodies</h2><column title="Today">${LONG}</column><column title="With CoachAI">${LONG}</column><column title="In a year">${LONG}</column></slide>
  <slide layout="quote"><quote>${LONG} ${LONG}</quote><cite>A. Patel, CEO</cite></slide>
  <slide layout="statement"><eyebrow>Vision</eyebrow><h1>${LONG}</h1><subtitle>${LONG}</subtitle></slide>
  <slide layout="featureGrid"><h2>Six features that adapt to you</h2><feature title="Adaptive plans">${MED}</feature><feature title="Real-time feedback">${MED}</feature><feature title="Habit nudges">${MED}</feature><feature title="Privacy-first">${MED}</feature><feature title="Sensor fusion">${MED}</feature><feature title="Behavioral nudges">${MED}</feature></slide>
  <slide layout="agenda"><h2>What we'll cover</h2><item>${MED}</item><item>${MED}</item><item>${MED}</item><item>${MED}</item><item>${MED}</item></slide>
  <slide layout="timeline"><h2>Five-step rollout</h2><step label="Onboard">${MED}</step><step label="Train">${MED}</step><step label="Improve">${MED}</step><step label="Scale">${MED}</step><step label="Expand">${MED}</step></slide>
  <slide layout="bigStat"><eyebrow>Traction</eyebrow><h2>Early signals from the pilot</h2><stat value="12k" label="Sign-ups in the private pilot"/><stat value="38%" label="30-day retention"/><stat value="+28%" label="Avg session completion"/></slide>
  <slide layout="team"><h2>Founders & advisors</h2><member name="A. Patel" role="CEO — ex-health app PM"/><member name="L. Chen" role="CTO — ML & wearable systems"/><member name="Dr. M. Reyes" role="Advisor — sports science"/><member name="J. Kim" role="Head of design"/></slide>
  <slide layout="chart"><h2>A growing, health-first market</h2><chart type="bar"><point label="2019" value="6" display="$6B"/><point label="2020" value="9" display="$9B"/><point label="2021" value="13" display="$13B"/><point label="2022" value="17" display="$17B"/><point label="2023" value="21" display="$21B"/><point label="2024" value="25" display="$25B"/></chart></slide>
  <slide layout="closing"><eyebrow>Ready to get started?</eyebrow><h1>Train smarter with CoachAI</h1><subtitle>${LONG}</subtitle><cta label="Request demo"/><cta label="View roadmap"/><contact>founders@coachai.com</contact></slide>
  <slide layout="imageFull"><image query="athlete training at dawn"/><eyebrow>The vision</eyebrow><h1>A coach in every pocket, for every body</h1><subtitle>${LONG}</subtitle></slide>
  <slide layout="splitImage"><image query="fitness app interface"/><h2>Built for real routines</h2><bullet>${MED}</bullet><bullet>${MED}</bullet><bullet>${MED}</bullet></slide>
</deck>`;

/** A deck that exercises every layout at its MINIMUM content (sparse). */
export const STRESS_DECK_MIN = `<deck title="Min Deck" theme="pitch">
  <slide layout="title"><h1>CoachAI</h1></slide>
  <slide layout="section"><h1>The Problem</h1></slide>
  <slide layout="bullets"><h2>Three reasons</h2><bullet>Fast</bullet><bullet>Private</bullet><bullet>Adaptive</bullet></slide>
  <slide layout="stats"><h2>Traction</h2><stat value="12k" label="Sign-ups"/><stat value="38%" label="Retention"/></slide>
  <slide layout="twoColumn"><h2>Before / after</h2><column title="Before">Manual</column><column title="After">Automated</column></slide>
  <slide layout="quote"><quote>It just works.</quote><cite>A pilot user</cite></slide>
  <slide layout="statement"><h1>Train smarter.</h1></slide>
  <slide layout="featureGrid"><h2>Features</h2><feature title="Plans">Adaptive</feature><feature title="Feedback">Real-time</feature></slide>
  <slide layout="agenda"><h2>Agenda</h2><item>Problem</item><item>Solution</item></slide>
  <slide layout="timeline"><h2>Steps</h2><step label="One">Setup</step><step label="Two">Train</step></slide>
  <slide layout="bigStat"><stat value="12k" label="Users in pilot"/></slide>
  <slide layout="team"><h2>Team</h2><member name="A. Patel" role="CEO"/><member name="L. Chen" role="CTO"/></slide>
  <slide layout="chart"><h2>Growth</h2><point label="2019" value="6"/><point label="2024" value="25"/></slide>
  <slide layout="closing"><h1>Thanks</h1><cta label="Get started"/></slide>
  <slide layout="imageFull"><h1>Train smarter</h1></slide>
  <slide layout="splitImage"><h2>How it works</h2><body>Adaptive sessions that learn from you.</body></slide>
</deck>`;

/** Layouts that must NOT carry a footer (full-bleed focal slides). */
const FOOTERLESS: ReadonlySet<DslLayout> = new Set([
  "title",
  "section",
  "quote",
  "statement",
  "bigStat",
  "closing",
  "imageFull",
  "splitImage",
]);

export interface SlideCheck {
  index: number;
  layout: DslLayout;
  pass: boolean;
  issues: string[];
}

export interface StaticEvalReport {
  total: number;
  passed: number;
  slides: SlideCheck[];
}

/** Strip the nested <style> block, then all tags, to get visible text only. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Run the no-browser structural checks over one rendered slide. */
export function checkSlide(html: string, layout: DslLayout, index: number): SlideCheck {
  const issues: string[] = [];

  // Non-empty: a slide must carry real visible content (kills blank slides).
  if (visibleText(html).length < 2) issues.push("blank: no visible text content");

  // Brand tokens present (kills per-slide brand drift).
  for (const tok of ["--bg:", "--text:", "--accent:"]) {
    if (!html.includes(tok)) issues.push(`missing brand token ${tok}`);
  }

  // Sized + clipped to frame (the overflow-safety guarantee is in the root style).
  if (!html.includes("width:960px") || !html.includes("height:540px")) issues.push("missing 960x540 frame");
  if (!html.includes("overflow:hidden")) issues.push("root not clipped (overflow:hidden missing)");

  // Footer policy: content slides carry one, focal slides don't. Match the
  // footer ELEMENT (`class="slide-footer"`), not the `.slide-footer` CSS rule
  // that lives in every slide's stylesheet.
  const hasFooter = html.includes('class="slide-footer"');
  if (FOOTERLESS.has(layout) && hasFooter) issues.push("focal layout should not have a footer");
  if (!FOOTERLESS.has(layout) && !hasFooter) issues.push("content layout missing footer");

  // No leaked artifacts (backslash line-continuations, unfilled placeholders, empty headings).
  if (/\\\s*\n/.test(html)) issues.push("leaked line-continuation backslash");
  if (html.includes("{{")) issues.push("unfilled placeholder token");
  if (/<h1>\s*<\/h1>|<h2>\s*<\/h2>/.test(html)) issues.push("empty heading");

  return { index, layout, pass: issues.length === 0, issues };
}

/**
 * Evaluate a DSL deck statically: render via the real pipeline, then run the
 * structural checks per slide. Returns a machine-readable report.
 */
export function evaluateDeckDsl(xml: string, theme = "pitch"): StaticEvalReport {
  const slides: HtmlDeckSlide[] = dslToHtmlSlides(xml, getThemeConfig(theme));
  // parseDeckDsl normalizes layout aliases (metrics→stats, columns→twoColumn…),
  // so use its slide order as the source of truth for each slide's layout.
  const parsed = parseDeckDsl(xml).slides;
  const checks = slides.map((s, i) => {
    const layout: DslLayout = parsed[i]?.layout ?? "bullets";
    return checkSlide(s.html, layout, i + 1);
  });
  return {
    total: checks.length,
    passed: checks.filter((c) => c.pass).length,
    slides: checks,
  };
}
