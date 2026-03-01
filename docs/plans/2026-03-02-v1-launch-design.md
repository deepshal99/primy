# Drafta AI v1 Launch — Design Document

**Date**: 2026-03-02
**Goal**: Make Drafta AI launch-ready for solo knowledge workers (freelancers, researchers, students) with reliable foundations and expanded AI capabilities.
**Timeline**: 3-4 weeks
**Branch strategy**: Feature branches off `main`, one PR per phase or logical chunk.

---

## Current State

Drafta AI is an AI-powered workspace with four entity types — Documents (Plate.js), Spreadsheets (Fortune Sheet), Diagrams (Mermaid/Excalidraw/Recharts), and Decks (custom slide system) — all orchestrated through a chat-based AI assistant powered by Google Gemini.

**What works today:**
- Full CRUD for all 4 entity types within Projects
- AI chat with streaming, 6 operation types (`sheetops`, `docops`, `kuops`, `tableops`, `diagramops`, `deckops`)
- Sharing via public read-only links (project-level and file-level)
- Email/password auth with NextAuth v5
- File import via chat (PDF, DOCX, XLSX, CSV, TXT, images, ZIP)
- Export: Docs (PDF/DOCX/HTML/MD), Sheets (CSV/XLSX), Decks (PDF/PPTX)
- Cmd+K search across all projects
- Design system overhaul with Tailwind v4 + CSS variables

**Critical gaps identified:**
- No password reset flow — locked-out users have zero recourse
- No save indicator — users can't tell if their work is saved
- No version history — bad AI operations or accidental edits are unrecoverable beyond 20 in-memory undo steps
- No onboarding — new users see an empty screen with no guidance
- Performance: full project graph loaded in a single API call with no pagination
- AI cannot DELETE or RENAME diagrams/decks
- No inline AI editing in documents
- No project templates
- No direct file import into tables (only via chat)
- Legacy `Conversation` system still in the store (technical debt)
- No error boundaries around editor panels

---

## Phase 1: Foundation & Trust (Week 1-2)

### 1.1 Password Reset Flow

**Problem**: Users who forget their password have no way to recover their account.

**Design**:
- Add a "Forgot password?" link on the login page
- `POST /api/auth/forgot-password` — accepts email, generates a time-limited token (1 hour), stores in a `password_reset_tokens` DB table, sends email via Resend (or similar transactional email service)
- `GET /app/reset-password?token=xxx` — new page with password + confirm password fields
- `POST /api/auth/reset-password` — validates token, hashes new password, updates user, deletes token
- Rate limit: max 3 reset emails per email per hour

**DB schema addition**:
```sql
password_reset_tokens (
  id text PK,
  userId text FK -> users.id,
  token text UNIQUE,
  expiresAt timestamp,
  createdAt timestamp
)
```

**Files touched**: `src/db/schema.ts`, `src/app/login/page.tsx`, new `src/app/reset-password/page.tsx`, new `src/app/api/auth/forgot-password/route.ts`, new `src/app/api/auth/reset-password/route.ts`

### 1.2 Save Reliability Indicator

**Problem**: Users have no visibility into whether their work is saved. The only feedback is a toast on failure.

**Design**:
- Add a `saveStatus` field to the Zustand store: `"idle" | "saving" | "saved" | "error"`
- Display a small status pill in the TabBar (right side): cloud icon + "Saved" / spinner + "Saving..." / warning + "Error"
- On successful save: show "Saved" for 3 seconds, then fade to idle
- On error: persist "Error — click to retry" until user clicks or next save succeeds
- Update `saveStatus` in `saveProjectToServer()` and `saveCurrentEntity()`

**Files touched**: `src/lib/store.ts`, `src/components/workspace/TabBar.tsx`

### 1.3 Paginated Project & Message Loading

**Problem**: `GET /api/projects` fetches ALL projects with ALL entities and ALL messages in one request. This will degrade as users accumulate data.

**Design**:
- **Projects list**: Return project metadata only (id, title, description, timestamps, entity counts) on initial load. Full entity content loaded on-demand when a project is opened.
- **Messages**: Limit to last 50 messages per project on initial load. Add "Load earlier messages" button in chat. New endpoint: `GET /api/projects/[id]/messages?before=<timestamp>&limit=50`
- **Entity content**: Loaded when the entity is opened via `openKnowledgeUnit()`, `openTable()`, etc. Already partially works this way — just need to stop sending full content in the project list response.

**API changes**:
- `GET /api/projects` — returns lightweight project list (no entity content, no messages)
- `GET /api/projects/[id]` — returns full project with entities and last 50 messages
- New: `GET /api/projects/[id]/messages?before=<timestamp>&limit=50`

**Files touched**: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, new messages endpoint, `src/lib/store.ts` (message loading logic)

### 1.4 Onboarding & Example Project

**Problem**: New users see an empty workspace with no guidance.

**Design**:
- On first login (detect via `user.createdAt === now` or a `hasOnboarded` flag), auto-create a "Welcome to Drafta" project with:
  - 1 Document: "Getting Started" with a brief guide on using the AI, creating entities, and keyboard shortcuts
  - 1 Table: Sample data (a simple task tracker with 5 rows)
  - 1 Diagram: A flowchart showing the Drafta workflow
  - 1 Deck: A 3-slide intro deck
