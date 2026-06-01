# GOAL — Primy Layout Overhaul (top bar + floating panes + motion system)

**Owner:** Deepak · **Date:** 31 May 2026 · **Status:** Active goal
**Approved design:** `src/app/preview/topbar/page.tsx` (route `/preview/topbar`) — the agreed target.

## The goal (definition of done)
Replace the current floating 3-pane shell with the **approved top-bar layout**, applied
consistently across the **whole app** with **no discrepancies or inconsistencies**, and a
cohesive **motion/micro-interaction system** — so the app looks visually excellent and works
seamlessly. Done means:
- New shell is live in `/app` (not just the preview) for every state: Home → Project → File.
- Animations follow the `emil-design-eng` framework + transitions.dev patterns, respect
  `prefers-reduced-motion`, and never animate keyboard/high-frequency actions.
- `npm run build` passes, `tsc --noEmit` clean, `npm run test` green (incl. new tests).
- Verified in-browser (auto-login) across the three states + mobile.
- No dead code from the old NavRail/TabBar shell; nothing references removed layout pieces.

## Target layout (from the approved preview)
Three nav levels — **Home (all projects) → Project (overview + files) → File (editor)**.
- **Top bar** (on the warm canvas, transparent — not a white bar): logo (→ Home) · breadcrumb
  `Project ▾ / File ▾` · (Saved + Undo/Redo only when a file is open) · **Brain** (project scope) ·
  **Share** · avatar. Logo + sidebar **Home** return to all-projects; `Project ▾` switches projects;
  `File ▾` switches/opens files (replaces the tab row).
- **Sidebar** (on the canvas, NOT a card): **Home · Search · New · Settings**. "Projects" is removed
  (redundant with Home). Home lit only at the global-home level.
- **Chat** (floating card): width `25vw`, min 320 / max 420px; the real two-row input.
- **Work pane** (floating card): Home = all-projects grid + recent activity; Project = overview +
  files grid; File = the entity editor with its own toolbar (Preview/HTML/Present for pages, etc.).
- Warm canvas `#ecebe6`-ish; floating cards `rounded-2xl`, soft shadow, hairline border, gaps.

## Motion system (emil-design-eng + transitions.dev)
Create `src/styles/motion.css` (imported by globals) with strong custom easings and copy-paste
utilities. Apply per the emil decision framework.
- **Easings:** `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`,
  `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`. Keep existing `--duration-*`.
- **Buttons / pressables:** `:active { transform: scale(0.97) }`, `transition: transform 140ms ease-out`.
- **Cards (project/file):** hover lift (`translateY(-2px)` + shadow), entrance `scale(0.96)+opacity` (never scale(0)), **stagger** 30–60ms.
- **Popovers/dropdowns/breadcrumb menus:** origin-aware (`transform-origin` from trigger), 150–200ms ease-out, enter from `scale(0.97)+opacity`. Modals stay center-origin.
- **transitions.dev patterns to adopt:** Icon swap (scale+blur), Text-states swap (blur) for save state, Menu dropdown (origin-aware), Success check (Saved), Number pop-in (counts/usage), Avatar group hover (member stacks), Error shake (failed save/invalid), Panel reveal (slide-over Brain).
- **Rules:** only animate `transform`/`opacity`; UI animations < 300ms; exit faster than enter; never animate keyboard-initiated/100×-a-day actions; `@media (prefers-reduced-motion: reduce)` keeps opacity, drops movement; gate hover behind `@media (hover:hover) and (pointer:fine)`.

## Component contracts (new files under `src/components/shell/`)
- **`TopBar.tsx`** — wired to store: logo→Home (clear currentEntity/Project to home view), `Breadcrumb`, Brain (opens Brain slide-over — stub if not built), Share (existing ShareModal), avatar (existing settings/profile menu). Save state + Undo/Redo render only when a file is open (reuse store `isSaving/saveError/lastSavedAt/undo/redo/canUndo/canRedo`).
- **`Sidebar.tsx`** — on canvas: Home (→ project list / clears current project), Search (fires `primy:open-search`), New (creates project or opens new-file), Settings (SettingsModal). Active = Home at global-home.
- **`Breadcrumb.tsx`** — `Project ▾` lists projects (store `projects`, `switchProject`) + New project; `File ▾` (only when a file open) lists open + all files (`openKnowledgeUnit/openTable/openDeck/openPage`) + "All files…". Origin-aware dropdowns.
- **`AppShell.tsx`** (rewrite) — renders TopBar + Sidebar (canvas) + floating Chat + floating Work pane; preserves: keyboard shortcuts, onboarding gate, mobile responsive (chat/workspace toggle), `sheetVersion` behavior, deck **present mode**. Removes NavRail; folds TabBar actions (undo/redo/save/share/export) into TopBar; drops the tab row + curve connectors.
- **Global home view** — a real `GlobalHome` component (all projects + recent activity) shown when no project is open; project home stays `ProjectHome`.

## Migration hazards (MUST handle — from codebase map)
1. **`.doc-focus-mode`** selectors in `globals.css:822-832` target `[data-nav-rail]`, `[data-chat-panel]`, `[data-tab-bar]`. Update to new shell data-attrs (`[data-top-bar]`, `[data-sidebar]`, `[data-chat-panel]`) so deck/page **Present mode** still hides chrome.
2. **TabBar curve connectors** (SVG, hardcoded white) — remove; the breadcrumb replaces tabs.
3. **z-index**: top bar/sidebar below modals (200+) and dropdowns (50). Use ~40/35.
4. **Mobile**: keep the chat⇄workspace toggle; on mobile the top bar collapses sensibly.
5. **Onboarding gate** in AppShell must still run before projects load.
6. **sheetVersion** remount key must be preserved on the sheet panel.
7. **Auth bypass / dev** unaffected (DevAutoLogin stays).

## Phased plan (how the agent team executes)
- **P0 Foundation (parallel, additive new files — zero risk to running app):** `motion.css`; `Sidebar.tsx`; `Breadcrumb.tsx`; `TopBar.tsx`; `GlobalHome.tsx`. Each wired to the real store, typed, `tsc`-clean in isolation.
- **P1 Integration (single owner — interdependent):** rewrite `AppShell.tsx` to compose the new shell; update `globals.css` focus-mode selectors; remove NavRail/TabBar-row usage; keep WorkspacePanel editor rendering + entity toolbars. `tsc` + `build` must pass.
- **P2 Polish (parallel by component, no shared-file conflicts):** apply motion utilities to buttons, cards (stagger + hover), dropdowns (origin-aware), chat input, save-state (icon-swap + success-check), file/project cards (entrance). Each agent owns distinct component files; none edit `globals.css`/`motion.css`.
- **P3 Verify:** `tsc --noEmit`, `npm run build`, `npm run test`; an adversarial reviewer checks against the emil checklist (no `transition: all`, no `scale(0)`, no `ease-in` on UI, durations < 300ms, reduced-motion, hover-gating). Then human-in-the-loop browser QA (owner) across the 3 states + mobile.

## Testing
- Unit: keep 75 passing; add tests for any new pure helpers (e.g. breadcrumb file-list builder, view-state derivation).
- Build/type: `tsc --noEmit` + `npm run build` are gates.
- Visual/behavioral: browser QA on `/app` (auto-login) — Home grid, open project, open each entity type, switch via breadcrumb, Brain/Share/Settings, undo/redo/save, present mode, reduced-motion.

## Non-goals (this overhaul)
Living-link engine, real-time co-edit, new entity types, billing changes. Pure layout + motion + consistency.
