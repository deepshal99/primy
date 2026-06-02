# Primy Decks → 100x: "Primy Studio" Plan

**Date:** 2026-06-02
**Goal:** Make Primy generate the best decks in the world — content, visuals, and craft — beating Gamma, Tome, Pitch, and Beautiful.ai.
**Thesis:** Today a deck is a *single chat message*. To win, a deck must become a *rendered, researched, self-critiqued, multi-agent artifact*. We stop streaming one HTML blob and build a design studio in the backend.

---

## Why AI decks (including ours today) look like slop

Grounded in the current pipeline (`systemPrompt.ts` deck section, `parseAIResponse.ts:520`, `HtmlSlideRenderer.tsx`, `deckExport.ts`, `deckThemes.ts`):

| # | Ceiling | Root cause in our code |
|---|---------|------------------------|
| 1 | **Single-shot generation** | All ~12 slides written in ONE 65K pass (~3000 tok/slide). Forces shallow, repetitive layouts. No per-slide depth, no iteration. |
| 2 | **The model never SEES the slide** | HTML written blind. Overflow, contrast, ugly balance caught only by brittle post-hoc hacks (`enforceSlideContrast` luminance rewrite, prompt warnings). |
| 3 | **No layout system** | Every slide is freeform hand-rolled HTML. Inconsistency + overflow + wasted tokens re-deriving geometry. The 13 legacy layouts are rigid; HTML path is chaos. |
| 4 | **Fake data-viz** | "Draw bar charts with divs." No scales, axes, or data binding. Investors live on charts. |
| 5 | **Generic imagery** | One Unsplash result per query, no art direction, no bespoke imagery → screams "template." |
| 6 | **Invented content** | Model fabricates market sizes/stats. No research, no sources. Content is half of "best deck." |
| 7 | **Narrative is a prompt list** | No real story spine, no thesis, no audience-tuned argument design before HTML. |
| 8 | **Themes are flat hex** | Re-derived per-slide via fragile prose. No true token system (palette ramp, type scale, motif library). |
| 9 | **Export drifts** | PPTX dumps HTML as "view in browser." PDF via Puppeteer can drift. Not pixel-perfect. |
| 10 | **No motion** | Sanitizer strips interactivity; decks feel static when presented. |

---

## The shift: from "one-shot blob" → agentic design studio

New runtime pipeline (server-orchestrated, not a single chat stream):

```
Brief → Research → BrandKit → DeckPlan → ⫶ per-slide agents (parallel) ⫶
        → Render each to image → Vision critique (rubric) → Repair failing slides
        → Assemble → Pixel-perfect export
```

Three quality pillars:
- **CONTENT** — researched, narrative-driven, audience-tuned, sourced.
- **VISUALS** — bespoke design-token system, real charts, art-directed imagery, motion, pixel-perfect.
- **CONTROL** — render-aware self-correction, per-slide iteration, surgical edits.

**Rule-bends (deliberate):** deck generation leaves the chat stream and becomes a dedicated backend job with a progress UI; we spend 5–10× the tokens/compute per deck; we use *multiple models* (Gemini for layout+vision, GPT for copy, an image model for visuals); we render *in the loop*. A deck is no longer a message — it's a built artifact.

---

## The 12 building blocks

