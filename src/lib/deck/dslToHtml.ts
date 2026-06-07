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
 * be a NEXT_PUBLIC_* var.
 *
 * GRADUATED to ON by default (the constrained layout system replaced the
 * free-form HTML path, which produced blank/clipped/off-brand slides). Set
 * `NEXT_PUBLIC_DECK_DSL=false` as a kill-switch to fall back to the legacy HTML
 * deck path.
 */
export function deckDslEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DECK_DSL !== "false";
}

export const DSL_CORE_LAYOUTS = [
  "title",
  "section",
  "bullets",
  "stats",
  "twoColumn",
  "quote",
  "statement",
  "featureGrid",
  "agenda",
  "timeline",
  "bigStat",
  "team",
  "chart",
  "closing",
  "imageFull",
  "splitImage",
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
    threecolumn: "twoColumn",
    compare: "twoColumn",
    proscons: "twoColumn",
    quote: "quote",
    testimonial: "quote",
    statement: "statement",
    bigstatement: "statement",
    featuregrid: "featureGrid",
    features: "featureGrid",
    grid: "featureGrid",
    cards: "featureGrid",
    agenda: "agenda",
    numbered: "agenda",
    steps: "agenda",
    timeline: "timeline",
    roadmap: "timeline",
    process: "timeline",
    bigstat: "bigStat",
    bignumber: "bigStat",
    metric: "bigStat",
    kpi: "bigStat",
    hero: "bigStat",
    team: "team",
    people: "team",
    founders: "team",
    advisors: "team",
    chart: "chart",
    graph: "chart",
    data: "chart",
    dataviz: "chart",
    closing: "closing",
    cta: "closing",
    contact: "closing",
    getstarted: "closing",
    thankyou: "closing",
    end: "closing",
    imagefull: "imageFull",
    imagehero: "imageFull",
    photo: "imageFull",
    fullbleed: "imageFull",
    image: "imageFull",
    splitimage: "splitImage",
    imagesplit: "splitImage",
    imageleft: "splitImage",
    imageright: "splitImage",
    photocontent: "splitImage",
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

// ── contrast-safe accent for TEXT ──

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbLum([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const la = rgbLum(a), lb = rgbLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}
/**
 * A version of `accent` that meets WCAG 4.5:1 as TEXT on `bg`, by mixing toward
 * black (light bg) or white (dark bg) in small steps until it passes. Keeps the
 * accent hue — so amber text on white becomes a readable deep amber, not a flat
 * grey (matches the design system's deep-amber rule). Falls back to the original
 * accent if it already passes, or to ink if it can't be made to.
 */
function readableAccentText(accent: string, bg: string): string {
  const a = hexToRgb(accent);
  const b = hexToRgb(bg);
  if (!a || !b) return accent;
  if (ratio(a, b) >= 4.5) return accent;
  const target: [number, number, number] = rgbLum(b) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const mixed: [number, number, number] = [
      a[0] + (target[0] - a[0]) * t,
      a[1] + (target[1] - a[1]) * t,
      a[2] + (target[2] - a[2]) * t,
    ];
    if (ratio(mixed, b) >= 4.5) return toHex(mixed);
  }
  return toHex(target);
}

// ── theme → CSS custom properties ──

function themeRootVars(t: ThemeConfig): string {
  return [
    `--bg:${t.bg}`,
    `--text:${t.text}`,
    `--text-2:${t.textSecondary}`,
    `--accent:${t.accent}`,
    // Contrast-safe accent for TEXT (the bright accent is for fills only). Fixes
    // unreadable amber-on-white eyebrows / stat values / numbers.
    `--accent-text:${readableAccentText(t.accent, t.bg)}`,
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
  const cols = blocks(raw, "column").slice(0, 3); // 2 or 3 columns
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

function renderStatement(raw: string): string {
  const eyebrow = block(raw, "eyebrow");
  const h1 = block(raw, "h1") || block(raw, "statement") || block(raw, "title");
  const sub = block(raw, "subtitle");
  return `<div class="statement">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
    <h1>${h1}</h1>
    ${sub ? `<p class="subtitle">${sub}</p>` : ""}
  </div>`;
}

function renderFeatureGrid(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const titles: string[] = [];
  const reOpen = /<feature(\s[^>]*)?>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = reOpen.exec(raw)) !== null) titles.push(attrOf(mm[1] ?? "", "title") ?? "");
  const cards = blocks(raw, "feature")
    .slice(0, 6)
    .map(
      (c, i) =>
        `<div class="feat"><div class="feat-h">${titles[i] ?? ""}</div><div class="feat-b">${c}</div></div>`,
    )
    .join("");
  return `<div class="featgrid">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="feat-row">${cards}</div>
  </div>`;
}

function renderAgenda(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const lis = blocks(raw, "item")
    .map(
      (b, i) =>
        `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="itxt">${b}</span></li>`,
    )
    .join("");
  return `<div class="agenda">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <ol>${lis}</ol>
  </div>`;
}

function renderTimeline(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const labels: string[] = [];
  const reOpen = /<step(\s[^>]*)?>/gi;
  let mm: RegExpExecArray | null;
  while ((mm = reOpen.exec(raw)) !== null) labels.push(attrOf(mm[1] ?? "", "label") ?? "");
  const steps = blocks(raw, "step")
    .slice(0, 5)
    .map(
      (c, i) =>
        `<div class="tl-step"><div class="tl-dot"></div><div class="tl-label">${labels[i] ?? ""}</div><div class="tl-body">${c}</div></div>`,
    )
    .join("");
  return `<div class="timeline">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="tl-row">${steps}</div>
  </div>`;
}

/** Big centered metric(s) — one hero number, or a "metric trio" row. */
function renderBigStat(raw: string): string {
  const eyebrow = block(raw, "eyebrow");
  const h2 = block(raw, "h2") || block(raw, "title");
  const stats = selfClosing(raw, "stat").map((a) => ({
    value: attrOf(`<x ${a}>`, "value") ?? "",
    label: attrOf(`<x ${a}>`, "label") ?? "",
  }));
  if (stats.length === 0) {
    const v = block(raw, "value");
    if (v) stats.push({ value: v, label: block(raw, "label") });
  }
  const cells = stats
    .slice(0, 3)
    .map(
      (s, i) =>
        `${i > 0 ? '<div class="bs-div"></div>' : ""}<div class="bs-cell"><div class="bs-v">${s.value}</div>${s.label ? `<div class="bs-l">${s.label}</div>` : ""}</div>`,
    )
    .join("");
  return `<div class="bigstat">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
    ${h2 ? `<h2 class="bs-h">${h2}</h2>` : ""}
    <div class="bs-row">${cells}</div>
  </div>`;
}

/** Up to two leading initials from a person's name, for the avatar. */
function initials(name: string): string {
  return name
    .replace(/<[^>]*>/g, "")
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w.replace(/[^a-z0-9]/i, "")[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Team grid — initial-avatars (never empty circles), name, role. */
function renderTeam(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const members = selfClosing(raw, "member").map((a) => ({
    name: attrOf(`<x ${a}>`, "name") ?? "",
    role: attrOf(`<x ${a}>`, "role") ?? "",
  }));
  const cards = members
    .slice(0, 4)
    .map(
      (m) =>
        `<div class="tm"><div class="tm-av">${initials(m.name)}</div><div class="tm-n">${m.name}</div>${m.role ? `<div class="tm-r">${m.role}</div>` : ""}</div>`,
    )
    .join("");
  return `<div class="team">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="tm-row">${cards}</div>
  </div>`;
}

interface ChartPoint {
  label: string;
  value: number;
  display: string;
}

function chartPoints(raw: string): ChartPoint[] {
  return selfClosing(raw, "point").map((a) => {
    const value = parseFloat(attrOf(`<x ${a}>`, "value") ?? "0") || 0;
    const label = attrOf(`<x ${a}>`, "label") ?? "";
    const display = attrOf(`<x ${a}>`, "display") ?? String(value);
    return { label, value, display };
  });
}

const CH_W = 820;
const CH_H = 300;
const CH_PAD = 34;
const CH_BASE = CH_H - 42;
const CH_TOP = 26;

function barSvg(pts: ChartPoint[]): string {
  const max = Math.max(...pts.map((p) => p.value), 1);
  const slot = (CH_W - CH_PAD * 2) / pts.length;
  const bw = Math.min(slot * 0.5, 84);
  const bars = pts
    .map((p, i) => {
      const x = CH_PAD + slot * i + (slot - bw) / 2;
      const h = (p.value / max) * (CH_BASE - CH_TOP);
      const y = CH_BASE - h;
      const cx = (x + bw / 2).toFixed(1);
      return `<rect class="ch-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6"></rect>
        <text class="ch-val" x="${cx}" y="${(y - 12).toFixed(1)}" text-anchor="middle">${p.display}</text>
        <text class="ch-lab" x="${cx}" y="${(CH_BASE + 26).toFixed(1)}" text-anchor="middle">${p.label}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${CH_W} ${CH_H}" preserveAspectRatio="xMidYMid meet"><line class="ch-axis" x1="${CH_PAD}" y1="${CH_BASE}" x2="${CH_W - CH_PAD}" y2="${CH_BASE}"></line>${bars}</svg>`;
}

function lineSvg(pts: ChartPoint[]): string {
  const max = Math.max(...pts.map((p) => p.value), 1);
  const n = pts.length;
  const xAt = (i: number) => CH_PAD + (n === 1 ? (CH_W - CH_PAD * 2) / 2 : (i * (CH_W - CH_PAD * 2)) / (n - 1));
  const yAt = (v: number) => CH_BASE - (v / max) * (CH_BASE - CH_TOP);
  const poly = pts.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  const area = `${CH_PAD},${CH_BASE} ${poly} ${(CH_W - CH_PAD).toFixed(1)},${CH_BASE}`;
  const dots = pts
    .map(
      (p, i) =>
        `<circle class="ch-dot" cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="5"></circle>
        <text class="ch-lab" x="${xAt(i).toFixed(1)}" y="${(CH_BASE + 26).toFixed(1)}" text-anchor="middle">${p.label}</text>`,
    )
    .join("");
  return `<svg viewBox="0 0 ${CH_W} ${CH_H}" preserveAspectRatio="xMidYMid meet"><line class="ch-axis" x1="${CH_PAD}" y1="${CH_BASE}" x2="${CH_W - CH_PAD}" y2="${CH_BASE}"></line><polygon class="ch-area" points="${area}"></polygon><polyline class="ch-line" points="${poly}"></polyline>${dots}</svg>`;
}

/** Real themed SVG chart (bar or line) from typed data points. */
function renderChart(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const typeM = /type\s*=\s*"([^"]*)"/i.exec(raw);
  const type = (typeM?.[1] ?? "bar").toLowerCase().includes("line") ? "line" : "bar";
  const pts = chartPoints(raw);
  const svg = pts.length ? (type === "line" ? lineSvg(pts) : barSvg(pts)) : "";
  return `<div class="chart">
    ${h2 ? `<h2>${h2}</h2>` : ""}
    <div class="chart-area">${svg}</div>
  </div>`;
}

/** Closing / CTA slide — centered, with contrast-safe buttons + contact line. */
function renderClosing(raw: string): string {
  const eyebrow = block(raw, "eyebrow");
  const h1 = block(raw, "h1") || block(raw, "title");
  const sub = block(raw, "subtitle");
  const ctas = selfClosing(raw, "cta")
    .map((a) => attrOf(`<x ${a}>`, "label") ?? "")
    .filter(Boolean);
  const contact = block(raw, "contact");
  const btns = ctas
    .slice(0, 2)
    .map((c, i) => `<div class="cta-btn ${i === 0 ? "cta-primary" : "cta-ghost"}">${c}</div>`)
    .join("");
  return `<div class="closing">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
    <h1>${h1}</h1>
    ${sub ? `<p class="subtitle">${sub}</p>` : ""}
    ${btns ? `<div class="cta-row">${btns}</div>` : ""}
    ${contact ? `<div class="contact">${contact}</div>` : ""}
  </div>`;
}

// ── deterministic, brand-themed background art (no fetch, never empty) ──

/** Tiny stable string hash → non-negative int (deterministic variety per seed). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * A rich DARK hero background (for imageFull): a deep ink base with brand-toned
 * glows. Built from CSS vars so it adapts to any theme; varied by seed. Always
 * dark, so white text + the scrim are readable regardless of theme.
 */
function heroBackground(seed: string): string {
  const h = hashSeed(seed);
  const ax = 12 + (h % 30); // glow 1 position
  const ay = 8 + ((h >> 3) % 28);
  const bx = 70 + ((h >> 6) % 22); // glow 2 position
  const by = 64 + ((h >> 9) % 28);
  const angle = 120 + (h % 110);
  // accent glows + a faint sheen over a deep ink base.
  return (
    `background-color:#0d0f17;` +
    `background-image:` +
    `radial-gradient(60% 60% at ${ax}% ${ay}%, color-mix(in srgb, var(--accent) 38%, transparent) 0%, transparent 60%),` +
    `radial-gradient(55% 55% at ${bx}% ${by}%, color-mix(in srgb, var(--accent-2) 30%, transparent) 0%, transparent 58%),` +
    `linear-gradient(${angle}deg, rgba(255,255,255,0.05), transparent 55%)`
  );
}

/** A soft, branded decorative panel (for splitImage's visual side). */
function panelBackground(seed: string): string {
  const h = hashSeed(seed);
  const px = 60 + (h % 30);
  const py = 20 + ((h >> 4) % 35);
  const angle = 140 + (h % 80);
  return (
    `background-color:var(--card);` +
    `background-image:` +
    `radial-gradient(75% 75% at ${px}% ${py}%, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 62%),` +
    `linear-gradient(${angle}deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%)`
  );
}

/** Optional <image query="..."/> — captured for future real-image upgrade (D2). */
function imageSeed(raw: string, fallback: string): { seed: string; queryAttr: string } {
  const a = selfClosing(raw, "image")[0];
  const query = a ? attrOf(`<x ${a}>`, "query") ?? "" : "";
  // data-img-query (NOT data-image-query) so the live Unsplash resolver stays
  // dormant until D2 wires real photography; it just preserves intent for now.
  const queryAttr = query ? ` data-img-query="${query.replace(/"/g, "&quot;")}"` : "";
  return { seed: query || fallback || "primy", queryAttr };
}

/** Full-bleed visual slide — dark hero background, scrim-safe white text. */
function renderImageFull(raw: string): string {
  const eyebrow = block(raw, "eyebrow");
  const h1 = block(raw, "h1") || block(raw, "title");
  const sub = block(raw, "subtitle");
  const { seed, queryAttr } = imageSeed(raw, h1);
  return `<div class="imagefull" style="${heroBackground(seed)}"${queryAttr}>
    <div class="if-inner">
      ${eyebrow ? `<div class="if-eyebrow">${eyebrow}</div>` : ""}
      <h1 class="if-h1">${h1}</h1>
      ${sub ? `<p class="if-sub">${sub}</p>` : ""}
    </div>
  </div>`;
}

/** Split slide — content on one side, a branded visual panel on the other. */
function renderSplitImage(raw: string): string {
  const h2 = block(raw, "h2") || block(raw, "title");
  const bodyBullets = blocks(raw, "bullet");
  const body = block(raw, "body");
  const { seed, queryAttr } = imageSeed(raw, h2);
  const content = bodyBullets.length
    ? `<ul class="si-list">${bodyBullets.map((b) => `<li><span class="bar"></span><span class="btxt">${b}</span></li>`).join("")}</ul>`
    : body
      ? `<p class="si-body">${body}</p>`
      : "";
  return `<div class="splitimage">
    <div class="si-content">
      ${h2 ? `<h2>${h2}</h2>` : ""}
      ${content}
    </div>
    <div class="si-panel" style="${panelBackground(seed)}"${queryAttr}></div>
  </div>`;
}

const RENDERERS: Record<DslLayout, (raw: string) => string> = {
  title: renderTitle,
  section: renderSection,
  bullets: renderBullets,
  stats: renderStats,
  twoColumn: renderTwoColumn,
  quote: renderQuote,
  statement: renderStatement,
  featureGrid: renderFeatureGrid,
  agenda: renderAgenda,
  timeline: renderTimeline,
  bigStat: renderBigStat,
  team: renderTeam,
  chart: renderChart,
  closing: renderClosing,
  imageFull: renderImageFull,
  splitImage: renderSplitImage,
};

/**
 * Layouts that carry a consistent footer (deck name + slide number). The
 * full-bleed focal layouts (cover, section divider, quote, big statement) stay
 * clean — no footer — so the footer reads as intentional chrome on content
 * slides, never "random". This replaces the per-slide ad-hoc footers the
 * free-form HTML path produced.
 */
const LAYOUTS_WITH_FOOTER = new Set<DslLayout>([
  "bullets",
  "stats",
  "twoColumn",
  "featureGrid",
  "agenda",
  "timeline",
  "team",
  "chart",
]);

/** HTML-escape a short plaintext value for safe inline use in the footer. */
function escFooter(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface SlideRenderOpts {
  /** 1-based slide position, for the footer. */
  index?: number;
  /** Total slides, for the footer. */
  total?: number;
  /** Deck name shown at footer-left. */
  deckTitle?: string;
}

function footerHtml(layout: DslLayout, opts: SlideRenderOpts): string {
  if (!LAYOUTS_WITH_FOOTER.has(layout)) return "";
  const left = opts.deckTitle ? escFooter(opts.deckTitle) : "";
  const right = opts.index && opts.total ? `${opts.index} / ${opts.total}` : "";
  if (!left && !right) return "";
  return `<div class="slide-footer"><span>${left}</span><span>${right}</span></div>`;
}

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
  .eyebrow{color:var(--accent-text);font-weight:600;font-size:15px;letter-spacing:0.14em;
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
  .stat-v{font-family:var(--h-font);font-weight:var(--h-weight);font-size:52px;color:var(--accent-text);
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
  .qmark{font-family:var(--h-font);font-size:90px;color:var(--accent-text);line-height:0.6;opacity:0.9}
  .quote blockquote{font-family:var(--h-font);font-weight:var(--h-weight);font-size:38px;
    line-height:1.25;letter-spacing:-0.015em;margin-top:8px;max-width:800px}
  .cite{color:var(--text-2);font-size:19px;margin-top:26px}
  /* statement */
  .statement{justify-content:center}
  .statement h1{font-size:46px;line-height:1.18;letter-spacing:-0.015em;max-width:860px}
  /* feature grid */
  .feat-row{display:flex;flex-wrap:wrap;gap:16px}
  .feat{flex:1 1 calc(33% - 16px);min-width:230px;background:var(--card);
    border:1px solid var(--card-border);border-radius:14px;padding:18px 20px}
  .feat-h{font-family:var(--h-font);font-weight:var(--h-weight);font-size:19px;margin-bottom:8px}
  .feat-h::before{content:"";display:block;width:26px;height:4px;border-radius:99px;
    background:var(--accent);margin-bottom:10px}
  .feat-b{color:var(--text-2);font-size:15px;line-height:1.4}
  /* agenda (numbered) */
  .agenda ol{list-style:none;display:flex;flex-direction:column;gap:16px}
  .agenda li{display:flex;align-items:baseline;gap:20px;font-size:22px;line-height:1.35}
  .agenda .num{font-family:var(--h-font);font-weight:var(--h-weight);font-size:20px;color:var(--accent-text);
    font-feature-settings:'tnum';min-width:34px}
  .agenda .itxt{color:var(--text)}
  /* timeline */
  .tl-row{display:flex;gap:0;margin-top:8px}
  .tl-step{flex:1;position:relative;padding:26px 18px 0 0}
  .tl-step::before{content:"";position:absolute;top:6px;left:0;right:0;height:2px;background:var(--divider)}
  .tl-dot{position:absolute;top:0;left:0;width:13px;height:13px;border-radius:50%;
    background:var(--accent);border:2px solid var(--bg)}
  .tl-label{font-family:var(--h-font);font-weight:var(--h-weight);font-size:17px;color:var(--accent-text);margin-bottom:8px}
  .tl-body{color:var(--text-2);font-size:15px;line-height:1.4}
  .tl-body b{color:var(--text);font-weight:650}
  /* big stat / metric trio */
  .bigstat{justify-content:center;text-align:center;align-items:center}
  .bs-h{font-size:30px;margin-bottom:36px;text-align:center}
  .bs-row{display:flex;align-items:center;justify-content:center;gap:0}
  .bs-cell{display:flex;flex-direction:column;align-items:center;padding:0 48px}
  .bs-div{width:1px;height:84px;background:var(--divider)}
  .bs-v{font-family:var(--h-font);font-weight:var(--h-weight);font-size:84px;line-height:1;
    letter-spacing:-0.03em;color:var(--accent-text)}
  .bs-l{color:var(--text-2);font-size:17px;line-height:1.35;margin-top:16px;max-width:240px}
  /* team */
  .tm-row{display:flex;gap:24px;justify-content:center}
  .tm{flex:1;max-width:220px;display:flex;flex-direction:column;align-items:center;text-align:center}
  .tm-av{width:96px;height:96px;border-radius:50%;background:var(--accent-light);
    display:flex;align-items:center;justify-content:center;font-family:var(--h-font);
    font-weight:var(--h-weight);font-size:30px;color:var(--accent-text);margin-bottom:18px}
  .tm-n{font-family:var(--h-font);font-weight:650;font-size:19px;color:var(--text)}
  .tm-r{color:var(--text-2);font-size:15px;line-height:1.35;margin-top:6px}
  /* chart */
  .chart-area{height:300px;display:flex;margin-top:6px}
  .chart-area svg{width:100%;height:100%}
  .ch-axis{stroke:var(--divider);stroke-width:2}
  .ch-bar{fill:var(--accent)}
  .ch-val{fill:var(--text);font-family:var(--h-font);font-weight:700;font-size:17px}
  .ch-lab{fill:var(--text-2);font-family:var(--b-font);font-size:14px}
  .ch-area{fill:var(--accent-light)}
  .ch-line{fill:none;stroke:var(--accent);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
  .ch-dot{fill:var(--accent)}
  /* closing / CTA */
  .closing{justify-content:center;text-align:center;align-items:center}
  .closing h1{font-size:52px;line-height:1.1;letter-spacing:-0.02em;max-width:820px}
  .closing .subtitle{text-align:center;margin-left:auto;margin-right:auto}
  .cta-row{display:flex;gap:14px;justify-content:center;margin-top:34px}
  .cta-btn{font-family:var(--b-font);font-weight:600;font-size:16px;padding:14px 30px;border-radius:10px}
  .cta-primary{background:var(--accent-text);color:var(--bg)}
  .cta-ghost{border:1.5px solid var(--card-border);color:var(--text)}
  .contact{color:var(--text-2);font-size:16px;margin-top:26px}
  /* imageFull — full-bleed dark hero, white text (scrim-safe by construction) */
  .imagefull{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:64px 72px}
  .if-inner{max-width:780px}
  .if-eyebrow{color:#ffffff;font-weight:600;font-size:15px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px}
  .if-h1{font-family:var(--h-font);font-weight:var(--h-weight);font-size:58px;line-height:1.04;letter-spacing:-0.02em;color:#ffffff}
  .if-sub{color:#ffffff;font-size:21px;line-height:1.4;margin-top:18px;max-width:680px}
  /* splitImage — content + branded visual panel */
  .splitimage{position:absolute;inset:0;display:flex}
  .si-content{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:64px 56px}
  .si-panel{flex:1}
  .si-list{list-style:none;display:flex;flex-direction:column;gap:18px;margin-top:6px}
  .si-list li{display:flex;align-items:flex-start;gap:16px;font-size:20px;line-height:1.4;color:var(--text)}
  .si-list .bar{flex:0 0 auto;width:6px;height:24px;border-radius:99px;background:var(--accent);margin-top:3px}
  .si-body{color:var(--text-2);font-size:20px;line-height:1.55;margin-top:6px}
  /* consistent footer (content slides only) */
  .slide-footer{position:absolute;left:72px;right:72px;bottom:26px;display:flex;
    align-items:center;justify-content:space-between;font-size:13px;letter-spacing:0.01em;
    color:var(--text-2);opacity:0.65;font-feature-settings:'tnum'}
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
export function renderSlideHtml(slide: DslSlide, theme: ThemeConfig, opts: SlideRenderOpts = {}): string {
  const inner = RENDERERS[slide.layout](slide.raw);
  const rootStyle = `${themeRootVars(theme)};${SLIDE_ROOT_STYLE}`;
  return `<div class="slide" style="${rootStyle}"><style>${slideCss()}</style>${inner}${footerHtml(slide.layout, opts)}</div>`;
}

let slideSeq = 0;
function slideId(): string {
  slideSeq += 1;
  return `dslslide-${slideSeq}-${slideSeq.toString(36)}`;
}

/** Full pipeline: DSL string + theme → HtmlDeckSlide[] ready for the store. */
export function dslToHtmlSlides(xml: string, theme: ThemeConfig): HtmlDeckSlide[] {
  const { title, slides } = parseDeckDsl(xml);
  const total = slides.length;
  return slides.map((s, i) => ({
    id: slideId(),
    html: renderSlideHtml(s, theme, { index: i + 1, total, deckTitle: title }),
    editableFields: [],
  }));
}
