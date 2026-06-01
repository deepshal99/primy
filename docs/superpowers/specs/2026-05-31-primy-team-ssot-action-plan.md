# Primy Team-SSOT Rebranding — Implementation Action Plan

**Source PRD:** `.context/attachments/8Eaw3z/pasted_text_2026-05-31_16-51-59.txt`
**Owner:** Deepak · **Date:** 31 May 2026 · **Status:** Plan for execution
**Method:** Phased, LLM-friendly. Each phase is self-contained and copies from existing patterns.

---

## Phase 0 — Ground truth (current codebase state)

Verified by exploration. This is what we build *on top of*. Do not assume APIs beyond this list.

### Allowed patterns / APIs (cite these, don't invent)

| Concern | Current reality | File:line |
|---|---|---|
| Project ownership | **Single owner** — `projects.userId` FK → users.id, cascade delete | `src/db/schema.ts:37-61` |
| Access check (the ONE pattern) | `where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))` | `src/app/api/projects/[id]/route.ts:54, 337, 364` |
| Share (public, read-only) | `projects.shareToken` (nanoid 16), no auth, IP rate-limited | `src/app/api/share/[token]/route.ts:34-222` |
| Auth | NextAuth v5 JWT, credentials only. JWT = `{id, name, plan, proUntil}`. No org/role. | `src/lib/auth.ts:86-131`, `src/types/next-auth.d.ts:14-20` |
| Billing enforcement | `withPlanLimit(handler, {resource})` HOF. Flag-gated by `ENFORCE_PLAN_LIMITS` (default false). | `src/lib/billing/withPlanLimit.ts:67-123` |
| Plan limits | Per-user. `PLAN_LIMITS[free|pro]`. `workspaces`, `aiMessagesPerMonth`, etc. | `src/lib/plans.ts:36-57` |
| Usage metering | Atomic upsert keyed `(userId, month)`. Per-user, not per-team. | `src/lib/billing/usage.ts:75-82` |
| Gateway | `noopGateway` active; interface ready (`createCheckoutSession`, `parseWebhook`). | `src/lib/billing/gateway.ts:46-102` |
| Layout | 3-zone **floating** panels: NavRail 60px + floating Chat + Workspace. `bg-[#EAEAEA]`, `gap-2 p-2`, rounded-xl. **No top bar exists.** | `src/components/AppShell.tsx:162-200` |
| Tabs / entities | Single `currentEntityId`. `openTabs[]`. **No split view.** Deck present mode = `.doc-focus-mode` CSS. | `src/lib/store.ts:227-231`, `globals.css:822-832` |
| Design tokens | Heat `#ff4a00`, bg `#fafaf8`. Fonts: **Degular** (heading) + **Inter** (body). No Fraunces/Hanken. | `src/lib/design.ts`, `globals.css:1-3` |
| AI ops pipeline | Fenced blocks `sheetops/docops/kuops/tableops/deckops` → `parseAIResponse.ts` → `finishStreaming()`. | `parseAIResponse.ts:186-505`, `store.ts:262-828` |
| Model routing | Task-keyed `MODEL_REGISTRY`. `getModelConfig(task, ctxBytes)`. | `src/lib/ai/modelRouter.ts:12-40` |
| Linking | **None.** Only message-level `mentionedEntities`. No `entity://`, no propagation. | `src/lib/types.ts:159-168` |
| Realtime | **Nothing installed.** No Yjs/PartyKit/Liveblocks. Zustand + 2000ms debounced save. | `package.json` |
| Marketing | Landing `src/app/page.tsx`, pricing `src/app/pricing/page.tsx` (reads `plans.ts`). | — |
| Specs convention | `docs/superpowers/specs/*.md`, spec-first then build. `.claude/plans/` does **not** exist. | — |

### Anti-patterns to avoid
- ❌ Inventing a `workspaces` / `org` table in v1 — PRD open-Q#7 leans implicit. Keep **one org per account implicit**; defer explicit org table.
- ❌ Rewriting per-user usage metering into team aggregation in P1 — out of scope; scaffold only.
- ❌ Scattering new access checks. Centralize into one helper (see P1.2).
- ❌ Touching the fenced-ops block format without updating BOTH `systemPrompt.ts` and `parseAIResponse.ts`.
- ❌ Adding realtime deps before Phase 3.

