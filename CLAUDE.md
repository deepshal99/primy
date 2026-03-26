# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Drafta AI is an AI-powered workspace where users create and manage documents, spreadsheets, diagrams, and presentation decks — all connected through a chat-based AI assistant. The AI provider is configurable (OpenAI or Google Gemini) via the `AI_PROVIDER` env var; currently set to **OpenAI**.

## Commands

```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx drizzle-kit push # Push schema changes to Neon PostgreSQL
```

No test framework is configured. There are no unit tests.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Database**: Drizzle ORM + Neon PostgreSQL (serverless)
- **Auth**: NextAuth v5 (credentials + JWT)
- **State**: Zustand v5 + Immer (client-side, debounced sync to server)
- **Server state**: TanStack Query v5
- **AI**: Vercel AI SDK 6 (`ai` + `@ai-sdk/openai` + `@ai-sdk/google`) — dual-provider support, currently using OpenAI
- **Sheets**: Fortune Sheet (migration to Univer planned)
- **Docs**: Plate.js v52 (Slate-based rich text)
- **Diagrams**: Mermaid + Excalidraw + Recharts + React Flow
- **Decks**: Custom slide system with pptxgenjs export + Puppeteer PDF

## Architecture

### Entity System

Four entity types live inside a **Project**:

| Entity | Type Key | DB Table | Content Format |
|--------|----------|----------|----------------|
| Document | `ku` (KnowledgeUnit) | `knowledgeUnits` | Plate.js JSON / Markdown |
| Spreadsheet | `table` | `projectTables` | Fortune Sheet `celldata[]` (jsonb) |
| Diagram | `diagram` | `projectDiagrams` | Mermaid source, Recharts JSON, Excalidraw JSON, or React Flow JSON |
| Deck | `deck` | `projectDecks` | `DeckSlide[]` with ThemeConfig (jsonb) |

### AI Provider & Model Routing

The AI provider is set via `AI_PROVIDER` env var (`openai` or `google`). Model selection is handled by `modelRouter.ts`:

**OpenAI models (current)**:
| Task | Model | Max Output |
|------|-------|------------|
| Chat (small context) | gpt-4.1-mini | 8,192 |
| Chat (>30KB context) | gpt-4.1 | 16,384 |
| Deck generate | gpt-4.1 | 65,536 |
| Deck edit | gpt-4.1 | 32,768 |
| Title / Web search | gpt-4.1-mini | 256 / 8,192 |
| Summarize | gpt-4.1 | 4,096 |
| Embedding | text-embedding-3-small | — |

**Google models (alternate)**:
| Task | Model | Max Output |
|------|-------|------------|
| Chat (small context) | gemini-2.5-flash | 8,192 |
| Chat (>30KB context) | gemini-2.5-pro | 16,384 |
| Deck generate | gemini-2.5-pro | 65,536 |
| Title / Web search | gemini-2.5-flash | 256 / 8,192 |
| Embedding | text-embedding-004 | — |

### AI Operation Flow

1. User sends message → `POST /api/chat` with context injection (sheet CSV, doc content, project memory)
2. `modelRouter.ts` selects model based on `AI_PROVIDER` and context size (>30KB routes to heavier model)
3. AI streams response with JSON operations inside fenced blocks
4. `parseAIResponse.ts` extracts operations from block types: `sheetops`, `docops`, `kuops`, `tableops`, `diagramops`, `deckops`
5. `finishStreaming()` in the store applies operations, opens new entity tabs, triggers debounced save

### Context Injection

`contextRelevance.ts` scores KUs and tables by keyword matching + optional embedding similarity. Top 3 of each get full content injected into the system prompt; the rest get summaries in a `project_context` block.

### State Management (`src/lib/store.ts`)

