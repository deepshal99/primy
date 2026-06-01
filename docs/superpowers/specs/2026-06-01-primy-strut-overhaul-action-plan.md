# Primy UI/UX Overhaul — Strut-Inspired Redesign Action Plan

**Date:** 2026-06-01
**Status:** Proposed (awaiting branding-shift confirmation)
**Locked reference:** `/preview/strut` (`src/app/preview/strut/page.tsx`)
**Supersedes design section of:** `CLAUDE.md`, `docs/superpowers/specs/2026-05-31-primy-layout-overhaul-goal.md`

---

## 0. Strategy

The `/preview/strut` mock is locked. It **is the spec** — it already encodes the new brand,
the new shell layout, the unified editor chrome, the three workspace views (board / kanban /
timeline), and the docked chat pane.

**Approach: strangler migration, not rewrite.** Extract tokens *from* the preview into the real
token layer, then swap real surfaces one at a time behind a feature flag. The preview proves both
the system and the shell simultaneously, so the token layer and shell chrome ship together. Real
editor bodies (Plate / Univer / deck / page) are preserved and re-parented into the new chrome.

**Why not "system in a vacuum, then overhaul":** abstract token work drifts from the locked look,
and a big-bang swap is unshippable mid-flight. Interleaving keeps every phase demoable.

---

## 1. Pivotal decision — BRANDING SHIFT (blocking)

Locking the preview is a rebrand, not a relayout. Confirm before any code:

| Aspect | Current (`CLAUDE.md`) | Locked preview |
|---|---|---|
| Brand mark | `#ff4a00` / `#fa5d19` orange | **Black** wordmark + custom logomark |
| Primary accent | orange `heat` scale | amber `#FFB43F` |
| Shell surface | white `#fff`, canvas `#EAEAEA` | warm near-white `#FCFBF8`, sidebar `#F7F7F4` |
| Secondary accents | entity colors (doc-blue/sheet-green/deck-orange) | candy set: blue `#4285F4`, pink `#F073A7`, purple `#8757D7`, teal `#67CEC8` — used as **workspace dots**, not entity codes |
| Entity icons | colorful, entity-coded | **monochrome** gray `#585753` |
| Dark mode | partial | full (`DARK` theme in preview) |