### Key architectural decisions (locked for this plan)
1. **Keep `projects.userId`** as the creator pointer. Add `projectMembers` alongside. Backfill: every existing `projects.userId` → a `projectMembers` row with role `owner`. Access becomes membership-based, not ownership-based.
2. **Org = implicit** (one per account) in P1/P2. Revisit explicit org table only if billing demands it.
3. **HTML doc = distinct entity** (`projectPages` table, `pageops`), mirroring deck/sheet. (PRD §10.4 recommended.)
4. **Living links P1 = static reference chips**; real propagation engine is P2.
5. **Type direction:** keep Degular + Inter for the workspace; do NOT adopt Fraunces (PRD open-Q#2, risk §16). Edge-to-edge layout carries the premium feel.

---

## Phase 1 — Foundation: team SSOT + new interface

**Goal:** a team can live in a project together, safely. Mostly CRUD/auth/UI. High value, moderate effort.

> **Progress (31 May 2026):** ✅ **1.1 schema** (projectMembers/shareLinks/activityEvents + project context columns), ✅ **1.2 access control** (`src/lib/projectAccess.ts`; all 9 call sites + 3 create paths refactored; 11 unit tests; full suite 67/67 green; `tsc` clean). Migration `scripts/apply-team-ssot-schema.ts` (`npm run migrate:ssot`) written + idempotent — **not yet run against Neon**. Remaining P1: 1.3 membership UI · 1.4 interface redesign · 1.5 home/settings · 1.6 Brain · 1.7 locking · 1.8 pricing.

### 1.1 Data model — membership, sharing, activity, context
**Copy from:** the existing table style in `src/db/schema.ts` (text PK, projectId FK cascade, indexes).
Add tables:
- `projectMembers` — `(id, projectId FK, userId FK, role, invitedBy, status, createdAt)`. Roles: `owner|editor|commenter|viewer`. Unique `(projectId, userId)`. Indexes on both.
- `shareLinks` — `(id, projectId FK, entityId nullable, token unique, permission view|edit, createdBy, expiresAt nullable, createdAt)`. (Generalizes today's `projects.shareToken`.)
- `activityEvents` — `(id, projectId FK, actorId FK, verb, entityId nullable, meta jsonb, timestamp)`. Index `(projectId, timestamp)`.
- Project context: extend `projects` with `purpose`, `audience`, `voice`, `keyFacts`, `client`, `timeline`, `status` (or add `projectContext` table). **Coherence rule (PRD §9.3):** header chips, Brain, and Settings→Context all read this ONE store.

**Migration task:** write an idempotent backfill script (pattern: `scripts/apply-phase-2-schema.ts` referenced in history) that creates an `owner` `projectMembers` row for every existing project. Run `npx drizzle-kit push`.

**Verify:** `npx drizzle-kit push` succeeds; backfill produces 1 owner row per existing project; `SELECT count(*) FROM project_members` == count of projects with ≥1 entity.

### 1.2 Access control — centralize (CRITICAL, do before any UI)
**Copy from:** the access pattern at `projects/[id]/route.ts:54` — but invert it into a single reusable helper.
- Create `src/lib/auth/projectAccess.ts`: `requireProjectAccess(projectId, userId, minRole): Promise<{role}>`. Resolves via `projectMembers` (and `shareLinks` for link-scoped access). Returns 404 (not member) / 403 (insufficient role).
- Replace EVERY `eq(projects.userId, session.user.id)` call site with `requireProjectAccess`. Grep targets: `projects/[id]/route.ts`, `projects/[id]/share/route.ts`, `projects/[id]/messages`, `chat/route.ts`, snapshot/export routes.

**Verify:** grep for `projects.userId, session.user.id` returns zero in API routes; a non-member gets 404; a `viewer` gets 403 on PUT; owner passes.

### 1.3 Membership UI — invite, roles, share links
- Invite by email/link, role dropdown per member, remove. Surfaces in Project Settings → People & roles.
- Share links (view/edit) replace the single share token UI.
**Copy from:** existing share UI + settings tab patterns.
**Verify:** invite creates `projectMembers` row (status pending); role change persists; revoking a share link 404s the public route.

### 1.4 Interface redesign — Direction A (four fixed zones, edge-to-edge)
**This is the biggest UI change.** Current `AppShell.tsx` is floating panels with gaps; PRD wants edge-to-edge, hairline dividers, nothing floats/collapses.
- **New: Top bar** (does not exist today). Logo · breadcrumb switcher `Project ▾ / File ▾` · spacer · Brain · Share · avatar. The breadcrumb is the ONLY file switcher.
- **Sidebar:** keep NavRail but make it slim+labeled (~64-72px), always on, never collapses. Remove Cmd+K-only affordances per PRD (no command palette).
- **Chat:** always on (~300px), never collapses.
- **Work pane:** pure content, no nav chrome.
- Remove: `gap-2 p-2`, rounded-xl floating, `bg-[#EAEAEA]` gutters → continuous surface with hairline dividers (`rgba(0,0,0,0.08)`).
- **Split view:** allow a second entity beside the first (extends single `currentEntityId` → `splitEntityId`). **Present mode:** reuse `.doc-focus-mode` for deck/HTML full-screen (recovers width without collapsing chat).
**Apply:** `make-interfaces-feel-better` principles (concentric radius, optical alignment, staggered reveals, tabular numbers).
**Verify:** no floating gaps; sidebar+chat never collapse; breadcrumb switches project & file; split view opens 2 entities; present mode hides chrome but app remains responsive; `prefers-reduced-motion` respected.

### 1.5 Project home (front matter) + settings
**Copy from:** `ProjectHome.tsx` (extend) and existing Settings tab.
- Home header: identity (color/icon + name inline-edit) · purpose line · people stack + Invite · pulse meta (client/timeline/file count/last activity) · Share + Settings + New file.
- Files list: type filter chips (All/Docs/Sheets/Decks/HTML) + grid cards (type+color, last-edited, who) + recent-activity strip (reads `activityEvents`).
- Settings (v1-essential): General · People & roles · Sharing. (Context-for-AI, Brand kit, Danger zone follow in P2.)
**Verify:** edits to name/purpose persist to the single context store; activity strip renders real `activityEvents`; filter chips work.

### 1.6 Visible Project Brain (read-only view)
Top-bar button → slide-over showing what Primy knows: context (goal/audience/voice/keyFacts), connected artifacts + counts, recent decisions.
**Copy from:** `contextRelevance.ts` (already scores/lists entities) feeds the artifact list.
**Verify:** Brain reflects the same context store as header + settings (coherence rule); opens/closes as slide-over.

### 1.7 Concurrency safety (MUST-HAVE — PRD §13.3, risk §16)
Editing is single-player today (no safety). Before encouraging multi-user:
- Soft lock / "X is editing" indicator per entity + save-conflict warning (compare `updatedAt` on save; warn if server is newer).
**Verify:** two sessions editing the same entity → second sees "X is editing"; stale save is blocked with a warning, no silent overwrite.

### 1.8 Seat-based pricing scaffolding + watermark
- Add team/seat concepts to `plans.ts` (scaffold; keep `ENFORCE_PLAN_LIMITS=false`). Do NOT rewrite metering.
- Watermark off for paid (logic already in share route via `resolveOwnerPlan`).
**Verify:** pricing page renders seat tier from `plans.ts`; paid share has no watermark.

**Phase 1 exit criteria:** a team of 2+ can join one project, see home/activity/Brain, edit safely with conflict warnings, in the new edge-to-edge UI. Static reference chips only (no propagation yet).

---

## Phase 2 — The Moat: living links + HTML doc

**Goal:** make "source of truth" undeniable. Highest value; needs P1 foundation.

### 2.1 HTML doc entity (`projectPages` + `pageops`)
Mirror the deck/sheet path exactly.
- **Schema:** `projectPages` table (like `projectDecks`): `(id, projectId FK, title, html, editableFields jsonb, shareToken, createdAt, updatedAt)`.
- **Types** (`src/lib/types.ts`): add `ProjectPage`, `PageOperation`, extend `EntityType` with `"page"`, add `pages?: ProjectPage[]` to `Project`.
- **Parser** (`parseAIResponse.ts`): add `parsePageOperations()` — **copy `parseTableOperations` pattern (lines 289-310)**.
- **Ops apply:** `src/lib/ai/pageOperations.ts` → `applyPageOps()`.
- **System prompt** (`systemPrompt.ts`): add `pageops` routing rule (near line 48) + full spec (after docops, ~line 206).
- **Model router** (`modelRouter.ts`): add `html-generate` / `html-edit` tasks → Gemini (visual/spatial reasoning, like decks).
- **Store** (`store.ts`): add `createPage/updatePage/deletePage` (copy `createTable` lines 1434-1482); handle pageops in `finishStreaming`; add `"page"` to undo snapshot.
**Verify:** "make a landing page" emits `pageops`, opens a page tab, persists, exports; undo restores prior HTML.

### 2.2 Living links engine (FLAGSHIP)
**Needs:** stable entity field addressing + dependency index + editor invalidation.
- **Schema:** `entityLinks` — `(id, sourceEntityId, sourceField, targetEntityId, targetRef, projectId)`.
- Reference format `entity://type/id#field`. Resolution pass on render; propagation pass on source change with a visible pulse (source-colored value, click → source popover).
- Wire into Plate (docs/HTML) and Univer (sheet) update paths.
**Verify:** a deck/HTML value linked to a sheet cell updates with a pulse when the cell changes; click reveals source; the source sheet also highlights.

### 2.3 Brand kit
- **Schema:** `brandProfiles` — `(projectId, fonts, colors, logoBlob)`. Auto-extractable; applied to decks + HTML.
- Settings → Brand kit tab.
**Verify:** brand applies consistently to a generated deck and HTML page.

### 2.4 Editable/curatable Brain + Context-for-AI
- Brain becomes editable; Settings → Context-for-AI writes the same store (coherence rule).
- Context injection reads the shared Brain (`contextRelevance.ts`).

### 2.5 Comments + richer presence
- **Schema:** `comments` — `(id, entityId, authorId, anchor, body, resolved, createdAt)`.
- Presence (who's in an entity) — ephemeral (no durable table).

**Phase 2 exit criteria:** ≥1 artifact per active project carries a live link; HTML docs are first-class and data-bound; brand kit applied; Brain editable.

---

## Phase 3 — Real-time

**Goal:** simultaneous editing. Highest effort, lowest early marginal value — deliberately last.

### 3.1 Real-time co-editing
- Choose provider (open-Q#4: PartyKit vs Liveblocks vs self-hosted Yjs). Install deps (first realtime deps in repo).
- Per-entity CRDT documents; live cursors; presence channel; conflict-free merge. Replaces debounced-save single-player model for collaborative entities.
**Verify:** two users edit the same doc simultaneously; cursors visible; no lost edits.

### 3.2 Optional Connections view
- Artifact-graph as a toggle/view (not the front door). PRD §8.2 deferred.

---

## Cross-cutting workstreams (run alongside)

- **Repositioning copy:** landing (`src/app/page.tsx`) + pricing → "The shared source of truth where your team's work happens." (Phase 1, parallel.) Use `copywriting` skill.
- **Living reference docs:** update `documents/platform-docs.md` (team entities), `documents/vision.md` (promote team from v1.2 to active), `documents/ICPs.md` (team-first ICP). Spec-first precedent.
- **Tests:** repo uses Vitest (56 tests). Add coverage for `requireProjectAccess`, parser `pageops`, link resolution.

---

## Recommended execution order (efficiency)

```
P1.1 schema  ─▶ P1.2 access helper ─▶ P1.3 membership UI ─▶ P1.5 home/settings ─▶ P1.6 Brain ─▶ P1.7 locking ─▶ P1.8 pricing
           (backend track)
P1.4 interface redesign  ─────────────────────────────────▶ (frontend track, parallel to backend)
repositioning copy ──────────────────────────────────────▶ (parallel)
─────────────────────────────────────────────────────────────────────────────────
P2.1 HTML entity ─▶ P2.2 living links ─▶ P2.3 brand ─▶ P2.4 Brain edit ─▶ P2.5 comments
─────────────────────────────────────────────────────────────────────────────────
P3.1 realtime ─▶ P3.2 connections view
```

P1.1 → P1.2 is the critical path: schema then centralized access. Everything member-aware depends on it. The interface redesign (P1.4) and copy run in parallel with the backend track.

---

## Open decisions to resolve before P1 build (from PRD §17)
1. HTML data model → **decided: distinct `projectPages`**.
2. Type direction → **decided: keep Degular+Inter** (no Fraunces).
3. Sidebar Home vs Projects → resolve in P1.4 (recommend: Home = this project, Projects = switcher).
4. Realtime provider → defer to P3.
5. Pricing specifics (seat price, free limits, grandfathering) → needed for P1.8.
6. Connections view → P3 toggle.
7. Org layer → **decided: implicit (one per account)** in P1/P2.
