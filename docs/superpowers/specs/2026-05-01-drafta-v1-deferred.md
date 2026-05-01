# Drafta v1.0 — Deferred Work

**Date:** 2026-05-01
**Status:** Active. Pick up after usage cap resets or manually.

The Phase 4 (slash commands, snapshot history) and launch-prep (Phases 5+6 docs) agents hit a usage cap mid-execution. The portions they completed are solid, compile cleanly, and pass tests — but the UI integration and the bulk of the launch docs were not written.

## What landed (committed)

### Phase 4 — partial

| Surface | Status |
|---|---|
| `src/lib/ai/slashCommands.ts` | ✅ Complete — 10-command registry (4 starter + 6 pro), shared `SlashCommand` type, `getSlashCommand`, `availableSlashCommands(plan)` helpers |
| `src/app/api/snapshots/[type]/[id]/route.ts` | ✅ GET list (metadata only) + POST create, plan-aware retention (auto-prune oldest) |
| `src/app/api/snapshots/[type]/[id]/[snapshotId]/route.ts` | ✅ GET single (with content) + POST restore (creates pre-restore snapshot first) |

### Phase 5+6 — partial

| Doc | Status |
|---|---|
| `docs/launch/twitter-build-in-public-thread.md` | ✅ Complete — 30-day build-in-public calendar |

## What's deferred (TODO)

### Phase 4 — slash command UI (~3 hours)

1. **`src/components/chat/SlashCommandMenu.tsx`** (new) — popover listing available commands, plan-aware muting/upsell on pro commands, keyboard navigation, filter-as-you-type.
2. **`src/components/chat/ChatInput.tsx`** (edit) — detect `/` at input position 0, render `<SlashCommandMenu/>`, on selection insert command tag and pass `{ slashCommand, slashContext }` to `onSend`.
3. **`src/app/api/chat/route.ts`** (edit) — parse `slashCommand` and `slashContext` from request body. If valid command + plan permits, append `command.systemPromptFor({ projectTitle })` to composed system prompt. Silently fall back if pro user gates fail.

### Phase 4 — snapshot history UI (~3 hours)

4. **`src/components/snapshots/VersionHistoryPanel.tsx`** (new) — Radix Dialog showing version timeline, "Save version now" action, restore confirmation, skeleton loading, empty state.
5. **`src/components/doc/DocView.tsx`** + **`SheetView.tsx`** + **`DeckBuilder.tsx`** (edits) — add "History" button in toolbar that opens `VersionHistoryPanel`.
6. **`src/lib/store.ts`** (edit) — auto-snapshot on AI edit completion. Hook into `finishStreaming()`. Fire-and-forget `POST /api/snapshots/[type]/[id]`. Debounce: skip if last snapshot for this artifact was <2 min ago.

### Phase 5+6 — remaining launch docs (~3-4 hours)

7. `docs/launch/product-hunt-launch.md` — PH playbook (tagline, description, first comment, asset list, hunter strategy, hour-by-hour timeline).
8. `docs/launch/indiehackers-post.md` — long-form launch post (1200-1800 words).
9. `docs/launch/linkedin-organic.md` — 5 post drafts + ad targeting strategy.
10. `docs/launch/beta-invitation-template.md` — 50-user outreach playbook (DM templates, follow-ups, weekly feedback asks).
11. `docs/launch/payment-gateway-integration-plan.md` — Paddle / Lemon Squeezy / Razorpay comparison + recommendation + 6-day integration plan.

## Suggested resume order

1. Item 6 (auto-snapshot in store) — small, unlocks user trust signal even without the UI
2. Item 4 (VersionHistoryPanel) + Item 5 (toolbar buttons) — pair them; ship together
3. Items 1–3 (slash command UI) — ship together; the registry and APIs are ready
4. Items 7–11 (launch docs) — write under your own voice; the agent draft of the Twitter calendar is in the same dir as a stylistic anchor

## Verification before resuming

The current branch state is green:
- `npx tsc --noEmit` — clean
- `npm run test:run` — 56/56 passing
- `npm run build` — green, all routes registered including the two snapshot endpoints
- Schema applied to Neon, 8 users granted 60-day Pro grace