- Show a brief welcome modal on first visit: "Welcome to Drafta AI! We've created a sample project to help you get started."
- Add `hasOnboarded: boolean` to the users table

**Files touched**: `src/db/schema.ts`, `src/app/api/projects/route.ts` (or a new onboarding endpoint), `src/lib/store.ts`, new `src/components/onboarding/WelcomeModal.tsx`

### 1.5 Small CRUD Gaps

**Duplicate diagram + deck**: Add `duplicateDiagram()` and `duplicateDeck()` actions to the store, mirroring the existing `duplicateKnowledgeUnit()` and `duplicateTable()` patterns. Wire into the entity context menu in `ProjectHome.tsx`.

**AI DELETE operations**: Add `DELETE` action to `kuops`, `tableops`, `diagramops`, `deckops` in `types.ts`. Add handling in `finishStreaming()` — remove the entity from the project and close its tab if open. Update `systemPrompt.ts` with DELETE operation docs.

**AI RENAME for diagrams + decks**: Add `RENAME` action to `diagramops` and `deckops` in `types.ts`. Handle in `finishStreaming()`. Update system prompt.

### 1.6 API Rate Limiting

**Design**: Add a simple in-memory rate limiter middleware using a Map of `userId -> { count, resetAt }`. Limits:
- `/api/chat`: 30 requests/minute
- `/api/projects`: 60 requests/minute
- `/api/extract`: 10 requests/minute
- `/api/embeddings`: 20 requests/minute

Use a shared utility: `src/lib/rateLimit.ts` with `checkRateLimit(userId, endpoint, limit, windowMs)`.

---

## Phase 2: AI Capabilities (Week 2-3)

### 2.1 Inline AI Editing in Documents

**Problem**: To edit specific text with AI, users must copy text to chat, ask for changes, then manually paste back. This is friction-heavy.

**Design**:
- When user selects text in the Plate.js editor, show a floating AI toolbar (similar to Notion AI) with actions: "Improve writing", "Fix grammar", "Make shorter", "Make longer", "Simplify", "Change tone", "Translate to..."
- On click: send selected text + action to a new `POST /api/inline-edit` endpoint that streams the replacement
- Replace the selection with the streamed result, with an "Accept / Revert" toolbar
- The endpoint uses Gemini Flash (small context, fast response)

**Components**:
- `src/components/doc/InlineAIToolbar.tsx` — floating toolbar that appears on text selection
- `src/app/api/inline-edit/route.ts` — lightweight streaming endpoint
- Integration with Plate.js selection API

**UX flow**:
1. User selects text in document
2. Floating toolbar appears above selection
3. User clicks "Improve writing"
4. Selected text gets a subtle highlight, streaming replacement appears
5. "Accept" replaces the selection permanently; "Revert" restores original

### 2.2 Smarter Context Injection

**Problem**: The AI chat only knows about the current entity if the user explicitly @mentions it. Users expect the AI to "see" what they're working on.

**Design**:
- Auto-inject the currently open entity's content into the system prompt as "active context"
- Add a small "Context" indicator in the chat input showing what the AI can see: "Viewing: Getting Started.doc"
- When no entity is open, inject a summary of the project structure (entity list with types)
- Cap auto-injected content at 10KB to avoid blowing up the context window

**Changes to `src/app/api/chat/route.ts`**:
- Accept `activeEntityId` and `activeEntityType` in the request body
- Inject the active entity's content at the top of the context block with a label: `[Currently viewing: {title}]`
- Existing @mention injection continues to work for explicit references

### 2.3 AI-Powered Project Templates

**Problem**: New users don't know what to create. Starting from scratch is intimidating.

