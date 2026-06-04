# ALLWEONE Deck Engine — Port Plan

**Date:** 2026-06-03
**Status:** Plan (not started) — gated on a 1-day output spike
**Decision source:** `2026-06-03-primy-d1-direction.md` (§5)
**Target:** `github.com/allweonedev/presentation-ai` (MIT)

> **⚠️ CORRECTION 2026-06-03 (post code-investigation).** The original premise of
> this plan — "ALLWEONE is a stack-twin, drop their slides into `HtmlDeckSlide`"
> — is **WRONG**. A source investigation (see §0) found ALLWEONE represents every
> slide as a **Plate/Slate node tree**, not HTML. There is **no HTML string
> anywhere** in their slide path. The stack-twin overlap (Next.js/React/TS/Plate
> v52) does **not** help the deck path, because Primy renders decks as HTML
> strings (`dangerouslySetInnerHTML` + DOMPurify), not Plate. The cheap clean
> graft does not exist. What's portable is the **prompts + XML DSL + layout
> taxonomy + theme model** — NOT the engine. Sections below are corrected.

---

## 0. The key reframe (read first — CORRECTED)

Primy is **not deckless**. It already ships an HTML-slide deck system that is **outline-first** (`DeckOutlineEditor` → `DeckGeneratingView` → `DeckLinearView`), HTML/React-rendered (`HtmlSlideRenderer`, `sanitizeSlideHtml`), with a dual model (`DeckSlide` legacy + `HtmlDeckSlide`), a `deckops` op pipeline (`parseAIResponse`), a `deckVersion` re-render counter, and a shipped render→critique→repair **polish loop** (`src/lib/ai/deck/`, `src/lib/deck/`).

**ALLWEONE is NOT architecturally convergent with Primy's deck path.** Investigation findings:
- A slide is a **Plate `Value`** — `PlateSlide.content: PlateNode[]`, a Slate node tree (`src/components/notebook/presentation/utils/parser.ts`). ~36 custom element types (pyramid, timeline, compare, before/after, ~40 chart components).
- The LLM emits a **custom XML DSL** (`<PRESENTATION><SECTION layout="left|right|vertical"><BULLETS>…</SECTION>`), ~15 layout tags. The XML is **not parsed server-side**; a client streaming `SlideParser` turns XML → Plate tree.
- Rendering is **pure Plate React** (`EditablePlate.tsx` live, `StaticPlate.tsx` via `EditorStatic`). **No `dangerouslySetInnerHTML`, no HTML strings.**
- 40 built-in themes as `ThemeProperties` (`src/lib/presentation/themes.ts`).

**Therefore: their slides CANNOT be dropped into `HtmlDeckSlide`.** The design value (pyramids, timelines, charts, multi-pane layouts) lives in **React/Plate components, not HTML/CSS**. Two real options:
- **(B-recommended) Lift the prompts + XML DSL + layout vocabulary; write a NEW XML→HTML-string transformer** (one themed-HTML renderer per layout tag) that emits `HtmlDeckSlide`. Keeps Primy's renderer/op pipeline/polish loop untouched. Difficulty: **MEDIUM** (you rebuild the visual layer as HTML — charts + multi-pane are the costly part).
- **(High) Port the Plate engine wholesale** — 36 element types + chart components + static kits = a **parallel deck engine** alongside the HTML one. Not a graft. Not recommended.

Portable IP (cheap, model-agnostic): the `SLIDES_TEMPLATE` XML-DSL prompt (`api/presentation/generate/route.ts`), the outline prompt (`api/presentation/outline/route.ts`), the 15-layout taxonomy, the `ThemeProperties` shape. **The single biggest risk: underestimating the HTML reimplementation of the layout/chart components — that is where this silently balloons.**

Everything Primy already has and keeps: the op pipeline, `HtmlSlideRenderer` + DOMPurify, theming/dark mode, snapshots, share viewer, PPTX/PDF export (pptxgenjs + Puppeteer), the polish loop.

## 1b. SPIKE RESULT (2026-06-03) — option C built and rendered ✅

