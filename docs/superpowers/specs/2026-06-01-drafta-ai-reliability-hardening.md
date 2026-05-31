# Drafta AI — Reliability Hardening Plan

**Date:** 2026-06-01
**Goal:** AI never silently fails. Every create/edit either lands and auto-opens, or shows a clear, recoverable error. Concise responses. Always-on indicators ("Creating doc…", "Editing sheet…").

---

## 1. Why it breaks today (grounded root causes)

All confirmed by reading the code.

### RC-1 — Operations are free-text JSON in the prose stream (the big one)
The model must hand-write valid JSON inside a fenced block (` ```kuops `, ` ```tableops `, …) **inside the same prose message**, and `parseAIResponse.ts` extracts it with best-effort fallbacks (`parseAIResponse.ts:63-164`, 5 recovery strategies, returns `null` on failure — `:114`).

Failure chain for *"says it created something but nothing exists"*:
- Model writes prose "I've created the Budget Tracker…" but the block is malformed / missing `type` field / unclosed fence.
- `robustJsonParse` → `null` → 0 operations → **no entity created → nothing to auto-open**.
- Auto-open is correctly gated on the entity actually being created (`store.ts:434,541,643,760`), so a parse miss = no tab, no file.
- There is a guard (`ChatPanel.tsx:433-438`) that toasts an error *only if* a fence string is present but parsed to zero. If the model claims success in prose with **no fence at all**, nothing warns.

### RC-2 — No finish-reason / truncation detection anywhere (the "vanishes mid-stream")
AI SDK v6 `fullStream` emits a `finish` part carrying `finishReason` (`stop` | `length` | …) and `usage`. `route.ts` handles only `text-delta`, `source`, `error` (`route.ts:400-410`) — it **ignores `finish` entirely**.
- When the model hits `maxOutputTokens`, it stops mid-sentence / mid-JSON-block. `finishReason: "length"`.
- No continuation, no retry, no "cut off" signal. The half-written block fails to parse (RC-1). User sees a truncated message that "vanishes" with no entity.
- This is the mechanical cause of "starts responding, stops in between."

### RC-3 — Wrong model tier + uncontrolled sampling
- Default chat model is `gpt-4.1-mini` (`modelRouter.ts:36`); heavy/deck on `gpt-4.1` (`:37-39`).
- **`temperature` is never set** (`route.ts:385-395`) → OpenAI default (~1.0). High randomness on a mini model = inconsistent JSON formatting = the "needs 2-3 asks" symptom.
- No `reasoning.effort`, no `verbosity` controls.

### RC-4 — Indicators are weak
`aiPhase` exists (`thinking|streaming|updating|done`) but there is no per-action status. The user never sees "Creating document…" / "Editing spreadsheet…" tied to the actual operation in flight.

### RC-5 — Stuck-state edge paths
`finishStreaming` is the only path out of `isStreaming` (`store.ts:279`). A 3-min safety timer exists (`ChatPanel.tsx:50-62`), but several throw-paths can leave `isStreaming: true` until that fires. Recovery is slow, not guaranteed-fast.

---

## 2. The solution — two layers

**Layer A** = reliability hardening on the *current* architecture. Low risk, ships in days, kills ~80% of failures.
**Layer B** = the architectural fix that makes it *structurally impossible* to fail silently. This is the real "never breaks" answer.

Ship A first (fast wins), then B (durable).

---

## LAYER A — Reliability Hardening (ship first)

### A1 — Move to the best OpenAI model + control sampling
OpenAI's current flagship is **GPT-5.5** (GPT-5.4-mini for the cheap/fast path), with `reasoning.effort` (`none|low|medium|high|xhigh`) and `text.verbosity` (`low|medium|high`). OpenAI now recommends native **Structured Outputs over in-prompt schemas** and the **Responses API**.

Registry change (`modelRouter.ts`):

| Task | New model | reasoning.effort | verbosity | maxOut |
|------|-----------|------------------|-----------|--------|
| chat | `gpt-5.5` | `low` | `low` | 16384 |
| chat-heavy | `gpt-5.5` | `medium` | `low` | 32768 |
| deck-generate | `gpt-5.5` | `medium` | `medium` | 32768 |
| deck-edit | `gpt-5.5` | `low` | `low` | 32768 |
| title | `gpt-5.4-mini` | `none` | `low` | 256 |
| web-search | `gpt-5.4-mini` | `low` | `low` | 8192 |
| summarize | `gpt-5.5` | `low` | `low` | 4096 |

