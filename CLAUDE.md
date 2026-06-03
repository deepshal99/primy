# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Primy AI is an AI-powered workspace where users create and manage documents, spreadsheets, presentation decks, and HTML pages — all connected through a chat-based AI assistant. **OpenAI is the sole provider currently routed** (chat, deck generate/edit/critique, title, summarize, embeddings); a Google/Gemini client is still wired but no task routes to it today. Beyond the per-project workspace, two global surfaces sit in the sidebar: **Library** (your workspaces lensed by ownership: "Created by me" vs "Shared with me") and **Quick Note** (frictionless capture into a dedicated Quick Notes workspace).

## Strategy & Positioning

**Hero:** "The AI workspace for docs, sheets, and decks."
**Sub:** "Chat to create and edit them all. Drag in any file. Project memory keeps everything connected — so you never copy-paste from ChatGPT again."

See `docs/superpowers/specs/2026-05-01-primy-v1-strategy.md` for full strategic context, ICPs, and execution roadmap. See `docs/superpowers/specs/2026-05-01-primy-v1-eng-review.md` for engineering decisions.

## Commands

```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (watch)
npm run test:run     # Vitest (single run, CI)
npm run dev:admin    # Seed/refresh the local dev admin (admin@primy.local / admin)
npm run seed:demo    # Seed demo data
npm run migrate:ssot # Apply team-SSOT schema
npm run migrate:grace# Grant founding-member grace
npx drizzle-kit push # Push schema changes to Neon PostgreSQL
```

**Testing**: Vitest is configured (`tests/`, ~14 files incl. `lib/deck/*`, `lib/billing/*`, `parseAIResponse`, `projectAccess`, `opPromotion`, `plans`). Run `npm run test:run` before shipping. There is no E2E suite — feature verification is done by driving the running app in a browser.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Database**: Drizzle ORM + Neon PostgreSQL (serverless)
- **Auth**: NextAuth v5 (credentials + JWT)
- **State**: Zustand v5 + Immer (client-side, debounced sync to server)
- **Server state**: TanStack Query v5
- **AI**: Vercel AI SDK 6 (`ai` + `@ai-sdk/openai` + `@ai-sdk/google`) — dual-provider capable; **only OpenAI is routed today**
- **Sheets**: Univer (Fortune Sheet migration complete)
- **Docs**: Plate.js v52 (Slate-based rich text) — also backs Quick Notes
- **Inline Mermaid**: Plate.js fenced-code rendering
- **Decks**: Custom slide system with pptxgenjs export + Puppeteer/Chromium PDF; an agentic **deck-refine** pipeline (critique → repair) is in progress (`src/lib/ai/deck/`, `src/lib/deck/`, `/api/deck-refine`)
- **Auth hardening**: revocable sessions via `tokenVersion`, durable login throttle, breached-password check, password reset, "log out everywhere"

## Architecture

### Entity System

Four entity types live inside a **Project**:

| Entity | Type Key | DB Table | Content Format |
|--------|----------|----------|----------------|
| Document | `ku` (KnowledgeUnit) | `knowledgeUnits` | Plate.js JSON / Markdown |
| Spreadsheet | `table` | `projectTables` | Univer `celldata[]` (jsonb) |
| Deck | `deck` | `projectDecks` | `DeckSlide[]` with ThemeConfig (jsonb) |
| Page | `page` | `projectPages` | Sanitized HTML + editable fields |

Entities can be grouped into **Folders** within a project, and a Document can be moved across workspaces (the Quick Note → "Move to workspace" promote path).

### AI Provider & Model Routing

Model selection is task-keyed (registry in `src/lib/ai/modelRouter.ts`). Each task is hard-mapped to a model — there is no global `AI_PROVIDER` switch. **Everything currently routes to OpenAI** (the registry is the source of truth; the header comment in that file predates this and is itself being kept honest):

| Task | Provider | Model | Max Output |
|------|----------|-------|------------|
| `chat` | openai | gpt-4.1 | 16,384 |
| `chat-heavy` (>30KB context) | openai | gpt-4.1 | 32,768 |
| `chat-deep` (complex reasoning) | openai | gpt-5.5 (effort: medium, verbosity: low) | 32,768 |
| `page-generate` (visual HTML page intent) | openai | gpt-5-mini (effort: medium, verbosity: high) | 32,768 |
| `deck-generate` | openai | gpt-4.1 | 32,768 |
| `deck-edit` | openai | gpt-4.1 | 32,768 |
| `deck-critique` | openai | gpt-4.1 | 2,048 |
| `title` / `web-search` | openai | gpt-4.1-mini | 256 / 8,192 |
| `summarize` | openai | gpt-4.1 | 4,096 |
| `embedding` | openai | text-embedding-3-small | — |

