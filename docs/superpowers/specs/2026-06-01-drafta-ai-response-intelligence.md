# Drafta AI — Response Intelligence Plan

**Date:** 2026-06-01
**Goal:** Smarter, sharper replies. Lead with substance. Concise + action-oriented when there IS an action. When there's no action, just answer like a smart colleague. Always context-aware.

> **STATUS (2026-06-01): SHIPPED & verified (tsc + production build clean).** The prompt restructure (Intent Gate + Voice + Context) and the complexity-based reasoning-effort boost are live. The remaining "real intelligence" levers — context-selection quality and an eval set — are documented as the next phase (not yet built).

## Implementation status

**Done**
- `systemPrompt.ts` — new authoritative top section: **"How to respond — READ FIRST"** (ANSWER / ACT / ASK intent gate), **Voice** (lead with the answer, concise, one next-step), and **Context awareness** (resolve "it/this", edit the open entity, don't recreate). Softened the two over-action rules (old "NEVER long text → always make a doc" and the Q&A duplicate) to deliverable-based rules.
- `draftaTools.ts` — `TOOL_ROUTING_PROMPT` now opens with "if the user only asked a question, don't call a tool — just reply," so tools can't re-introduce the over-action bias.
- `route.ts` — **complexity-based effort routing**: a message matching strategy/analysis/planning intent bumps gpt-5.x `reasoningEffort` to `high` for a sharper answer; everyday asks stay on `low` for latency. Safe — only applied to candidates that already carry a `reasoningEffort` (never the gpt-4.1 fallback).

**Next phase (the other ~30% of "smarter") — not yet built**
- **Context-selection quality.** Today: top-3 keyword/embedding relevance. The AI is only as smart as what it sees; if the wrong files are injected it looks dumb regardless of prompt. Tighten scoring, raise/curate the budget, and consider always including the open entity + recently-touched files.
- **Eval set.** ~20–30 real prompts + the QA matrix below, run before/after each prompt or model change, so "smarter" is measured, not guessed.

---

## Why it feels un-smart today (grounded in `systemPrompt.ts`)

1. **Over-biased to action.** Line 47: *"NEVER respond with long text in chat … you MUST create a document."* Line 285: *"If the answer would be longer than a short paragraph, create a document."* → the model spins up a doc even when the user just asked a **question** or is thinking out loud. There is no clean "should I act at all?" gate — the prompt assumes every substantial reply becomes an artifact.
2. **No voice/style contract.** Conciseness is implied (verbosity:low) but there's no explicit "lead with the answer, no preamble, no hedging" rule, so replies restate the question, add filler, and offer 3 generic follow-ups.
3. **Context injected but not decisively used.** `<active_entity>`, `<project_context>`, recent turns are all in the prompt, but nothing tells the model to resolve "it/this", prefer editing the open entity, or avoid recreating what exists.

Model settings are already good (gpt-5.5, reasoningEffort:low, verbosity:low) — the fix is the **prompt**, not the model. Low risk, high impact.

---

## The plan — restructure the top of `systemPrompt.ts`

### 1. Intent Gate (decide BEFORE doing) — the key change
Add, as the first instruction block, a 3-way decision the model makes every message:

- **ACT** — user wants something created/edited/built/organized (imperative verbs: create, build, add, make, update, turn into, track…). → Do it via the matching tool, then a **one-line** confirmation.
- **ANSWER** — user asks a question, wants an opinion/explanation, or is just talking (question words, "what do you think", "explain", "why", casual chat). → **Reply in chat. No artifact.** Create a document ONLY if the user explicitly wants a deliverable, or the content is clearly something they'd want to keep/edit (a draft, a long structured piece they asked for).
- **ASK** — genuinely ambiguous or missing a critical detail. → One sharp clarifying question. No artifact.

This **replaces** the blanket "long answer → always create a doc." New rule of thumb: *create a doc when the user wants a **deliverable**, not merely because the reply is long.* "Explain X in depth" → answer in chat (or offer to save it). "Write me a doc on X" → create it.

### 2. Voice & Response Style (new section)
- **Lead with the answer/result in sentence one.** No "Sure!", no preamble, no restating the question.
- **Concise:** shortest complete reply. Default 1–3 sentences in chat; expand only when the question truly needs it.
- **Action-oriented:** after acting, confirm in one line and offer **at most one** high-value next step — not three generic ones.
- **Confident & plain:** no filler, no hedging, no apologizing, no "I think maybe".
- **Match the user's energy:** terse question → terse answer; exploratory → a little more room.
- Respect `<project_memory>` tone/audience over these defaults.

### 3. Context-awareness rules (tighten)
- Resolve "it / this / that / the doc" to the **`<active_entity>`** or the last artifact created.
- When the user wants to change what they're looking at → **edit the open entity**, don't create a new one.
- Never recreate something that already exists in `<project_context>` — reference or extend it.
- Use project context to pick the right target and to avoid asking for info you already have.

### 4. Reconcile the contradictions
- Soften line 47 and line 285 to the deliverable-based rule above (keep the spirit: don't dump a 2-page essay into a chat bubble — but only when it's actually deliverable content).
- **Keep** "NEVER promise without delivering" (reliability) and the create-vs-edit routing rules.

### 5. Tool prompt alignment (`draftaTools.ts`)
Add one line to `TOOL_ROUTING_PROMPT`: *"If the user only asked a question or is chatting, do NOT call a tool — just reply. Tools are for creating/editing artifacts."* Prevents the tools from re-introducing the over-action bias.

### 6. (Optional) verbosity per need
Keep `verbosity: low` globally. If ANSWER-mode replies feel clipped in testing, raise chat to `medium` — but try prompt-only first.

---

## Files
- `src/lib/ai/systemPrompt.ts` — new Intent Gate + Voice section at top; soften lines 47/285; tighten context rules. (~80% of the work, all text.)
- `src/lib/ai/draftaTools.ts` — one line in `TOOL_ROUTING_PROMPT`.
- `src/lib/ai/modelRouter.ts` — only if verbosity needs bumping after QA.

## Validation matrix (must pass)
| Input | Expected |
|---|---|
| "what's a good pricing model for SaaS?" | Text answer in chat. **No doc.** |
| "draft a pricing one-pager" | `create_page`/`create_document`, 1-line confirm. |
| "make it shorter" (doc open) | `edit_document` on the open doc. |
| "explain how CAC works" | Concise chat answer; optionally offer to save. |
| "help me with marketing" | One clarifying question. No artifact. |
| "add a column for status" (sheet open) | Sheet edit, 1-line confirm. |
| "thanks!" / "nice" | Short, human reply. No artifact, no forced follow-up. |

## Risk
Low — prompt-only. Tools + dual-accept already guarantee that when the model DOES act, it lands. This change moves the act/answer boundary, so the matrix above is the QA gate. No schema or flow changes.
