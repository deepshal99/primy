# Primy — Engineering TODOs

Deferred work captured from reviews. Each item has enough context to pick up cold.
Source: CEO review 2026-06-03 (`docs/superpowers/specs/2026-06-03-primy-d1-direction.md`).

## Status (2026-06-03)
- ✅ **T1 DONE** — `src/lib/ai/opParseFailures.ts` (sink + per-family drop detector), wired into `parseAIResponse.ts` + `ChatPanel.tsx`. Tests: `tests/lib/ai/opParseFailures.test.ts`.
- ✅ **T2 DONE** — `src/lib/ai/opSchemas.ts` (zod gate, validates at each `parseXOperations` return). Tests: `tests/lib/ai/opSchemas.test.ts`.
- ◻️ **T3 PARTIAL** — pure first slice done (`src/lib/ai/opPlan.ts` + tests). The deep Immer-mutation extraction from `store.ts` `finishStreaming` REMAINS (see T3 note below).
- ✅ **T4 DONE** (investigation) — see `2026-06-03-allweone-deck-port-plan.md` §0/§5. **Finding flips the plan:** ALLWEONE slides are Plate trees, not HTML; no cheap graft. Re-decision needed.
- Verification: full suite 194 tests pass, `tsc --noEmit` clean.

---

## T1 — Systemic AI-op parse-failure surface  ·  P1  ·  M  ·  ✅ DONE

**What:** Route every silent op-parse failure in `src/lib/ai/parseAIResponse.ts` through one
`reportOpParseFailure(blockType, raw)` sink, and surface a user-visible recovery affordance when
operations were expected but none applied ("Primy couldn't apply that — retry?").

**Why:** This is the product's #1 silent failure. On a malformed AI op block the parser returns
`[]`/`null` with at most a `console.warn` — and many warns are gated `if (NODE_ENV !== "production")`
(parseAIResponse.ts:254, 270, 339, 364, 549, 555). So **in production a malformed operation vanishes
with zero signal**: no log, no metric, no user message. The user just sees "I don't see the page/sheet."
For the D1 persona (a consultant mid-deliverable) this is the failure most likely to lose the exact
user the product is built for.

**Current state:** Failures are patched case-by-case (pageops fenceless salvage, deckops salvage,
schema-anchored HTML extraction) — bailing water, not fixing the hull. There is no central failure path.

**Where to start:** grep `return [];` / `return null;` / `console.warn("[Primy` in parseAIResponse.ts;
funnel each through one sink that (1) logs to a real prod sink (not a gated console), (2) increments a
metric, (3) signals the caller that an expected op block failed so the store/UI can show a retry CTA.

**Depends on / pairs with:** T2 (do them together).

---

## T2 — Zod-validated AI-op boundary  ·  P1  ·  M (~2d, pairs with T1)

**What:** A zod schema per op block type (`sheetops` / `docops` / `deckops` / `pageops` / `tableops`),
validated at parse time. Replace `any`/`as any` at the op boundary with the inferred types.

**Why:** The AI-operation boundary is `any`-typed (136 `any`/`as any` app-wide, concentrated in the chat
route + parser). The types lie exactly where failures happen — the memory'd `AI_DownloadError` deck gotcha
says it: "tsc passes either way; ONLY a live run catches it." A validated boundary converts a whole class
of silent runtime drops into caught, named, surfaced errors (feeding T1's sink).

**Where to start:** define schemas mirroring `DeckOperation`, `PageOperation`, etc. in `src/lib/types.ts`;
parse blocks through `schema.safeParse`; on failure → T1's `reportOpParseFailure`.

**Depends on:** none. Pairs with T1.

---

## T3 — Extract op-application reducer from `store.ts`  ·  P2  ·  L  ·  ◻️ PARTIAL

**Done — slice 0 (classification):** pure decode logic in `src/lib/ai/opPlan.ts`
(`opFamilyCounts`/`hasAnyOps`/`presentFamilies`), used by ChatPanel.

**Done — slice 1 (KU mutation):** the ~100-line knowledge-unit op switch is lifted out of
`finishStreaming` into pure `src/lib/ai/applyKuOps.ts` (9 characterization tests). `finishStreaming`
now calls it and reads the result back. Verified by tsc + full suite + a live doc-create smoke. The
characterization pass caught a real latent divergence (APPEND wasn't recording produced/aiModifiedIds).
This establishes the safe pattern: `apply<Entity>Ops(entities, ops, view, ctx) -> {entities, view, produced, aiModifiedIds}`.

**Still remaining (slices 2–4):** the **table**, **deck**, and **page** op switches in `finishStreaming`
follow the identical pattern — each is a mechanical lift into `applyTableOps`/`applyDeckOps`/`applyPageOps`
with its own characterization tests, then a verbatim wire-in + live smoke. Do them one at a time (never
all at once) so each stays verifiable. The undo-snapshot + debounced-save plumbing stays in the store.

Original framing below.

**What:** Lift op application out of `finishStreaming` into a typed, unit-tested reducer; first slice of
de-godding the 3,127-LOC store.

**Why:** `store.ts` is the largest file and the single source of client truth. `finishStreaming` inlines
all op application (deck/page/sheet/ku/table) and threads `deckVersion`/undo/redo through one mega-function
(~lines 495–1160). It's the most likely host for the next silent bug (deckVersion/undo interplay). A typed
reducer is testable in isolation and pairs naturally with T2's typed ops.

**Where to start:** extract the `hasDeckOps`/`hasPageOps`/... apply branches into `applyOps(state, ops)`;
unit-test nil/empty/malformed/partial-batch inputs. Do NOT big-bang the whole store — one slice at a time.

**Depends on:** smoother after T2 (typed ops to reduce over).

---

## T4 — ALLWEONE deck-engine output spike  ·  P2  ·  S (1 day)

**What:** The go/no-go gate from `docs/superpowers/specs/2026-06-03-allweone-deck-port-plan.md` §1.
Stand up ALLWEONE (`github.com/allweonedev/presentation-ai`, MIT), generate 5 decks from real Primy-user
content, compare side-by-side against Primy's current deck output.

**Why:** De-risks the deck bet for ~$0 before any port. Primy already has a convergent outline-first,
HTML-slide, Plate-based deck system — so the port is a quality upgrade, not an engine swap, and only worth
it if ALLWEONE's output is *visibly* better. The spike names exactly what to lift (templates? prompts?).

**Exit criterion:** go/no-go + a one-paragraph "what we're lifting and why." If output isn't clearly
better → abort, keep Primy's engine, redirect to Pages (the D1 hero).

**Depends on:** none. Gates the full port (3–7d if GO).

---

## Notes
- Recommended order: **T1+T2 together** (the reliability fix that protects the D1 moment), then **T4**
  (cheap deck de-risk), then **T3** (debt paydown) as capacity allows.
- T1/T2 are the highest-leverage work in the codebase right now per the CEO review.