Built the DSL→HTML transformer (`src/lib/deck/dslToHtml.ts`, 7 tests) for 6 core layouts
(title, section, bullets, stats, twoColumn, quote) and rendered a realistic consultant deck in two
themes (pitch-light, linear-dark) from ONE DSL input. Verdict: **the approach works and looks good.**
Same compact `<deck><slide layout="…">` DSL → deterministically themed 960×540 Primy HTML slides via
`var(--*)` tokens — no Plate engine imported, drops straight into `HtmlSlideRenderer` + the polish loop.
Theming is fully deterministic (one input, two on-brand outputs). This validates **option C as the
deck path**: the model emits the DSL, we own the HTML rendering. Remaining ALLWEONE layouts (timeline,
pyramid, compare, charts) are additional renderer functions of the same shape — incremental, not a rewrite.

**Wired live behind a flag (2026-06-03) ✅** — steps 1 & 2 done:
- (1) ✅ `src/lib/ai/deck/dslPrompt.ts` (`DECK_DSL_PROMPT`) — appended to the system prompt in
  `/api/chat` when `deckDslEnabled() && taskType === "deck-generate"`. Instructs the model to emit a
  `deckdsl` block (the 6-layout grammar + theme + example).
- (2) ✅ `parseDeckDslOperations` (`parseAIResponse.ts`) extracts the `deckdsl` block → `dslToHtmlSlides`
  → a deck CREATE with themed slides + `style`. ChatPanel prefers it over `deckops` when the flag is on,
  falling back cleanly otherwise. `deckdsl` added to the display-strip list. Tests: `tests/lib/deck/parseDeckDsl.test.ts`.
- **Flag:** `deckDslEnabled()` reads `NEXT_PUBLIC_DECK_DSL === "true"` (server + client). **OFF by default —
  the existing HTML deck path is untouched.** To trial: add `NEXT_PUBLIC_DECK_DSL=true` to `.env.local`,
  restart dev, generate a deck.
- (3) ◻️ Remaining: port more layouts (timeline, pyramid, compare, charts) as demand shows — each is one
  renderer function in `dslToHtml.ts` + a line in the prompt grammar.

Verification: full suite **204 tests pass**, `tsc --noEmit` clean.

**LIVE end-to-end verified (2026-06-03) ✅** — booted dev (`NEXT_PUBLIC_DECK_DSL=true`), generated a 6-slide deck. The model emitted a `deckdsl` block, the transformer rendered all 6 layouts (title/section/bullets/stats/twoColumn/quote), themed (amber accent, white bg), centered, 960×540 — confirmed via shadow-DOM signature checks + screenshots. Generation was FASTER than the HTML path (~10s vs ~38s) because the DSL is far terser. No parse failures.

**3 renderer-integration bugs found live and fixed in `dslToHtml.ts`** (none caught by node-env unit tests — only a real browser run surfaced them):
1. Emitting a full `<!doctype html>` doc → `HtmlSlideRenderer` runs DOMPurify with `WHOLE_DOCUMENT:false` and **drops `<head>`** → slides unstyled. Fix: emit a fragment.
2. A top-level `<style>` is also dropped; only a `<style>` **nested inside an element** survives. Fix: nest `<style>` inside the `.slide` div (matches the legacy slide pattern). Also inlined box sizing/centering on the root div as belt-and-suspenders.
3. Theme vars in `:root{}` **don't apply inside a shadow root** (`:root` matches no element there). Fix: set theme vars as **inline custom properties on the `.slide` div** so they inherit to children in every render context (shadow/PDF/iframe).

Flag reverted to off after the test. Note: the live test left a throwaway "Acme B2B SaaS Pitch" workspace (with a few duplicate decks) in the local dev DB — safe to delete.

---

## 1. Gate: 1-day output spike (superseded by §1b — DONE)

Stand ALLWEONE up locally (or use its hosted demo). Generate 5 decks from **real Primy-user content** (a consulting proposal, a QBR, a metrics review, a pitch, a one-pager-as-slides). Answer:

1. **Is the output visibly better than Primy's current deck generation?** Side-by-side screenshots. If not clearly better → **abort the port**, keep Primy's engine, redirect effort to Pages.
2. **What specifically is better?** Templates? Layout variety? Typography? Content density? Image use? → that names exactly what to lift.
3. **Is the slide representation portable?** Inspect their slide schema (JSON? React tree? Plate value?). The closer to Primy's `HtmlDeckSlide`, the cheaper the graft.