This is the largest file (~78KB). All client-side state lives in a single Zustand store with Immer for immutable updates. Key patterns:
- **Debounced save**: Projects save after 2000ms of inactivity, sheets after 800ms
- **Version tracking**: `sheetVersion` counter forces Fortune Sheet remount after AI operations
- **Undo/redo**: Snapshot-based, stored in Zustand state
- **Entity CRUD**: `addKnowledgeUnit()`, `addTable()`, `addDiagram()`, `addDeck()` + corresponding update/delete

### Key Files

- `src/lib/store.ts` — All app state and actions
- `src/lib/types.ts` — Core TypeScript interfaces (CellData, SheetOperation, DocOperation, etc.)
- `src/lib/design.ts` — Design token system (import as `design`)
- `src/lib/ai/systemPrompt.ts` — 27KB master system prompt with routing rules for all operation types
- `src/lib/ai/parseAIResponse.ts` — Fenced block JSON extraction with fallback strategies
- `src/lib/ai/modelRouter.ts` — Dual-provider model selection logic (OpenAI + Google)
- `src/app/api/chat/route.ts` — Main streaming chat endpoint (supports both providers)
- `src/db/schema.ts` — Drizzle PostgreSQL table definitions
- `src/components/AppShell.tsx` — Main layout: sidebar + chat panel + workspace

### API Routes

- `POST /api/chat` — Streaming AI response (SSE) with full context
- `GET/POST /api/projects` — Project listing and creation
- `GET/PUT/DELETE /api/projects/[id]` — Project fetch, update, and delete (debounced save target)
- `GET /api/projects/[id]/messages` — Paginated message history
- `POST /api/projects/[id]/share` — Generate/revoke share token
- `POST /api/extract` — File text extraction (PDF, DOCX, XLSX, ZIP)
- `POST /api/embeddings` — Generate embeddings for semantic search
- `POST /api/deck-ai` — Dedicated deck AI generation
- `POST /api/export/pdf` — Server-side PDF generation (Puppeteer)
- `POST /api/upload` — File upload to Vercel blob storage
- `POST /api/unsplash` — Search Unsplash for deck images
- `GET /api/share/[token]` — Public sharing (no auth required)
- `POST /api/title` — Auto-generate project title from content
- `GET /api/user` — Current user profile

## Design System

Based on Firecrawl's design system (v3). CSS variables in `globals.css`. Tokens in `src/lib/design.ts`. Full spec in `src/design-system/`.

