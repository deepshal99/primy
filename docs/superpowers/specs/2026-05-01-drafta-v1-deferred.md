# Drafta v1.0 — Deferred Work (CLEARED)

**Date:** 2026-05-01
**Status:** ✅ All items resolved.

This file originally tracked Phase 4 + launch-prep work that was paused mid-execution when parallel agents hit a usage cap. Everything below has now been shipped. Keeping the file as an audit trail.

## Resolution log

### Phase 4 — completed (commit `a62b70f`)

| # | Item | Resolved by |
|---|---|---|
| 1 | `src/components/chat/SlashCommandMenu.tsx` | Direct write — popover with keyboard nav, plan-aware muting, Tab autocomplete |
| 2 | ChatInput slash detection + menu wiring | Direct edit — leading "/" detection at position 0, replace-prefix-with-name on select |
| 3 | `/api/chat` slash command parsing + system prompt augmentation | Direct edit — regex match leading `/<name>`, getSlashCommand lookup, append systemPromptFor(ctx) when plan permits |
| 4 | `src/components/snapshots/VersionHistoryPanel.tsx` | Direct write — Radix Dialog, manual save with optional label, restore confirmation, EmptyState/Skeleton |
| 5 | History buttons in DocView/SheetView/DeckBuilder | Direct write — `ArtifactHistoryButton` mounted in WorkspacePanel toolbar group |
| 6 | Auto-snapshot in `store.ts` on AI edit | Direct write — `src/lib/snapshots/scheduler.ts` (2-min debounce per artifact) + `finishStreaming()` hook |
| (bonus) | Restore endpoint that was missing from the partial | Direct write — `/api/snapshots/[type]/[id]/[snapshotId]/restore/route.ts` writes pre-restore snapshot, applies content, returns for client refresh |

### Launch prep — completed (commit `a8baca7`)

| # | Item | Resolved by |
|---|---|---|
| 7 | `docs/launch/product-hunt-launch.md` | Direct write — taglines, description, intro post, asset list, comment templates, hour-by-hour day-of timeline |
| 8 | `docs/launch/indiehackers-post.md` | Direct write — ~1500-word launch story, pivot reasoning, cuts list, architecture decisions, ask |
| 9 | `docs/launch/linkedin-organic.md` | Direct write — 5 post drafts, sponsored campaign targeting, connection/DM templates |
| 10 | `docs/launch/beta-invitation-template.md` | Direct write — 5 archetypes, multi-channel DM templates, onboarding/feedback/testimonial cadence |
| 11 | `docs/launch/payment-gateway-integration-plan.md` | Direct write — Paddle/Lemon Squeezy/Razorpay/Dodo comparison, recommendation, 6-day Lemon Squeezy implementation guide with code |

## Final state

- All 6 phase commits shipped
- 56 tests pass; tsc clean; build green
- Schema applied to Neon DB
- 8 existing users grandfathered with 60-day Pro grace until 2026-06-30
- All 6 launch docs ready to ship
- No outstanding deferred work

Branch is shippable. Next external action is for the founder: pick payment gateway when ready, follow the integration plan, flip `ENFORCE_PLAN_LIMITS=true`, ship.