**Design**:
- Add a template picker to the "New Project" flow (in NavRail's create project action)
- Templates are predefined prompt strings that the AI executes on project creation
- Initial template set (6 templates):
  1. **Blank Project** — empty, current behavior
  2. **Business Plan** — doc (executive summary), table (financial projections), diagram (org chart), deck (pitch deck)
  3. **Research Project** — doc (literature review), table (data collection), diagram (methodology flow)
  4. **Weekly Report** — doc (report template), table (metrics tracker), diagram (progress chart)
  5. **Course Notes** — doc (lecture notes template), table (schedule), diagram (concept map)
  6. **Content Calendar** — table (content schedule), doc (brand guidelines), diagram (workflow)
- On selection: create project, then fire an AI chat message behind the scenes to populate entities
- Show a "Setting up your project..." loading state

**Components**:
- `src/components/onboarding/TemplatePickerModal.tsx`
- Template definitions in `src/lib/templates.ts` (just prompt strings + metadata)

### 2.4 Enhanced Chat Experience

**Contextual suggestion chips**: Instead of generic suggestions, tailor them to the current entity type:
- Document open → "Summarize this", "Add a table of contents", "Expand the introduction"
- Sheet open → "Create a chart from this data", "Add a summary row", "Sort by column A"
- Diagram open → "Add more detail", "Simplify this diagram", "Convert to flowchart"
- Deck open → "Add a slide about...", "Improve slide design", "Add speaker notes"

**Entity links in AI responses**: When the AI references an entity it created or modified, render it as a clickable chip that opens the entity.

---

## Phase 3: UX Polish & Launch Prep (Week 3-4)

### 3.1 Version History

**Problem**: No way to recover from bad edits or AI operations beyond 20 in-memory undo steps.

**Design**:
- New DB table: `entity_versions` with `id, projectId, entityId, entityType, content (jsonb), title, createdAt`
- Save a version snapshot on every server save (debounced, so ~every 2-5 seconds of activity)
- Keep last 20 versions per entity (delete oldest on insert)
- UI: "Version history" button in the entity toolbar → opens a right sidebar with a timeline
- Click a version → preview it in the main panel (read-only)
- "Restore this version" button replaces current content

**DB schema addition**:
```sql
entity_versions (
  id text PK,
  projectId text FK,
  entityId text,
  entityType text,
  content jsonb,
  title text,
  createdAt timestamp
)
```

**Files touched**: `src/db/schema.ts`, `src/app/api/projects/[id]/route.ts` (save versions on PUT), new `src/app/api/versions/route.ts`, new `src/components/workspace/VersionHistory.tsx`

### 3.2 Direct Table Import

**Problem**: Users can only get data into spreadsheets by uploading files to chat and asking the AI to create a table. Power users expect drag-and-drop import.

**Design**:
- Add an "Import" button next to the Export button in the sheet toolbar
- Accepts: `.xlsx`, `.csv`, `.tsv` files
- On import: parse the file client-side (using the existing `xlsx` library), convert to Fortune Sheet `celldata[]` format, and replace/merge into the current sheet
- Also support paste-from-clipboard: detect tabular data (TSV) on paste into an empty sheet

**Files touched**: `src/components/sheet/SheetPanel.tsx` (import button), new `src/lib/sheet/importSheet.ts` (parsing logic)

### 3.3 Error Boundaries

**Problem**: If Plate.js, Fortune Sheet, Mermaid, or Excalidraw crashes, the entire workspace becomes unusable.

**Design**:
- Wrap each editor panel (`DocPanel`, `SheetPanel`, `DiagramPanel`, `DeckPanel`) in a React error boundary
- On crash: show a friendly "Something went wrong" message with a "Reload editor" button
- Log the error to console (and optionally to a future error tracking service)
- The error boundary should NOT crash the chat panel or TabBar — only the editor area

**Component**: `src/components/workspace/EditorErrorBoundary.tsx` — generic, reusable

### 3.4 Empty State Improvements

Audit and improve empty states across all panels:
- **Chat (no messages)**: Show `ExamplePrompts` component prominently (already exists, verify visibility)
- **Project Home (no entities)**: Current 4-button grid is good — add a "Or try a template" link
- **Document (new/empty)**: Show a placeholder: "Start typing or ask AI to help..."
- **Sheet (empty)**: Show column/row headers with a centered "Import data or ask AI to create a table"
- **Diagram (empty)**: "Describe a diagram in chat, or start drawing with Excalidraw"
- **Deck (no slides)**: "Ask AI to generate a presentation, or add a blank slide"

### 3.5 Technical Cleanup

**Remove legacy Conversation system**:
- Delete all `Conversation`-related types from `types.ts`
- Remove `saveCurrentConversation`, `loadConversation`, `deleteConversation`, `renameConversation`, `newConversation`, `loadConversations` from store
- Remove `drafta_conversations` localStorage key handling
- Keep `migrateConversations()` for one more release, then remove

**Add Immer middleware to Zustand**:
- Wrap the store creator with Immer middleware
- Refactor the most mutation-heavy actions (entity CRUD, `finishStreaming`) to use `draft` syntax
- This reduces GC pressure and makes the code more readable

**Partial save optimization**:
- Instead of sending the full project on every PUT, send only the changed entity
- New endpoint: `PATCH /api/projects/[id]/entities/[entityId]` — updates a single entity
- Fall back to full PUT for project-level changes (title, description, entity order)

---

## Success Criteria

1. **Auth**: A user can sign up, forget their password, reset it, and log back in
2. **Save trust**: Users always know if their work is saved (indicator visible at all times)
3. **Performance**: A project with 20+ entities and 200+ messages loads in under 3 seconds
4. **AI power**: Users can edit text inline with AI, get contextual suggestions, and use templates to bootstrap projects
5. **Recovery**: Users can view and restore previous versions of any entity
6. **Reliability**: Editor crashes are contained — the app never goes fully blank
7. **Import**: Users can drag an XLSX into a table without touching the chat

## Out of Scope (Future Phases)

- Google OAuth / social sign-in
- Mobile responsive layout
- Real-time collaboration (Yjs + PartyKit)
- Cross-entity references / embedding
- Comments and annotations
- Dark mode in editors
- API / webhooks for external integrations
- Fortune Sheet to Univer migration
- Team features (workspaces, permissions)