- **Brand (Heat)**: `#fa5d19` — opacity-based scale (heat.4 through heat.100). Always white text on heat backgrounds. **NEVER use dark text on orange.**
- **Fonts**: Inter (UI/body, weights 400/450/500/600/700 — headings use 500), Geist Mono (code)
- **Entity colors**: doc `#2a6dfb` (bluetron), sheet `#42c366` (forest), diagram `#9061ff` (amethyst), deck `#fa5d19` (heat)
- **Surfaces**: white (#ffffff) base, #fafafa lighter, alpha-based borders throughout
- **Borders**: `rgba(0,0,0,0.04)` faint, `rgba(0,0,0,0.08)` muted (default), `rgba(0,0,0,0.16)` loud — NOT hex colors
- **Text hierarchy**: `#171717` (primary) / `#525252` (secondary) / `#737373` (tertiary) / `#a3a3a3` (muted)
- **Radius**: Pixel-based — 4/6/8/12/16/full. Buttons+inputs=6px, cards=8px, modals=8px
- **Accents**: bluetron `#2a6dfb`, forest `#42c366`, crimson `#eb3424`, honey `#ecb730`, amethyst `#9061ff`

Use entity colors consistently when rendering entity-specific UI (icons, badges, tabs, card backgrounds).

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT signing secret
- `NEXTAUTH_URL` — App URL (e.g. `http://localhost:3000`)
- `AI_PROVIDER` — `openai` or `google` (defaults to `google` if unset)
- `OPENAI_API_KEY` — OpenAI API key (required when AI_PROVIDER=openai)
- `GEMINI_API_KEY` — Google AI API key (required when AI_PROVIDER=google)

## Conventions

- Path alias: `@/` maps to `src/`
- All API routes use Next.js App Router (`src/app/api/*/route.ts`)
- The store is the single source of truth for client state — components read from store, AI operations write to store
- AI operations are JSON objects inside fenced code blocks (e.g. `` ```sheetops [...] ``` ``). Never change the block format without updating both `systemPrompt.ts` and `parseAIResponse.ts`
- Spreadsheet data uses Fortune Sheet's `celldata[]` format (sparse array of `{r, c, v}` objects), not 2D arrays
- The `sheetVersion` counter must be incremented after any programmatic sheet mutation to trigger re-render
- File uploads: max 100MB per file, max 10 files per message. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, images, ZIP

## Product & Strategy Documents

The `/documents/` folder contains living reference docs that inform all development decisions. **Read these before making architectural or UX choices.**

- **`documents/platform-docs.md`** — Complete feature inventory: every screen, interaction, and capability described in detail. The single source of truth for what the product does.
- **`documents/ICPs.md`** — Ideal Customer Profiles: dossiers on each customer archetype (solo founders, marketers, SMB operators, students). Use to guide UX, copy, and feature prioritization.
- **`documents/styleguide.md`** — Visual style guide: colors, typography, spacing, component patterns, and the overall visual feel. All UI must be compliant.
- **`documents/vision.md`** — Product vision and roadmap with milestones (v1.1 → v2.0). Gives exploratory work guidance and context.
- **`documents/data-reference.md`** — Domain data relationships, implicit business logic, and entity hierarchies not expressed in the DB schema alone.

When building features, always check these docs for context. When making decisions that affect product direction, update the relevant doc.

## Active Migration Plan

Several module upgrades are planned (see `.claude/plans/`):
- Fortune Sheet → Univer (sheets)
- jsPDF → Puppeteer server-side PDF (export)
- Yjs + PartyKit (real-time collaboration)

## Design Context

### Users
Solo founders, marketers, SMB operators, and students who need to create documents, spreadsheets, diagrams, and decks without switching between 5 different tools. They range from semi-technical to non-technical. They value speed and simplicity over power-user features. Their context: busy, often working alone, need professional output without professional design skills.

### Brand Personality
**Clean, Smart, Approachable.** The interface should feel like a sharp tool that doesn't require a manual. Warm but not playful. Professional but not corporate. The orange brand color (`#ff4a00`) provides energy without aggression.

### Emotional Goal
**Delight** — "This is fun and surprisingly easy." Users should feel a spark of pleasure when things just work: when AI produces exactly what they asked for, when a deck generates in seconds, when the interface anticipates their next move. The product should feel effortless, not effortful.

### Aesthetic Direction
- **References**: Linear (clean, fast, sharp UI), Pitch.com (polished, warm, presentation-quality)
- **Anti-references**: Google Docs (bland, institutional, dated)
- **Theme**: Light mode only. White surfaces, warm orange accents, generous whitespace, alpha-based borders
- **Typography**: Degular for headings (warmth + character), Inter for body (clarity + readability), JetBrains Mono for code
- **Motion**: Spring-based entrances, fast micro-interactions (120ms), staggered reveals. Always respect `prefers-reduced-motion`.

### Design Principles

1. **Content is king** — The interface should disappear. Minimize chrome, maximize the user's work. Every pixel of UI should earn its place.
2. **One glance, one action** — Users should understand what to do without reading instructions. Clear hierarchy, obvious affordances, no hidden menus for primary actions.
3. **Warm precision** — Combine the sharpness of Linear with the warmth of Pitch. Clean geometry + warm orange + soft shadows = approachable professionalism.
4. **AI as collaborator, not wizard** — AI interactions should feel like working with a smart colleague, not invoking magic. Show the process, celebrate the result, keep the user in control.
5. **Consistent entity language** — Each entity type (doc/sheet/diagram/deck) has its own color and personality. Use these consistently across tabs, icons, badges, and backgrounds to build spatial memory.
