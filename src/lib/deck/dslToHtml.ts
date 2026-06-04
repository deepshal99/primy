/**
 * dslToHtml — SPIKE (option C): ALLWEONE-style XML layout DSL → Primy HtmlDeckSlide.
 *
 * WHY
 * ALLWEONE's real portable IP is its idea of having the model emit a COMPACT,
 * STRUCTURED layout DSL (`<section layout="bullets">…`) instead of verbose
 * free-form HTML, then materializing the visuals deterministically. Their own
 * renderer targets a Plate tree; Primy renders decks as self-contained
 * 960×540 HTML documents (`:root{--bg/--text/--accent}` tokens, consumed by
 * HtmlSlideRenderer + the polish loop). So this transformer keeps their DSL idea
 * but emits PRIMY HTML — the layout taxonomy and per-slide design discipline
 * become OURS, deterministically themed, without importing their Plate stack.
 *
 * SPIKE SCOPE: 6 core layouts (title, section, bullets, stats, twoColumn, quote)
 * — enough to judge the quality lift. The remaining ALLWEONE layouts (timeline,
 * pyramid, compare, charts, …) are "more renderer functions of the same shape".
 *
 *   <deck> XML ──▶ parseDeckDsl ──▶ DslSlide[] ──▶ renderSlideHtml(theme) ──▶ HtmlDeckSlide[]
 *                                                    │
 *                                          (deterministic, themed, overflow-safe)
 */

import type { HtmlDeckSlide, ThemeConfig } from "@/lib/types";

/**
 * Flag gate for the DSL deck path. Readable on BOTH server (chat route, to append
 * DECK_DSL_PROMPT) and client (ChatPanel, to parse the deckdsl block), so it must
 * be a NEXT_PUBLIC_* var. Off by default — the existing HTML deck path is untouched.
 */
export function deckDslEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DECK_DSL === "true";
}

export const DSL_CORE_LAYOUTS = [
  "title",
  "section",
  "bullets",
  "stats",
  "twoColumn",
  "quote",
] as const;
export type DslLayout = (typeof DSL_CORE_LAYOUTS)[number];

export interface DslSlide {
  layout: DslLayout;
  raw: string; // inner XML of the <slide> element
}

export interface ParsedDeckDsl {
  title?: string;
  theme?: string;
  slides: DslSlide[];
}

// ── tiny tolerant XML helpers (AI output is messy; never throw) ──

function attrOf(openTag: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(openTag);
  return m ? m[1] : undefined;
}

/** Inner content of every `<name ...>…</name>` occurrence in `src`. */
function blocks(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1].trim());
  return out;
}

/** First inner content of `<name>…</name>`, or "" . */
function block(src: string, name: string): string {
  return blocks(src, name)[0] ?? "";
}

/** Self-closing elements `<name attr="…"/>` → their attribute maps. */
function selfClosing(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}\\s+([^>]*?)/?>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

function normLayout(raw: string | undefined): DslLayout {
  const v = (raw ?? "").toLowerCase().replace(/[-_\s]/g, "");
  const map: Record<string, DslLayout> = {
    title: "title",
    cover: "title",
    section: "section",
    divider: "section",
    bullets: "bullets",
    list: "bullets",
    stats: "stats",
    metrics: "stats",
    twocolumn: "twoColumn",
    columns: "twoColumn",
    compare: "twoColumn",
    quote: "quote",
    testimonial: "quote",
  };
  return map[v] ?? "bullets"; // safe default — bullets renders almost any content
}