`getModelConfig(task, contextSizeBytes?)` auto-promotes `chat` → `chat-heavy` past the 30KB threshold. The chat route also escalates by **intent**: complex-reasoning phrasing → `chat-deep`, and **visual-page intent** ("landing page", "one-pager", "make this visual", editing an open page) → `page-generate` (gpt-5-mini, verbosity high — benchmarked ~6× cheaper / ~40% faster than gpt-5.5 at near-equal design quality; both reasoning models far out-design gpt-4.1). `useTools` is captured before this escalation, so the `create_page` tool stays available. **`OPENAI_API_KEY` is required.** `GEMINI_API_KEY` is still read for a lazily-created Google client, but no task routes to Google today (effectively dormant).

### AI Operation Flow

1. User sends message → `POST /api/chat` with context injection (sheet CSV, doc content, project memory)
2. `modelRouter.ts` selects model by task and context size (>30KB routes to heavier model for chat)
3. AI streams response with JSON operations inside fenced blocks
4. `parseAIResponse.ts` extracts operations from block types: `sheetops`, `docops`, `kuops`, `tableops`, `deckops`, `pageops`
5. `finishStreaming()` in the store applies operations, opens new entity tabs, triggers debounced save

### Context Injection

`contextRelevance.ts` scores KUs and tables by keyword matching + optional embedding similarity. Top 3 of each get full content injected into the system prompt; the rest get summaries in a `project_context` block.

### State Management (`src/lib/store.ts`)

This is the largest file in the codebase. All client-side state lives in a single Zustand store with Immer for immutable updates. Key patterns:
- **Debounced save**: Projects save after 2000ms of inactivity, sheets after 800ms
- **Version tracking**: `sheetVersion` counter forces Fortune Sheet remount after AI operations
- **Undo/redo**: Snapshot-based, stored in Zustand state
- **Entity CRUD**: `createKnowledgeUnit()` / `createTable()` / `createDeck()` / `createPage()` + `open*`/`rename*`/`delete*` per type
- **Recents**: `recents[]` (localStorage, cap 40, deduped) recorded in every `open*` path; `recordRecent`/`removeRecent`
- **Quick Note**: `ensureQuickNotesProject()` lazily provisions one dedicated "Quick Notes" workspace; `createQuickNote()` and `moveKnowledgeUnitToProject()` (optimistic promote, background server sync)

### Navigation surfaces (V2 shell)

`AppShellV2` (the active shell) renders three things in the main area, by precedence: a **system view** (`systemView: "library" | "notes" | "trash" | null`), then the per-project board/editor, then the full-screen chat hero when no project is open. The sidebar nav rows are **Quick Note**, **Library**, **Search** (⌘K), **What's next**, **Trash**. The Quick Notes workspace is hidden from the Workspaces tree and surfaced only via the pinned Quick Note row. **Library** (`LibraryView`) is a workspace gallery split into "Created by me" / "Shared with me" using ownership from the list endpoint (`isOwner`/`ownerName`/`orgId` on `projects`); each card summarizes its contents (entity counts). It replaced the old Recents surface. File-level "created by me" (inside shared workspaces) is a fast-follow needing a per-entity `createdBy` column.

### Key Files

