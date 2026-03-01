# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Drafta AI is an AI-powered workspace where users create and manage documents, spreadsheets, diagrams, and presentation decks — all connected through a chat-based AI assistant powered by Google Gemini.

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
- **AI**: Vercel AI SDK 6 (`ai` + `@ai-sdk/google`) → Google Gemini
- **Sheets**: Fortune Sheet (migration to Univer planned)
- **Docs**: Plate.js v52 (Slate-based rich text)
- **Diagrams**: Mermaid + Excalidraw
- **Decks**: Custom slide system with pptxgenjs export

## Architecture

### Entity System

Four entity types live inside a **Project**:

| Entity | Type Key | DB Table | Content Format |
|--------|----------|----------|----------------|
| Document | `ku` (KnowledgeUnit) | `knowledgeUnits` | Plate.js JSON / Markdown |
| Spreadsheet | `table` | `projectTables` | Fortune Sheet `celldata[]` (jsonb) |
| Diagram | `diagram` | `projectDiagrams` | Mermaid source or Recharts JSON |
| Deck | `deck` | `projectDecks` | `DeckSlide[]` (jsonb) |

### AI Operation Flow

1. User sends message → `POST /api/chat` with context injection (sheet CSV, doc content, project memory)
2. `modelRouter.ts` selects Gemini model: Flash for small contexts (<30KB), Pro for large/complex
3. Gemini streams response with JSON operations inside fenced blocks
4. `parseAIResponse.ts` extracts operations from block types: `sheetops`, `docops`, `kuops`, `tableops`, `diagramops`, `deckops`
5. `finishStreaming()` in the store applies operations, opens new entity tabs, triggers debounced save

### Context Injection

`contextRelevance.ts` scores KUs and tables by keyword matching + optional embedding similarity (via `gemini-embedding-001`). Top 3 of each get full content injected into the system prompt; the rest get summaries in a `project_context` block.

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
- `src/lib/ai/modelRouter.ts` — Gemini model selection logic
- `src/app/api/chat/route.ts` — Main streaming chat endpoint
- `src/db/schema.ts` — Drizzle PostgreSQL table definitions
- `src/components/AppShell.tsx` — Main layout: sidebar + chat panel + workspace

### API Routes

- `POST /api/chat` — Streaming Gemini response (SSE) with full context
- `GET/POST /api/projects` — Project listing and creation
- `PUT/DELETE /api/projects/[id]` — Project update and delete (debounced save target)
- `POST /api/extract` — File text extraction (PDF, DOCX, XLSX, ZIP)
- `POST /api/embeddings` — Generate embeddings for semantic search
- `POST /api/deck-ai` — Dedicated deck AI generation
- `GET /api/share/[token]` — Public sharing (no auth required)
- `POST /api/title` — Auto-generate project title from content

## Design System

CSS variables are defined in `globals.css`. Design tokens in `src/lib/design.ts`.

- **Brand**: Electric orange `#ff4a00` — always use white (`#fff`) text on orange backgrounds. **NEVER use black or dark text on the primary orange.**
- **Fonts**: Degular (headings), Inter (body), JetBrains Mono (code)
- **Entity colors**: doc `#4a7aed`, sheet `#2e9e47`, diagram `#7c5cb8`, deck `#d4582a`
- **Surfaces**: canvas `#f9f9fb`, NavRail `#fafaf8`, tab bar `#f7f5f2`, cards `white`
- **Borders**: `#e8e7e4` (layout), `#e8e8ed` (components), `#dddfe3` (inputs)
- **Text hierarchy**: `#1a1a2e` (primary) / `#6b6b80` (muted) / `#95928E` (subtle) / `#b0ada6` (hint)

Use entity colors consistently when rendering entity-specific UI (icons, badges, tabs, card backgrounds).

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT signing secret
- `GEMINI_API_KEY` — Google AI API key
- `NEXTAUTH_URL` — App URL (e.g. `http://localhost:3000`)

## Conventions

- Path alias: `@/` maps to `src/`
- All API routes use Next.js App Router (`src/app/api/*/route.ts`)
- The store is the single source of truth for client state — components read from store, AI operations write to store
- AI operations are JSON objects inside fenced code blocks (e.g. `` ```sheetops [...] ``` ``). Never change the block format without updating both `systemPrompt.ts` and `parseAIResponse.ts`
- Spreadsheet data uses Fortune Sheet's `celldata[]` format (sparse array of `{r, c, v}` objects), not 2D arrays
- The `sheetVersion` counter must be incremented after any programmatic sheet mutation to trigger re-render
- File uploads: max 100MB per file, max 10 files per message. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, images, ZIP

## Active Migration Plan

Several module upgrades are planned (see `.claude/plans/`):
- Fortune Sheet → Univer (sheets)
- jsPDF → Puppeteer server-side PDF (export)
- Yjs + PartyKit (real-time collaboration)