/** Parse a `<deck>…<slide layout="…">…</slide>…</deck>` document. Tolerant. */
export function parseDeckDsl(xml: string): ParsedDeckDsl {
  const cleaned = xml.replace(/```[a-z]*\n?/gi, "").trim(); // strip stray code fences
  const deckOpen = /<deck(?:\s[^>]*)?>/i.exec(cleaned);
  const title = deckOpen ? attrOf(deckOpen[0], "title") : undefined;
  const theme = deckOpen ? attrOf(deckOpen[0], "theme") : undefined;

  const slides: DslSlide[] = [];
  const re = /<slide(\s[^>]*)?>([\s\S]*?)<\/slide>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const openAttrs = m[1] ?? "";
    slides.push({ layout: normLayout(attrOf(openAttrs, "layout")), raw: m[2].trim() });
  }
  return { title, theme, slides };
}

// ── theme → CSS custom properties ──

function themeRootVars(t: ThemeConfig): string {
  return [
    `--bg:${t.bg}`,
    `--text:${t.text}`,
    `--text-2:${t.textSecondary}`,
    `--accent:${t.accent}`,
    `--accent-2:${t.accentAlt}`,
    `--accent-light:${t.accentLight}`,
    `--card:${t.cardBg}`,
    `--card-border:${t.cardBorder}`,
    `--divider:${t.divider}`,
    `--h-font:${t.headingFont}`,
    `--b-font:${t.bodyFont}`,
    `--h-weight:${t.headingWeight}`,
  ].join(";");
}

// ── per-layout inner renderers (return the .slide inner HTML) ──

function renderTitle(raw: string): string {
  const eyebrow = block(raw, "eyebrow");
  const h1 = block(raw, "h1") || block(raw, "title");
  const subtitle = block(raw, "subtitle");
  return `<div class="title">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
    <h1>${h1}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
  </div>`;
}

function renderSection(raw: string): string {
  const h1 = block(raw, "h1") || block(raw, "title");
  const sub = block(raw, "subtitle");
  return `<div class="section">
    <div class="section-rule"></div>
    <h1>${h1}</h1>
    ${sub ? `<p class="subtitle">${sub}</p>` : ""}
  </div>`;
}

function renderBullets(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const items = blocks(raw, "bullet");
  const lis = items
    .map((b) => `<li><span class="bar"></span><span class="btxt">${b}</span></li>`)
    .join("");
  return `<div class="bullets">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <ul>${lis}</ul>
  </div>`;
}

function renderStats(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const cards = selfClosing(raw, "stat")
    .map((a) => {
      const value = attrOf(`<x ${a}>`, "value") ?? "";
      const label = attrOf(`<x ${a}>`, "label") ?? "";
      return `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${label}</div></div>`;
    })
    .join("");
  return `<div class="stats">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="stat-row">${cards}</div>
  </div>`;
}

function renderTwoColumn(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const cols = blocks(raw, "column").slice(0, 2);
  // find the opening tag of each column to read its title attr
  const titles: string[] = [];
  const reOpen = /<column(\s[^>]*)?>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = reOpen.exec(raw)) !== null) titles.push(attrOf(mm[1] ?? "", "title") ?? "");
  const colHtml = cols
    .map(
      (c, i) =>
        `<div class="col"><div class="col-h">${titles[i] ?? ""}</div><div class="col-b">${c}</div></div>`,
    )
    .join("");
  return `<div class="twocol">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="col-row">${colHtml}</div>
  </div>`;
}

function renderQuote(raw: string): string {
  const quote = block(raw, "quote");
  const cite = block(raw, "cite");
  return `<div class="quote">
    <div class="qmark">"</div>
    <blockquote>${quote}</blockquote>
    ${cite ? `<div class="cite">${cite}</div>` : ""}
  </div>`;
}

const RENDERERS: Record<DslLayout, (raw: string) => string> = {
  title: renderTitle,
  section: renderSection,
  bullets: renderBullets,
  stats: renderStats,
  twoColumn: renderTwoColumn,
  quote: renderQuote,
};

// ── shared CSS (themed, overflow-safe, 960×540) ──

/**
 * Core box sizing/centering INLINE on the root div — matches the legacy slide
 * pattern (a `<div style='width:960px;height:540px;...'>`), so the slide is
 * correctly sized and centered even if the nested `<style>` were ever stripped.
 * The nested `<style>` (which survives DOMPurify when nested) supplies the theme
 * vars + layout classes.
 */
const SLIDE_ROOT_STYLE =
  "width:960px;height:540px;overflow:hidden;position:relative;display:flex;" +
  "flex-direction:column;justify-content:center;padding:64px 72px;" +
  "background:var(--bg);color:var(--text);font-family:var(--b-font);" +
  "-webkit-font-smoothing:antialiased";

function slideCss(): string {
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  h1{font-family:var(--h-font);font-weight:var(--h-weight);line-height:1.05;letter-spacing:-0.02em}
  h2{font-family:var(--h-font);font-weight:var(--h-weight);font-size:34px;line-height:1.1;
    letter-spacing:-0.015em;margin-bottom:28px}
  .subtitle{color:var(--text-2);font-size:21px;line-height:1.4;margin-top:18px;max-width:760px}
  /* title */
  .title h1{font-size:62px;max-width:820px}
  .eyebrow{color:var(--accent);font-weight:600;font-size:15px;letter-spacing:0.14em;
    text-transform:uppercase;margin-bottom:22px}
  /* section */
  .section{justify-content:center}
  .section h1{font-size:54px;max-width:820px}
  .section-rule{width:56px;height:5px;background:var(--accent);border-radius:99px;margin-bottom:26px}
  /* bullets */
  .bullets ul{list-style:none;display:flex;flex-direction:column;gap:20px}
  .bullets li{display:flex;align-items:flex-start;gap:18px;font-size:22px;line-height:1.4}
  .bullets .bar{flex:0 0 auto;width:6px;height:26px;border-radius:99px;background:var(--accent);margin-top:4px}
  .bullets .btxt{color:var(--text)}
  .bullets b,.twocol b{color:var(--text);font-weight:650}
  /* stats */
  .stat-row{display:flex;gap:24px}
  .stat{flex:1;background:var(--card);border:1px solid var(--card-border);border-radius:16px;
    padding:30px 28px}
  .stat-v{font-family:var(--h-font);font-weight:var(--h-weight);font-size:52px;color:var(--accent);
    line-height:1;letter-spacing:-0.02em}
  .stat-l{color:var(--text-2);font-size:17px;line-height:1.35;margin-top:14px}
  /* two column */
  .col-row{display:flex;gap:28px}
  .col{flex:1;background:var(--card);border:1px solid var(--card-border);border-radius:16px;padding:28px}
  .col-h{font-family:var(--h-font);font-weight:var(--h-weight);font-size:22px;margin-bottom:14px}
  .col-h::before{content:"";display:inline-block;width:22px;height:4px;border-radius:99px;
    background:var(--accent);vertical-align:middle;margin-right:10px}
  .col-b{color:var(--text-2);font-size:18px;line-height:1.5}
  /* quote */
  .quote{justify-content:center}
  .qmark{font-family:var(--h-font);font-size:90px;color:var(--accent);line-height:0.6;opacity:0.9}
  .quote blockquote{font-family:var(--h-font);font-weight:var(--h-weight);font-size:38px;
    line-height:1.25;letter-spacing:-0.015em;margin-top:8px;max-width:800px}
  .cite{color:var(--text-2);font-size:19px;margin-top:26px}
  `;
}

/**
 * Render one DSL slide to a self-contained 960×540 slide fragment.
 *
 * The `<style>` is NESTED INSIDE the `.slide` div, not in a `<head>` and not at
 * the fragment top. Primy's `HtmlSlideRenderer` runs the markup through DOMPurify
 * (`WHOLE_DOCUMENT:false`, `ADD_TAGS:["style"]`) and injects it into a shadow
 * root: a `<head>` is dropped, and a top-level `<style>` gets dropped too, but a
 * `<style>` nested as an element child survives (this is how the legacy slide
 * HTML carries its CSS — `enforceSlideContrast` reads that same `<style>`).
 * The theme vars are set as INLINE custom properties on the `.slide` div (not in
 * `:root{}`) — `:root` matches nothing inside a shadow root (the renderer uses
 * one), so the vars must live on an actual element to inherit to children. This
 * also makes the slide self-contained across every render context (shadow, PDF,
 * iframe). The nested `<style>` then only carries layout class rules.
 */
export function renderSlideHtml(slide: DslSlide, theme: ThemeConfig): string {
  const inner = RENDERERS[slide.layout](slide.raw);
  const rootStyle = `${themeRootVars(theme)};${SLIDE_ROOT_STYLE}`;
  return `<div class="slide" style="${rootStyle}"><style>${slideCss()}</style>${inner}</div>`;
}

let slideSeq = 0;
function slideId(): string {
  slideSeq += 1;
  return `dslslide-${slideSeq}-${slideSeq.toString(36)}`;
}

/** Full pipeline: DSL string + theme → HtmlDeckSlide[] ready for the store. */
export function dslToHtmlSlides(xml: string, theme: ThemeConfig): HtmlDeckSlide[] {
  const { slides } = parseDeckDsl(xml);
  return slides.map((s) => ({
    id: slideId(),
    html: renderSlideHtml(s, theme),
    editableFields: [],
  }));
}