- `verbosity: low` → concise on-point chat replies (the user's explicit ask). System-prompt "1-3 sentences in chat" rule already reinforces this (`systemPrompt.ts:47-48`).
- `reasoning.effort: low/medium` → consistent structured output without latency blowup. GPT-5.5 hits targets with *fewer* reasoning tokens, so latency stays sane.
- Wire via AI SDK `providerOptions.openai` (`reasoningEffort`, `textVerbosity`) in `route.ts:385-395`.
- Keep the existing ordered-candidate fallback chain (`modelRouter.ts:112-155`); update the resilience fallback target from `gpt-4.1` → `gpt-5.5`.
- Discipline: change model → pin effort → eval → iterate (one change at a time).

### A2 — Finish-reason handling + auto-continuation (kills RC-2)
In the `fullStream` loop (`route.ts:397-411`) add:
```
else if (part.type === "finish") { finishReason = part.finishReason; usage = part.usage; }
```
- Stream a final control frame to the client: `data: {"done": {"finishReason","usage"}}` before `[DONE]`.
- **Auto-continue on truncation:** if `finishReason === "length"` AND an operation block was left open, transparently issue a continuation turn (append assistant partial + a "continue exactly where you stopped, no preamble" user turn) and keep streaming into the same response. Cap at 2 continuations. This makes large decks/sheets that exceed `maxOutputTokens` complete instead of vanishing.
- If still truncated after caps → emit explicit `{"error":"Response was cut off"}` + offer a one-tap "Continue" in the UI. Never silent.

### A3 — Claim/action reconciliation (kills RC-1's silent half)
Today the zero-op warning only fires when a fence string is present (`ChatPanel.tsx:433-438`). Strengthen:
- After parsing, if the prose contains a **creation/edit claim** ("created", "added", "I've made", "updated the…") but **zero operations parsed**, treat as a failure: show a clear toast and **auto-retry once** with a corrective system note ("Your previous reply claimed an action but emitted no valid operation block — re-emit the operation block now").
- Detection: lightweight regex/intent check on `displayText` vs. parsed-op count. Conservative — only fires on strong claim verbs to avoid false positives.

### A4 — Always-on indicators (RC-4)
Drive a live status pill from the operation type detected during streaming:
- As soon as an opening fence is seen in `streamingContent` (` ```kuops `→"Creating document…", ` ```tableops `→"Creating spreadsheet…", ` ```sheetops `→"Editing spreadsheet…", ` ```docops `→"Editing document…", ` ```deckops `→"Building deck…"), set a `streamingAction` field in the store.
- Render it in the chat composer + on the target tab. Clears on `finishStreaming`.
- On success, the existing toasts (`store.ts:867-901`) confirm. Indicator → confirmation is now continuous.

### A5 — Bulletproof stuck-state (RC-5)
- Wrap the client stream consumer so **`finishStreaming` or `abortStreaming` is guaranteed** via `finally` (`ChatPanel.tsx:370-500`). No throw path can leave `isStreaming: true`.
- Tighten the safety timer from 3 min → 45 s, and have it also clear `streamingAction`.
- Server: ensure `[DONE]` is always the last frame even on the outer catch (already mostly true `route.ts:443-453`; add the `finish`/usage frame before it).

### A6 — Concise responses (explicit ask)
- `text.verbosity: low` (A1) + keep `systemPrompt.ts:47-48` "never long text in chat; put content in the doc."
- Trim system prompt redundancy where it encourages narration.

**Layer A edge-case coverage**

| Edge case | Handled by |
|-----------|-----------|
| Model truncates at token limit (`length`) | A2 auto-continue → explicit "Continue" |
| Claims action, emits no block | A3 reconciliation + auto-retry |
| Malformed/unclosed JSON block | A3 (zero-op detection) + existing repair (`parseAIResponse.ts:103-164`) |
| Inconsistent formatting / "needs 2-3 asks" | A1 model+sampling, A3 auto-retry |
| Stream hangs, `isStreaming` stuck | A5 `finally` + 45s timer |
| Rambling / long chat replies | A1 verbosity:low + A6 |
| No visible feedback during work | A4 indicators |
| Provider 429 / outage | existing candidate fallback (`modelRouter.ts`) |

---

## LAYER B — Structured tool calls (the "fail-proof" architecture)

Layer A hardens the fragile path. Layer B *removes* it. This is the senior-engineer answer to "never break no matter what."

### B1 — Replace fenced-JSON-in-prose with AI SDK tool calls + Zod schemas
Define real tools the model invokes (schema-enforced via Structured Outputs):
`createDocument`, `editDocument`, `createSpreadsheet`, `editSpreadsheet`, `createDeck`, `editDeck`, `createPage`, `deleteEntity`, `renameEntity`.

Why this is structurally fail-proof:
- **JSON is always valid** — the schema is enforced by the API, not hand-written by the model. RC-1 disappears.
- **Claim ⇒ action are the same act** — to "create a doc" the model *must call the tool*. It is impossible to claim in prose without acting. RC-1's silent half disappears.
- **Prose stays prose** — the chat message is purely the brief summary. Verbosity:low keeps it tight.
- Operations stop being parsed out of text → `parseAIResponse.ts` becomes a thin compatibility shim, then is retired.

### B2 — Stream tool lifecycle → deterministic indicators + reliable auto-open
- AI SDK streams `tool-call` start/args/finish parts. Map them 1:1 to UI:
  - `tool-call` start → indicator "Creating document…" (exact, not guessed from fences).
  - `tool-result` → apply to store, **auto-open the entity** (optimistic open on start, confirm on result).
- Auto-open becomes guaranteed and immediate, tied to a real event — not to best-effort text parsing.

### B3 — Idempotency + reconciliation
- Each tool call carries a client-generated `opId`; store dedupes so a retried/continued stream can't double-create.
- Server returns the created entity id in the tool result; client reconciles optimistic → confirmed, or rolls back + errors on failure. No "ghost" entities.

### B4 — Migration path (keep the app working throughout)
1. Add tools alongside the existing fenced-block parser (dual-accept).
2. Switch `systemPrompt.ts` routing rules to instruct tool use; keep fenced blocks as fallback for one release.
3. Verify tool path in prod, watch the zero-op/error rate drop.
4. Remove fenced-block emission from the prompt; keep parser as read-only safety net.
5. Retire parser once tool path is proven.

**Layer B edge-case coverage (beyond A)**

| Edge case | Handled by |
|-----------|-----------|
| Any malformed-JSON class of bug | B1 — schema-enforced, cannot occur |
| Claim-without-action | B1 — claim *is* the tool call |
| Wrong indicator / no auto-open | B2 — driven by real tool events |
| Double-create on retry/continuation | B3 — `opId` idempotency |
| Partial apply on mid-stream abort | B3 — per-tool atomic apply + reconcile |

---

## 3. Sequencing

- **Phase 1 (days):** A1 (model+sampling), A2 (finish-reason + continuation), A5 (stuck-state), A4 (indicators). Highest ROI.
- **Phase 2 (days):** A3 (reconciliation + auto-retry), A6 (conciseness polish). Eval pass.
- **Phase 3 (1–2 wks):** B1–B3 behind dual-accept. Ship, monitor.
- **Phase 4:** B4 cleanup — retire fenced-block emission.

## 4. How we'll know it worked (metrics)
- Add structured logging: per request log `finishReason`, op-count, claim-vs-action mismatch, continuation count, candidate used.
- Target: silent-failure rate (claim with 0 ops) → ~0; truncation-without-recovery → 0; "needs 2-3 asks" → single-shot success rate up and tracked.

## 5. Files to touch
- `src/lib/ai/modelRouter.ts` — model registry, fallback target (A1).
- `src/app/api/chat/route.ts` — `finish` handling, continuation, `providerOptions` (A1/A2), tool wiring (B1).
- `src/components/chat/ChatPanel.tsx` — `finally` guard, reconciliation, indicators, tool-event consumption (A3/A4/A5/B2).
- `src/lib/store.ts` — `streamingAction` state, idempotent apply, tool-result auto-open (A4/B2/B3).
- `src/lib/ai/systemPrompt.ts` — conciseness + tool-use routing (A6/B1).
- `src/lib/ai/parseAIResponse.ts` — becomes fallback shim, later retired (B4).
- `src/lib/ai/tools.ts` (new) — Zod tool schemas (B1).

---

## Appendix — the "prompt throwing error" question

The error in the transcript:
`API Error: 400 messages.3.content.28: 'thinking' or 'redacted_thinking' blocks in the latest assistant message cannot be modified.`

This is **not** a Drafta bug. It's a Claude Code session/transport error: a prior assistant turn contained an extended-**thinking** block, and on resend the harness altered/re-ordered that block (Anthropic's API forbids mutating thinking blocks once produced — common when a message is edited/retried, or a tool result is injected into a turn that already emitted thinking).

**Workaround:** start a fresh conversation rather than editing/retrying the message that already produced thinking; or disable interleaved/extended thinking for that session. That's why the resend eventually went through — a clean turn has no prior thinking block to violate.