**Consequence:** the "Design System" + "Design Context" sections of `CLAUDE.md` must be rewritten,
and `documents/styleguide.md` updated. The entity-color rule ("use entity colors consistently
across tabs/icons/badges") is **reversed** — color moves to workspace identity, entities go
monochrome.

**→ Decision needed:** approve orange→black/amber rebrand? (Default assumption: yes, it's locked.)

---

## 2. Phases

Each phase is independently shippable and verifiable (`tsc --noEmit` + `test:run` + visual check).
Flag: `NEXT_PUBLIC_SHELL_V2` (or route `/app` vs `/app-legacy`) gates the new shell until Phase 7.

### Phase 1 — Token layer (foundation)
Extract the preview's `LIGHT`/`DARK` objects into the real system. No app behavior changes yet.

- Rewrite `src/lib/design.ts` colors to the preview palette (keep the token *shape*; swap values).
- Rewrite the CSS-variable block in `src/app/globals.css` (light + dark) to match.
- Add new tokens the preview introduced: `inputBg`, `ink/ink2/ink3/ink4` text ramp, `shadowCard/shadowLift/shadowPane`, candy accents, `accentSoft`.
- Keep `var()` indirection so dark mode is automatic.
- **Verify:** `/preview/strut` still renders identically; existing app renders with new (transitional) colors without layout breakage.

### Phase 2 — Primitives reskin
Re-style the 16 `src/components/ui/*` primitives + shared atoms to the new tokens. Pure visual.

- `button`, `input`, `card`, `dialog`, `popover`, `dropdown-menu`, `context-menu`, `tooltip`, `tabs`, `badge`, `empty-state`, `separator`, `scroll-area`, `skeleton`, `switch`, loader.
- Radius/shadow/border pass per preview (cards `12px`, pills `full`, `borderStrong` outlines).
- Extract reusable atoms *from* the preview into real components: `WorkspaceDot`, `NavRow`, `Tree`/`Leaf` (sidebar), `LogoMark`, `ToolbarBtn`, `StageMarker`, entity-preview tiles.
- **Verify:** primitives gallery / existing modals look on-brand.

### Phase 3 — Shell layout (the big one)
Rebuild `AppShell` + `shell/*` to the preview's three-zone layout, behind the flag.

- **Sidebar (`232px`):** brand mark + theme toggle; Inbox/Quick Note/Search nav; **Workspaces** tree (project → folder → entity, expandable); other-projects list; footer (Voice & Tone, Help, account row). Replaces the 52px icon rail.
- **Topbar (`64px`):** breadcrumb / back-button; Share; **board/kanban/timeline** view toggle pill; voice + overflow + chat-toggle buttons.
- **Docked chat pane (`430px`, floating rounded card):** branded header + Beta pill, hero landscape, message area, pill input. Re-parents the real `ChatPanel` internals.
- **Focus mode:** full-bleed editor (preview already has it).
- Wire to the real Zustand store (`src/lib/store.ts`) — projects, active entity, chat. **Do not** rewrite store logic; adapt selectors.
- **Verify:** new shell loads real projects, opens real entities, chat streams.

### Phase 4 — Workspace views (board / kanban / timeline)
Port `BoardView` / `KanbanView` / `TimelineView` from preview, fed by real entity data.

- Replace `ProjectHome.tsx` (1126 LOC, 4 separate grids) with the unified board (folders as
  sections) + kanban + timeline. This is the biggest single deletion/rewrite.
- Per-entity card previews (doc prose / sheet grid / deck slide / page mock) → real thumbnails.
- `GlobalHome.tsx` (all-projects) reskinned to match.
- **Verify:** all entity types render correct previews; view switching works; empty states.

### Phase 5 — Unified editor shell
Wrap all four editors in one identical chrome (`OpenEntityShell` from preview).

- One toolbar for every type: title, save state, type button, Focus, overflow.
- Re-parent real bodies into the chrome: `DocView` (Plate), `SheetView` (Univer), `DeckBuilder`, `PagePanel`. **Bodies unchanged**; only the surrounding chrome unifies.
- Reconcile per-editor toolbars (`DocToolbar`, `SheetAIBar`, deck controls) with the shared shell — decide what lives in shell chrome vs. editor-local.
- Export menus / history button / share moved into the unified overflow.
- **Verify:** each editor opens in the shell, edits + saves, focus mode works, export/history intact.

### Phase 6 — Folders / nesting (DATA MODEL — backend)
The one non-cosmetic gap. Preview shows project → folder → entity; real model is flat.

- **Schema:** add `folders` table (id, projectId, name, color, order) + `folderId` nullable FK on `knowledgeUnits` / `projectTables` / `projectDecks` / pages. `npx drizzle-kit push`.
- **Migration:** existing entities → default "All files" folder (or null = ungrouped bucket).
- **Store + API:** folder CRUD, move-entity-to-folder, reorder; update `/api/projects/[id]` save shape.
- **UI:** sidebar tree create/rename/recolor/delete folder; drag entity between folders/board columns.
- **Verify:** create/rename/delete folder; move entity; reload persists; existing projects migrate cleanly.

### Phase 7 — Cutover + peripheral surfaces
Flip the flag; sweep everything the new shell doesn't auto-cover.

- Remove flag; `/app` → new shell; delete legacy `AppShell` path + dead `ProjectHome` grids.
- **Modals/overlays** to new tokens: `SettingsModal`, `ShareModal`, `VersionHistoryPanel`, `CustomInstructionsModal`, `SearchDialog`, `KeyboardShortcuts`.
- **Chat internals:** `MessageBubble`, `ChatInput`, `ExamplePrompts`, `SuggestionChips`, `FilePreviewPill`, `SlashCommandMenu` → new look.
- **Deck generation states** (`DeckGatheringView`, `DeckGeneratingView`) reskinned.
- **Marketing + auth** (`/`, `/login`, `/onboarding`, `/pricing`, reset pages, `share/[token]`) → new brand. Black wordmark, amber accent, warm surfaces.
- **Docs:** rewrite `CLAUDE.md` design section + `documents/styleguide.md`.
- Delete `/preview/strut` and `/preview/topbar` once their value is absorbed.
- **Verify:** full QA pass (use `qa` skill), dark mode end-to-end, mobile responsive, `prefers-reduced-motion`.

---

## 3. Coverage checklist ("nothing left behind")

- [ ] Tokens: `design.ts` + `globals.css` (light + dark)
- [ ] 16 UI primitives + shared atoms
- [ ] Sidebar, Topbar, Breadcrumb, GlobalHome
- [ ] Chat pane + 9 chat sub-components
- [ ] Board / Kanban / Timeline views
- [ ] ProjectHome replacement
- [ ] Unified editor shell + 4 editor bodies (doc/sheet/deck/page)
- [ ] Editor toolbars, export menus, version history, custom instructions
- [ ] Folders schema + migration + CRUD + drag
- [ ] Settings / Share / Search / Shortcuts modals
- [ ] Deck generation states
- [ ] Marketing landing + pricing
- [ ] Auth: login / onboarding / forgot / reset / share-token
- [ ] Focus mode + full dark mode + mobile + reduced-motion
- [ ] Docs: CLAUDE.md + styleguide.md
- [ ] Delete preview routes + legacy shell

## 4. Risks / watch-outs

- **Univer + Plate theming** are hardest to bend to new tokens (third-party DOM). Budget time in Phase 5.
- **Folder migration** must be reversible and not orphan entities. Backfill carefully.
- **Mobile:** preview is desktop-only (fixed `232px` + `430px`). Needs a responsive collapse story — not yet designed.
- **Deck-intent misroute gotcha** (project memory): don't let new chat UX retrigger `deck-generate` on generic verbs.
- **Team SSOT access control** (project memory): folder API routes must use `requireProjectAccess`.

## 5. Sequencing note

Phases 1–2 are low-risk and unlock everything; do them first regardless. Phase 6 (folders) can run
in parallel with 3–5 since it's backend. Phase 7 is the only irreversible step (flag removal) —
gate it on a full QA pass.
