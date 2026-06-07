/**
 * DECK_DSL_PROMPT — the option-C deck-generate instruction (flag-gated).
 *
 * Appended to the system prompt ONLY when NEXT_PUBLIC_DECK_DSL=true AND the turn
 * is a deck-generate. It OVERRIDES the default "emit full HTML per slide"
 * instruction: the model instead emits a compact `deckdsl` XML block, and the
 * server-side `dslToHtml` transformer renders deterministic, themed 960×540
 * Primy HTML slides. This lifts ALLWEONE's layout discipline (a small vocabulary
 * of named layouts, no two adjacent slides the same, expand-don't-copy) while
 * keeping Primy's own HTML renderer + polish loop.
 *
 * Keep this in sync with the supported layouts in `src/lib/deck/dslToHtml.ts`
 * (DSL_CORE_LAYOUTS) — emitting a layout the transformer doesn't know falls back
 * to `bullets`, so the deck still renders, just less ideally.
 */

export const DECK_DSL_PROMPT = `## DECK GENERATION — emit a \`deckdsl\` block (DSL mode)

When you generate a deck this turn, DO NOT emit \`deckops\` with hand-written HTML.
Instead emit ONE fenced \`deckdsl\` block: a compact XML the app renders into
on-brand slides deterministically. You choose structure and copy; the app owns
the pixels.

GRAMMAR
\`\`\`deckdsl
<deck theme="THEME" title="DECK TITLE">
  <slide layout="LAYOUT"> ...child tags... </slide>
  ...one <slide> per slide...
</deck>
\`\`\`

THEME (pick ONE that fits the brand/topic): pitch · linear · executive · bold · editorial · arctic · earth · monochrome.

LAYOUTS and their child tags (use a VARIETY — never the same layout on two
adjacent slides; pick the layout that serves the slide's content):
- title — opener. <eyebrow>kicker</eyebrow> <h1>headline</h1> <subtitle>one line</subtitle>
- section — divider between acts. <h1>section name</h1> <subtitle>optional</subtitle>
- statement — one bold claim or CTA, centered. <eyebrow>opt</eyebrow> <h1>the single sentence</h1>
- bullets — 2–5 points. <h2>heading</h2> then <bullet>…</bullet> per point (wrap the lead phrase in <b>…</b>)
- stats — 2–4 metrics. <h2>heading</h2> then <stat value="3x" label="what it means"/> per metric
- twoColumn — a contrast/compare (2 OR 3 columns). <h2>heading</h2> then <column title="Left">…</column> <column title="Right">…</column>
- featureGrid — 3–6 product features as cards. <h2>heading</h2> then <feature title="Name">short benefit</feature> per feature
- agenda — a numbered list (agenda, steps, takeaways). <h2>heading</h2> then <item>…</item> per point
- timeline — a roadmap/process of 3–5 steps. <h2>heading</h2> then <step label="Q1">​<b>what</b> detail</step> per step
- quote — a testimonial or thesis. <quote>the line</quote> <cite>who said it</cite>
- bigStat — 1–3 HERO numbers, centered (traction, a single killer metric). <eyebrow>opt</eyebrow> <h2>opt heading</h2> then <stat value="12k" label="what it counts"/> per number
- chart — real data as a bar OR line chart. <h2>heading</h2> then <chart type="bar"> (or "line") containing <point label="2024" value="25" display="$25B"/> per data point (value is the NUMBER used for scaling; display is the label shown, optional)
- team — founders/advisors as avatar cards (initials auto-generated, never photos). <h2>heading</h2> then <member name="A. Patel" role="CEO — ex-health PM"/> per person (max 4)
- closing — the final CTA slide. <eyebrow>opt</eyebrow> <h1>closing line</h1> <subtitle>opt</subtitle> then <cta label="Request demo"/> (1–2) and <contact>email or url</contact>
- imageFull — a dramatic full-bleed visual slide (great for cover, a section break, or the vision). <image query="2–5 word photo idea"/> <eyebrow>opt</eyebrow> <h1>headline</h1> <subtitle>opt</subtitle> (renders as a branded dark hero with readable white text)
- splitImage — content beside a branded visual panel (good for product/solution). <image query="2–5 word photo idea"/> <h2>heading</h2> then <bullet>…</bullet> per point (or one <body>paragraph</body>). For a product/object shot that should float (background removed) on the panel, add transparent: <image query="sleek smartphone" transparent="true"/>

Use imageFull / splitImage SPARINGLY — at most 1–2 per deck (e.g. the cover or one section), so the deck stays crisp, not noisy.

RULES
- One deck only. Expand the outline into real, specific content — never echo the outline verbatim.
- 5–6 min → ~6 slides, 10 min → ~10, 20 min → ~15. Open with \`title\`, use \`section\` to break acts, close strong.
- Keep copy tight: headlines < 9 words, bullets < 14 words, stat labels < 6 words. The renderer handles all styling.
- Plain text inside tags (only <b> is honored for emphasis). No inline styles, no <img>, no HTML documents.
- OUTPUT FORMAT: emit exactly ONE fenced block opening with \`\`\`deckdsl and closing with \`\`\`. Nothing before or after it. Do NOT use \`\`\`xml or any other fence.

EXAMPLE
\`\`\`deckdsl
<deck theme="pitch" title="Acme — Q3 Growth">
  <slide layout="title"><eyebrow>Q3 2026</eyebrow><h1>A repeatable engine for the next $2M</h1><subtitle>What's working, what's fragile, and the three moves from here.</subtitle></slide>
  <slide layout="stats"><h2>Where we stand</h2><stat value="3x" label="QoQ growth"/><stat value="$48K" label="MRR"/><stat value="92%" label="Gross margin"/></slide>
  <slide layout="twoColumn"><h2>The core tension</h2><column title="Working"><p>PLG signups convert at 4.1% and retain.</p></column><column title="Fragile"><p>78% of revenue rides one channel.</p></column></slide>
  <slide layout="section"><h1>Three moves for two quarters</h1></slide>
  <slide layout="quote"><quote>Acme replaced three tools in my stack.</quote><cite>Sarah Chen, Fractional CMO</cite></slide>
</deck>
\`\`\`
`;