- `src/lib/store.ts` — All app state and actions
- `src/lib/types.ts` — Core TypeScript interfaces (CellData, SheetOperation, DocOperation, etc.)
- `src/lib/design.ts` — Design token system (import as `design`)
- `src/lib/ai/systemPrompt.ts` — 27KB master system prompt with routing rules for all operation types
- `src/lib/ai/parseAIResponse.ts` — Fenced block JSON extraction with fallback strategies
- `src/lib/ai/modelRouter.ts` — Task-keyed model registry (OpenAI today; Google client dormant)
- `src/app/api/chat/route.ts` — Main streaming chat endpoint
- `src/db/schema.ts` — Drizzle PostgreSQL table definitions
- `src/components/shell/v2/AppShellV2.tsx` — **Active shell** (Strut overhaul). Default; legacy `src/components/AppShell.tsx` still reachable via `/app?shell=v1`
- `src/components/shell/v2/LibraryView.tsx` / `QuickNotesView.tsx` — the two global surfaces
- `src/lib/auth.ts` — NextAuth v5 config (credentials, throttle, tokenVersion revocation, dev-admin bypass)
- `src/components/ui/transitions/` — drop-in micro-interaction primitives (`IconSwap`, `AnimatedNumber`, `TextReveal`) wrapping verbatim [transitions.dev](https://transitions.dev) snippets. CSS lives in the "transitions.dev primitives" block in `globals.css` (namespaced `t-*`, reduced-motion guarded; kept separate from the in-house `motion.css` layer). The `transitions-dev` skill (`transitions reveal|review|apply`) drives adding more.

### API Routes

- `POST /api/chat` — Streaming AI response (SSE) with full context
- `GET/POST /api/projects` — Project listing and creation
- `GET/PUT/DELETE /api/projects/[id]` — Project fetch, update, delete (debounced save target; KU/table/deck/page upserts, deletes, folder + entity-folder moves)
- `GET /api/projects/[id]/messages` — Paginated message history
- `POST /api/projects/[id]/share` — Generate/revoke project share token
- `GET/POST /api/projects/[id]/members` — Team membership (SSOT access control)
- `POST /api/deck-refine` — Agentic deck critique/repair pass (WIP)
- `POST /api/extract` — File text extraction (PDF, DOCX, XLSX, ZIP)
- `POST /api/embeddings` — Generate embeddings for semantic search
- `POST /api/export/pdf` — Server-side PDF generation (Puppeteer/Chromium)
- `POST /api/unsplash` — Search Unsplash for deck images
- `*/api/snapshots/[type]/[id]/...` — Artifact version history + restore
- `GET /api/share/[token]` — Public sharing (no auth required)
- `GET /api/usage` — Plan usage counters
- `POST /api/title` — Auto-generate project title from content
- `GET /api/user` · `POST /api/user/logout-all` — Profile; revoke all sessions
- `*/api/auth/[...nextauth]` · `/api/auth/forgot-password` · `/api/auth/reset-password` — Auth
- `GET /api/cron/prune-snapshots` — Scheduled snapshot pruning

File uploads go directly to Vercel Blob from the client (no `/api/upload` route); `src/db/schema.ts` tracks blob usage for orphan recovery.

## Design System

Strut-inspired warm shell (overhaul locked 1 Jun 2026; reference `/preview/strut`). CSS variables in `globals.css`. Tokens in `src/lib/design.ts`. Full action plan: `docs/superpowers/specs/2026-06-01-primy-strut-overhaul-action-plan.md`.

- **Brand**: **black wordmark + ink `#1A1815`** primary fill (white text on it). The brand is NOT orange anymore — the legacy `#fa5d19`/`#ff4a00` oranges were swept out across the codebase.
- **Brand mark**: the canonical Primy glyph is the four ink bars in `LogoMark` (`src/components/shared/Logo.tsx`, scalable SVG via `currentColor`). Use it for brand/AI identity moments (sidebar header, chat "Primy" avatar, empty-state chips). **Never use the lucide `Sparkles` star icon anywhere — it is banned.** For AI-action affordances use `Wand2`; for premium/Pro badges use `Crown`; for generic "create/new" use `Plus`.
- **Warm accent (amber)**: `#FFB43F` — AI signal, highlights, soft pills, active dots. For amber **text** on light, use the readable deep amber `#B87426` (never `#FFB43F` for text — too light).
- **Candy accents** (used as **workspace identity dots**, not entity coding): blue `#4285F4`, pink `#F073A7`, purple `#8757D7`, teal `#67CEC8`. Blue `#4285F4` is the interactive/active/link color.
- **Fonts**: Inter (UI/body, weights 400/450/500/600/700 — headings use 500), Geist Mono (code)
- **Entity colors** (board/kanban grouping only; **entity icons are monochrome** `var(--icon)`): doc blue `#4285F4`, sheet forest `#42c366`, deck amber `#FFAD45`, page purple `#8757D7`
- **Surfaces**: warm near-white `#FCFBF8` base, card `#FFFDFB`, sidebar `#F7F7F4`, canvas `#F3F2EF`. Full `.dark` block exists (Strut DARK palette) and is now **end-to-end across the authenticated app** (shell, chat, board, settings/billing modals, doc/sheet/deck/page chrome). Toggle = `useDarkMode` (`.dark` on `<html>`, persisted `primy:theme`); an anti-FOUC inline script in `layout.tsx` applies it before first paint. **Dark adapts only via tokens** — use CSS vars / semantic Tailwind classes (`bg-card`, `text-muted-foreground`, `border-border`, `var(--ink)`…), NEVER hardcoded literals (`bg-white`, `text-[#171717]`). Two deliberate exceptions stay light: **content "paper"** (rendered deck slides, page iframe, doc-page illustration thumbnails) and **public marketing/auth/share pages** (dark toggle isn't reachable pre-auth). The **Univer sheet grid follows dark mode** via `univerAPI.toggleDarkMode()` synced to the theme (`SheetView.tsx`); the public read-only sheet (`SheetViewReadOnly`, share pages only) stays light.
- **Borders**: `rgba(24,24,22,0.08)` default (`--border`), `rgba(24,24,22,0.12)` strong (`--border-strong`), `rgba(24,24,22,0.04)` faint — alpha, NOT hex.
- **Text hierarchy** (`--ink` ramp): `#171716` primary / `#3B3A37` secondary / `#706E68` tertiary / `#B9B6AE` muted.
- **Shadows**: `--shadow-card` / `--shadow-lift` / `--shadow-pane` (warm, ink-tinted). Use `.press` / `.lift` / `.hover-row` utilities for interaction feel.
- **Radius**: Pixel-based — 4/6/8/12/16/full. Buttons+inputs=6-8px, cards=12px, panes/modals=14px.

Reach for tokens (`var(--ink)`, `var(--accent-amber)`, `var(--card)`, …) — never hardcode the old oranges. Color signals **workspace identity** (the per-project dot), not entity type; entity icons stay monochrome.

### Motion (MANDATORY for any animation work)

**`documents/motion.md` is the canonical motion ruleset** — read it before adding or changing any transition/animation. It is grounded in the `emil-design-eng` skill + `transitions-dev` skill. Essentials:

- **One token source:** `--duration-*` / `--ease-*` are declared ONCE in `globals.css :root`. Never re-declare them (that silently shadows). `motion.css` and `design.ts` only reference them.
- **One CSS home + helpers:** every reusable motion class lives in `src/styles/motion.css` (`.press`/`.lift`/`.menu-pop`/`.hover-row`/`.stagger-in`/`.icon-swap`/`.success-pop`/`.shake` + the `t-icon-swap`/`t-digit-group`/`t-stagger` primitives). The React helpers in `src/components/ui/transitions/*` (`IconSwap`/`AnimatedNumber`/`TextReveal`) are typed wrappers over those `t-*` classes — not a second system.
- **Hard rules:** animate only `transform`/`opacity`/`filter`; no `transition: all`; never `scale(0)` entries; no `ease-in` on UI; UI < 300ms (320ms ceiling); exits faster than enters; popovers origin-aware (modals centered); every movement rule degrades under `prefers-reduced-motion`; gate hover behind `(hover:hover)`.
- **Enforce:** run `npm run lint:motion` (`scripts/check-motion.mjs`) before shipping motion changes — it must stay at 0 errors.

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT signing secret
- `NEXTAUTH_URL` — App URL (e.g. `http://localhost:3000`)
- `OPENAI_API_KEY` — OpenAI API key (**required** — the only provider currently routed: chat, deck, title, summarize, embeddings)
- `GEMINI_API_KEY` — Google AI API key (read for a dormant Google client; no task routes to it today)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob storage
- `NEXT_PUBLIC_DEV_AUTH_BYPASS` — dev only; auto-signs-in as the dev admin. **Never set in production.**

## Conventions

- Path alias: `@/` maps to `src/`
- All API routes use Next.js App Router (`src/app/api/*/route.ts`)
- The store is the single source of truth for client state — components read from store, AI operations write to store
- AI operations are JSON objects inside fenced code blocks (e.g. `` ```sheetops [...] ``` ``). Never change the block format without updating both `systemPrompt.ts` and `parseAIResponse.ts`
- Spreadsheet data uses Fortune Sheet's `celldata[]` format (sparse array of `{r, c, v}` objects), not 2D arrays
- The `sheetVersion` counter must be incremented after any programmatic sheet mutation to trigger re-render
- File uploads: max 100MB per file, max 10 files per message. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, images, ZIP
- **No em-dashes in interface copy (MANDATORY).** Never use `—` (U+2014) in any user-facing UI string we author: labels, titles, placeholders, tooltips, toasts, empty states, marketing/auth copy, metadata. Use a comma, colon, period, or parentheses instead — never a bare hyphen swap. This rule covers chrome only; do NOT strip em-dashes from user-generated content (documents, notes, sheet cells) or from code comments. AI system-prompt files (`src/lib/ai/*`) are out of scope.

## Product & Strategy Documents

The `/documents/` folder contains living reference docs that inform all development decisions. **Read these before making architectural or UX choices.**

- **`documents/platform-docs.md`** — Complete feature inventory: every screen, interaction, and capability described in detail. The single source of truth for what the product does.
- **`documents/ICPs.md`** — Ideal Customer Profiles: dossiers on each customer archetype (solo founders, marketers, SMB operators, students). Use to guide UX, copy, and feature prioritization.
- **`documents/styleguide.md`** — Visual style guide: colors, typography, spacing, component patterns, and the overall visual feel. All UI must be compliant.
- **`documents/motion.md`** — Canonical motion & transition ruleset (tokens, decision framework, pattern→primitive map, enforcement). Read before any animation work; enforced via `npm run lint:motion`.
- **`documents/vision.md`** — Product vision and roadmap with milestones (v1.1 → v2.0). Gives exploratory work guidance and context.
- **`documents/data-reference.md`** — Domain data relationships, implicit business logic, and entity hierarchies not expressed in the DB schema alone.

When building features, always check these docs for context. When making decisions that affect product direction, update the relevant doc.

## Active Migration Plan

Several module upgrades are planned (see `.claude/plans/`):
- jsPDF → Puppeteer server-side PDF (export) — resolved (Puppeteer is now in deps)
- Yjs + PartyKit (real-time collaboration) — Deferred to v1.2+

## Design Context

### Users
Solo founders, marketers, SMB operators, and students who need to create documents, spreadsheets, and decks without switching between 5 different tools. They range from semi-technical to non-technical. They value speed and simplicity over power-user features. Their context: busy, often working alone, need professional output without professional design skills.

### Brand Personality
**Clean, Smart, Approachable.** The interface should feel like a sharp tool that doesn't require a manual. Warm but not playful. Professional but not corporate. A black wordmark on warm near-white surfaces, with amber (`#FFB43F`) as the warm accent, gives energy and confidence without aggression.

### Emotional Goal
**Delight** — "This is fun and surprisingly easy." Users should feel a spark of pleasure when things just work: when AI produces exactly what they asked for, when a deck generates in seconds, when the interface anticipates their next move. The product should feel effortless, not effortful.

### Aesthetic Direction
- **References**: Linear (clean, fast, sharp UI), Pitch.com (polished, warm, presentation-quality)
- **Anti-references**: Google Docs (bland, institutional, dated)
- **Theme**: Warm near-white surfaces, black brand + amber accent, generous whitespace, alpha-based borders. A full `.dark` palette ships end-to-end across the authenticated app (content "paper" and public pages stay light by design).
- **Typography**: Inter for both headings (weight 500) and body (clarity + readability), Geist Mono for code. (The earlier Degular/JetBrains-Mono direction was dropped in the locked overhaul.)
- **Motion**: Spring-based entrances, fast micro-interactions (120ms), staggered reveals. Always respect `prefers-reduced-motion`.

### Design Principles

1. **Content is king** — The interface should disappear. Minimize chrome, maximize the user's work. Every pixel of UI should earn its place.
2. **One glance, one action** — Users should understand what to do without reading instructions. Clear hierarchy, obvious affordances, no hidden menus for primary actions.
3. **Warm precision** — Combine the sharpness of Linear with the warmth of Pitch. Clean geometry + warm near-white + amber accent + soft shadows = approachable professionalism.
4. **AI as collaborator, not wizard** — AI interactions should feel like working with a smart colleague, not invoking magic. Show the process, celebrate the result, keep the user in control.
5. **Consistent entity language** — Each entity type (doc/sheet/deck) has its own color and personality. Use these consistently across tabs, icons, badges, and backgrounds to build spatial memory.