**Exit criterion:** a go/no-go with a one-paragraph "what we're lifting and why."

## 2. If GO — what to lift / leave / graft

| Lift (import) | Leave (keep Primy's) |
|---|---|
| Slide **layout templates / components** | `deckops` op pipeline + `parseAIResponse` |
| **Generation prompts** (outline→slides) | `HtmlSlideRenderer` + `sanitizeSlideHtml` (security boundary — do NOT import a foreign sanitizer blind) |
| Any **theme/brand token** model better than `ThemeConfig` | `deckVersion` re-render, snapshots, share viewer |
| Image-selection logic if better than current Unsplash path | PPTX (`pptxgenjs`) + PDF (Puppeteer) export |
| | The render→critique→repair **polish loop** (rides on top, engine-agnostic) |

## 3. Graft points (where the seams are)

```
ALLWEONE templates/prompts
        │  (produce HTML slides shaped as HtmlDeckSlide)
        ▼
generation call ──▶ deckops CREATE/UPDATE  ──▶ parseAIResponse (existing)
                                              ──▶ store.applyDeckOps (existing, bumps deckVersion)
                                              ──▶ HtmlSlideRenderer (existing)
                                              ──▶ [auto] refineDeck polish loop (existing)
                                              ──▶ pptx/pdf export (existing)
```

The ONLY new code: the template library + the generation prompt that emits slides already shaped as `HtmlDeckSlide`. Map ALLWEONE's slide output → `HtmlDeckSlide` at one adapter boundary; everything downstream is unchanged.

## 4. Risks & guards

- **Security: never import a foreign HTML sanitizer.** ALLWEONE slides must pass through Primy's `sanitizeSlideHtml` (DOMPurify) before render/persist. Cross-reference the shadow-root encapsulation work already shipped. Threat: XSS via model-emitted/imported HTML.
- **MIT attribution:** preserve license headers on lifted files; add a NOTICE entry. Cheap, do it.
- **Scope creep back into the arms race:** the spike's go/no-go is the circuit breaker. If "better" is marginal, do not port — D1 says the page is the hero, not the deck.
- **Plate version skew:** Primy is on Plate v52; confirm ALLWEONE's Plate major matches before lifting any Plate-coupled code, or keep only the HTML output (not their Plate wiring).
- **`any`-typed seams:** the adapter (ALLWEONE slide → `HtmlDeckSlide`) must be typed and unit-tested — this is exactly the AI-boundary fragility the HOLD-scope audit flags. Add tests for nil/empty/malformed slide payloads.

## 5. Effort (CORRECTED — the convergent-graft estimate was wrong)

- Spike: **1 day** (gate — lift their prompt + DSL, generate, eyeball quality).
- Option B (lift prompts/DSL + write XML→HTML transformer per layout tag + theme map + tests): **~2–3 weeks**, dominated by reimplementing the visual layer (charts + multi-pane layouts) as HTML/CSS. NOT the earlier "3–7 days" — that assumed droppable HTML slides, which don't exist.
- Option High (port the Plate engine wholesale): **weeks+, a parallel engine** — not recommended.
- Polish loop: **0** (already shipped, composes for free on whatever HTML you render).

**Re-decision needed.** The user chose "ALLWEONE now" believing it was a cheap stack-twin graft. At ~2–3 weeks of HTML-layer reimplementation — against the locked direction that the **page is the hero, not the deck** — this warrants an explicit re-decision before starting: (a) proceed with Option B now, (b) lift only the prompt + DSL into Primy's *existing* renderer (cheapest, partial quality gain), or (c) defer until page-PMF.

## 6. Sequencing vs D1

Per the locked direction, the **HTML page is the hero** and ships first. The deck upgrade is four-format-completeness, not the spearpoint. Recommended order: page-first launch surface → deck spike (1 day, cheap, de-risks the option) → full graft only when decks earn it or four-format completeness is needed for the launch narrative. The user has elected to do it **now** (betting completeness aids the launch); honor that, but keep the 1-day spike as the go/no-go so "now" doesn't become a month.