1. **DeckPlan (typed blueprint).** New AI stage → structured JSON: `thesis`, `framework`, per-slide `{role, keyMessage, contentPoints, dataNeeds, visualIntent, layout, imageDirection}`. Replaces the loose prose outline; becomes the *contract* for slide agents and the source for the outline-card UI. Cheap (1 call).
2. **Research grounding.** For slides with `dataNeeds`, fan out web-search agents (existing web-search task + optionally firecrawl) → real market sizing, problem stats, competitor facts, with citations. Build a `<research>` context block + a Sources appendix.
3. **BrandKit (design tokens, computed once).** Deterministic JSON: accent + full neutral/semantic ramp (dark+light), type pairing w/ sizes+weights, spacing scale, motif spec, bullet/icon style, chart palette, image art-direction (style/duotone/grain). Optionally derive palette from the user's real logo/website. Injected into *every* slide agent → consistency without fragile per-slide prose.
4. **Layout primitive library (the secret weapon).** ~25–30 tested, overflow-safe, token-themed slide layouts (metric trio, comparison table, timeline, process steps, big-stat, chart slide, quote, team grid, logo wall, bento, split-photo hero…). Model picks a layout + fills *typed slots* (not freeform HTML). Freeform escape hatch retained for hero/closing showpieces. Kills overflow + slop + inconsistency by construction.
5. **Data-viz engine.** Themed SVG chart primitives (bar/column/line/area/donut/progress/bullet/waterfall) rendered from `{type, data}` + BrandKit. Proper scales, axes, tabular numbers. Model emits data, never hand-draws.
6. **Bespoke imagery + asset pipeline.** AI image generation (Gemini image / `nanobanana`) for hero/section art with BrandKit art-direction; upgraded stock (multi-result, duotone/grain treatment). Persist to **Vercel Blob** → fast export, no external dependency, consistent look.
7. **Per-slide parallel generation.** Replace the 65K one-shot with N parallel slide-agents — each gets BrandKit + its DeckPlan spec + research + layout library, and writes ONE slide deeply (more tokens/slide, higher quality). Parallel ⇒ same/better wall-clock. **Core 100x lever.**
8. **Render → critique → repair loop (the magic).** Render each slide to an image (reuse Puppeteer/`@sparticuz/chromium`), feed screenshot to a vision model with a rubric (contrast, overflow, hierarchy, balance, brand-fit, readability) → verdict + targeted fixes → repair failing slides (1–2 rounds). Replaces brittle luminance/overflow hacks with *actually seeing*. No competitor does this reliably.
9. **Motion & polish.** CSS-only keyframe build-ins (survive the sanitizer), staggered reveals, presenter-mode transitions; respect `prefers-reduced-motion`.
10. **Pixel-perfect export.** Since every slide is already rendered to an image: PDF = image + invisible selectable-text layer; PPTX = full-bleed slide image + editable text boxes positioned from layout metadata. Kills the "view in browser" fallback.
11. **Surgical editing.** Per-slide regenerate + element edits ("make slide 4 bolder", "swap chart to line", "regenerate the hero"). Cheap + safe because slides are independent and layouts are typed.
12. **Taste/benchmark harness.** A reference library of world-class decks + scoring rubric + eval set, scored by the vision model. Measures "is this actually good" across iterations. This is how quality keeps climbing.

---

## Execution phases (shippable increments)

**Phase 0 — Instrument & measure (foundation).**
Render-to-image service (reuse Puppeteer route) + a deck-QA eval harness (screenshots + vision rubric scoring). Establishes a baseline and the substrate every later phase needs. *Ship: internal scorer + baseline score on 10 sample briefs.*

**Phase 1 — DeckPlan + BrandKit.**
Typed blueprint replaces prose outline; BrandKit token system generated once and injected everywhere. Outline card UI driven by DeckPlan. *Big consistency + control win, low risk.* Touches `route.ts` phase logic, `systemPrompt.ts`, `types.ts`, new outline-card component.

**Phase 2 — Layout primitive library + typed slides.**
~25 overflow-safe themed layouts; model composes via schema; freeform escape hatch kept. *Kills overflow/slop.* New `src/components/deck/layouts/*` + a layout registry + schema in `parseAIResponse.ts`.

**Phase 3 — Per-slide parallel generation + render-critique-repair loop. ← the 100x.**
Dedicated backend job orchestrating parallel slide-agents + the vision repair loop, with a progress UI in `DeckGeneratingView`. New `/api/deck-build` orchestration endpoint.

**Phase 4 — Data-viz engine + bespoke imagery + Blob asset pipeline.**
Chart primitives + AI/stock imagery with art-direction, persisted to Blob. Substance + bespoke visuals.

**Phase 5 — Research grounding + citations.**
Web-search fan-out for `dataNeeds`; Sources slide. Credible content.

**Phase 6 — Motion + pixel-perfect export + surgical editing.**
Polish, fidelity, fine control.

---

## Recommended starting point

**Phase 0 + Phase 1 together.** You cannot improve what you cannot measure, and DeckPlan+BrandKit is the backbone every later phase plugs into. Phase 3 (parallel agents + vision repair loop) is where users *feel* the 100x, but it stands on 0–2.

## Key new surfaces (where code lands)
- `src/app/api/deck-build/route.ts` — orchestration job (plan → research → brandkit → parallel slides → render → critique → repair). `maxDuration` already 300s.
- `src/lib/ai/deck/` — `deckPlan.ts`, `brandKit.ts`, `slideAgent.ts`, `critique.ts`, `rubric.ts`.
- `src/components/deck/layouts/` — the layout primitive library + registry.
- `src/lib/deck/charts/` — themed SVG chart primitives.
- `src/lib/deck/render.ts` — slide → PNG (Puppeteer) for critique + export.
- `src/lib/deck/assets.ts` — image gen/treatment + Blob persistence.
- Eval: `scripts/deck-eval/` — briefs, scorer, baseline.

## Risks / watchouts
- **Latency/cost:** multi-agent + render loop is 5–10× today. Mitigate: parallelism, cache BrandKit/research, cap repair rounds at 2, stream progress so perceived wait is low.
- **Determinism of layouts:** typed slots must be genuinely overflow-proof — test each layout at min/max content.
- **Model routing:** keep Gemini for layout/vision, GPT for copy density; verify both via the eval harness, not vibes.
- **Don't regress the chat flow:** deck-build is a separate job; the conversational gather→outline stays (see the deck-phase fix in `route.ts`).
