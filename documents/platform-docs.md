# Primy AI Platform Documentation

## 1. Overview

Primy AI is an AI-powered workspace where users create and manage three types of entities (documents, spreadsheets, and presentations) within projects, all connected through a chat-based AI assistant powered by OpenAI for chat and Google Gemini for deck generation. The platform emphasizes cross-entity collaboration, where data and content flow between documents, sheets, and decks.

## 2. Core Architecture

### Entity System

Three entity types live inside a **Project**:

| Entity Type | Type Key | Storage | Content Format |
|---|---|---|---|
| Document (Knowledge Unit) | `ku` | `knowledgeUnits` table | Plate.js HTML with Markdown support |
| Spreadsheet (Project Table) | `table` | `projectTables` table | Univer `celldata[]` (JSON sparse array) |
| Presentation Deck | `deck` | `projectDecks` table | Array of DeckSlide objects with theme configuration |

### State Management

- **Client-side state**: Zustand store with Immer middleware (single source of truth)
- **Debounced sync to server**: Projects save after 2000ms of inactivity
- **Data persistence**: Neon PostgreSQL via Drizzle ORM
- **Real-time updates**: TanStack Query v5 for server state synchronization

### AI Operation Flow

1. User sends message to `/api/chat` with context injection (sheet CSV, doc content, project memory, file attachments)
2. AI model streams response with JSON operations inside fenced blocks
3. Operations are parsed and typed (`sheetops`, `docops`, `kuops`, `tableops`, `deckops`)
4. Client applies operations, opens new entity tabs, saves to server
5. UI updates reactively from Zustand store

## 3. Authentication & User Management

### Sign-up / Sign-in

- **Location**: `src/app/login/page.tsx`
- **Auth method**: NextAuth v5 with credentials provider (email + password)
- **Features**:
  - Sign-up mode: Name, email, password (min 6 chars)
  - Sign-in mode: Email, password with "Forgot password?" link
  - Toggle between modes
  - Password visibility toggle
  - Error messages for duplicate emails, incorrect passwords, missing fields

### Password Management

- **Forgot password**: Link to `/forgot-password` form
- **Reset password**: Token-based email flow via `/api/auth/reset-password`
- **Session storage**: JWT in NextAuth session

### User Profile

- **Access**: Settings modal in project sidebar
- **Data**: User name, email, password change available
- **Logout**: Button in user menu, clears session

## 4. App Shell & Navigation

> **Active shell: `AppShellV2`** (`src/components/shell/v2/AppShellV2.tsx`) — the Strut-inspired overhaul, default since Jun 2026. The legacy `AppShell` below is still reachable via `/app?shell=v1` but is not the product. Toggle persists in `localStorage` (`primy:shellV2`).

### AppShellV2 (current)

- **Structure**: 232px sidebar · main area · docked collapsible chat card; full light + dark chrome.
- **Sidebar**: brand + theme toggle; nav rows **Quick Note**, **Recents**, **Search (⌘K)**; a Workspaces tree (project → folders → entities); account menu. (The old "Inbox" row was removed.)
- **Main area precedence**: a **system view** (`systemView: "recents" | "notes" | null`) → per-project board/timeline or entity editor → full-screen chat hero (no project open).
- **View toggle** (per project): board / timeline.

### Global surfaces

**Recents** (`src/components/shell/v2/RecentsView.tsx`):
- Cross-workspace list of recently opened entities, date-bucketed (Today / Yesterday / This week / Earlier).
- Type filter (All/Docs/Sheets/Decks/Pages) + live text filter; hover-to-remove; keyboard open.
- Backed by `store.recents` (localStorage, cap 40, deduped), recorded in every `open*` path; self-heals (prunes rows whose entity was deleted).

**Quick Note** (`src/components/shell/v2/QuickNotesView.tsx`):
- One-click capture into a single lazily-provisioned **Quick Notes** workspace (hidden from the Workspaces tree).
- Notes rail (auto-title from first line, search, delete) + the real Plate editor + docked AI chat.
- **Move to workspace**: promotes a note into any real project (optimistic, id-preserving; server sync in background).
- No whiteboard — inline Mermaid covers quick diagrams (deliberate non-goal).

### Legacy AppShell (v1, `?shell=v1`)

- **Path**: `src/components/AppShell.tsx`
- **Structure**: 3-panel layout with view mode detection
- **Main panels**: NavRail (left), ChatPanel (right), WorkspacePanel (center)

**Legacy view modes:**
1. **Chat mode**: Only ChatPanel visible (no entity selected)
2. **Project mode**: NavRail + ChatPanel + ProjectHome (entity list overview)
3. **Editor mode**: NavRail + ChatPanel + WorkspacePanel (entity open for editing)

### Navigation Components

**NavRail** (`src/components/sidebar/NavRail.tsx`):
- Logo button (toggles sidebar)
- Project list with search
- +New Project button
- Settings, share, delete project options
- User menu with logout

**ProjectSidebar** (`src/components/sidebar/ProjectSidebar.tsx`):
- Full project browser with rename/delete/share options
- Search across all projects and entities
- Context menus for entity actions
- Settings modal for project metadata (title, description, type)

**TabBar** (`src/components/workspace/TabBar.tsx`):
- Chrome-style tabs for open entities
- Active entity highlighted
- Close (x) button per tab
- Keyboard shortcut: Cmd+W to close

## 5. Chat Panel & AI Assistant

### ChatPanel Component

- **Path**: `src/components/chat/ChatPanel.tsx`
- **Features**:
  - Message list with auto-scroll
  - Chat input with file attachments
  - Real-time streaming response
  - Suggestion chips for follow-up actions
  - File attachment preview pills

### Message Types

**User Messages**:
- Text content with optional attachments
- Optional @mentions of entities (documents, tables, decks)
- File attachments (PDFs, images, DOCX, XLSX, CSV, TXT, MD, JSON, ZIP)
- Maximum 100MB per file, 10 files per message

**Assistant Messages**:
- Streaming text response
- JSON operation blocks (fenced code blocks with `sheetops`, `docops`, etc.)
- Suggested follow-up actions
- Grounding sources from web search (when applicable)
- AI phase indicator (thinking -> streaming -> updating -> done)

### ChatInput Component

- **Path**: `src/components/chat/ChatInput.tsx`
- **Features**:
  - Auto-expanding textarea
  - Rich file drag-and-drop
  - @mention autocomplete for entities
  - Keyboard shortcuts: Enter to send, Shift+Enter for newline
  - Visual indicator of pending attachments
  - Disabled state during streaming

### MessageList Component

- **Path**: `src/components/chat/MessageList.tsx`
- **Features**:
  - Chronological display
  - User messages on right (orange background)
  - Assistant messages on left (white background)
  - Attachment rendering with preview
  - Code block syntax highlighting
  - Mention rendering as colored chips
  - Loading indicator during streaming

### File Attachments

- **Supported types**: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, images, ZIP
- **Processing**:
  - PDFs: text extraction via unpdf
  - Office docs: extraction via server
  - Images: uploaded to Vercel blob storage
  - ZIPs: recursive text extraction with smart filtering
- **UI**: File preview pills with progress, extracting state, extracted indicator
- **Context injection**: File content sent to AI with user message

## 6. Document Editor (Knowledge Units)

### DocView Component

- **Path**: `src/components/doc/DocView.tsx`
- **Editor**: Plate.js v52 (Slate-based rich text) with Markdown support
- **Plugins enabled**:
  - Basic blocks (paragraphs, headings)
  - Basic marks (bold, italic, underline, strikethrough, code)
  - Lists (unordered, ordered)
  - Tables with native support
  - Code blocks with language highlighting
  - Links with interactive editing
  - Images with embed support
  - Text alignment
  - Highlight/color

### Toolbar (DocToolbar)

- **Text styles**: Bold, Italic, Underline, Strikethrough, Code, Highlight
- **Headings**: H1, H2, H3, Paragraph
- **Alignment**: Left, Center, Right
- **Lists**: Unordered, Ordered
- **Formatting**: Blockquote, Horizontal rule, Code block
- **Media**: Link insertion, Image upload
- **Tables**: Insert table
- **Entity links**: Insert links to other entities (@mention picker)
- **Keyboard shortcuts**: Cmd+B (bold), Cmd+I (italic), Cmd+U (underline), Cmd+E (code), Cmd+Shift+H (highlight)

### Entity Link Chips

- **Syntax**: `[Title](entity://type/id)`
- **Supported types**: ku (document), table, deck
- **Rendering**: Colored inline chips with entity icons
- **Interaction**: Clickable, navigates to entity in same project

### Export

- **Format**: Markdown
- **Access**: DocExportMenu button
- **Content**: Full document as markdown with embedded images

## 7. Spreadsheet Editor (Project Tables)

### SheetView Component

- **Path**: `src/components/sheet/SheetView.tsx`
- **Backend**: Fortune Sheet (migration to Univer planned)
- **Data format**: Sparse cell array with row/column indices (CellData[])

### Cell Value Structure

```typescript
{
  v: string | number,        // Display value (required)
  m: string | number,        // Formatted display (for formulas/numbers)
  f: string,                 // Formula (e.g., "=SUM(A2:A10)")
  ct: { fa: string, t: "s"|"n" }, // Cell type (string/number)
  bl: 1,                     // Bold
  it: 1,                     // Italic
  fc: "#HEX",                // Font color
  bg: "#HEX",                // Background color
  fs: 10                     // Font size (points)
}
```

### Sheet Operations

- **SET_SHEET_DATA**: Replace entire sheet (new sheets)
- **UPDATE_CELLS**: Modify specific cells (primary editing)
- **ADD_SHEET**: Create new sheet tab
- **FORMAT_CELLS**: Apply formatting to range
- **SET_COLUMN_WIDTHS**: Set column widths for data visibility
- **DELETE_ROWS/DELETE_COLUMNS**: Remove rows or columns
- **SORT**: Sort by column ascending/descending
- **SET_DROPDOWN**: Add dropdown validation to column range

### Data Validation

- **Dropdown lists**: Set via `SET_DROPDOWN` operation on specific columns
- **Common uses**: Status, Priority, Category, Type fields

### Formulas

- **Syntax**: Excel-style (=SUM, =AVERAGE, =IF, =VLOOKUP, etc.)
- **Cell references**: A1 notation in formulas (A=col0, B=col1, etc.)
- **Row references**: 1-indexed in formulas (r:0 = row 1)
- **Absolute references**: $ for row/column locking (e.g., B$1, $B1)

### Export Menu

- **Formats**: CSV, Excel (.xlsx), PDF
- **Location**: Top-right corner of sheet

## 8. Presentation Deck Builder

### DeckBuilder Component

- **Path**: `src/components/deck/DeckBuilder.tsx`
- **Phases**: idle -> generating -> viewing

### Deck Phase States

**Idle Phase**: Empty state prompt, user describes presentation
**Generating Phase**: Progress indicator, outline gathering/editing, AI generating slides
**Viewing Phase**: Linear slide carousel, slide toolbar with presentation mode, export, reset

### Slide Layouts

- `title`: Title slide with title + subtitle
- `bullets`: Content slide with bullet points
- `titleContent`: Title + content area
- `twoColumn`: Two columns of content
- `section`: Section break slide
- `quote`: Quote/callout slide
- `blank`: Blank canvas
- `stats`: Statistics display with value/label pairs
- `imageFeature`: Image-focused slide with overlay text
- `statement`: Large statement/claim
- `metrics`: Multiple metric blocks
- `featureGrid`: Grid of features
- `logoGrid`: Grid of logos
- `html`: Custom HTML/CSS slide

### Theme System

- **ThemeConfig**: Customizable design system per deck
  - Colors: bg, text, textSecondary, accent, accentAlt, accentLight
  - Typography: headingFont, bodyFont, headingWeight, headingCase
  - Elements: cardBg, cardBorder, divider
  - Bullets: disc, dash, number, arrow, check, ring, bar styles
  - Decor: geometric, minimal, gradient

### Export Options

- **PPTX**: Full fidelity with layouts, images, styling (via pptxgenjs)
- **PDF**: Print-ready page format (via Puppeteer)

### PresentationMode

- Full-screen viewing with keyboard navigation (arrows, space, escape)
- Speaker notes visible to presenter
- Slide counter: current / total

## 9. Project Management

### ProjectHome Component

- **Path**: `src/components/workspace/ProjectHome.tsx`
- **Display**: Grid of entity cards by type (Documents, Tables, Decks)
- **Card features**:
  - Entity title and type badge
  - Truncated preview (documents show content snippet)
  - Entity color coding (doc=blue, sheet=green, deck=orange)
  - Hover menu with rename, duplicate, delete, share
  - Right-click context menu

### Project CRUD

- **Create**: "+New Project" button or auto-created on first message
- **Switch**: Click in sidebar, loads full project data
- **Rename**: Context menu or double-click, inline editing
- **Settings**: Title, description, projectType (Marketing/Content/Research/Engineering/Design/Other)
- **Delete**: Context menu with confirmation dialog, cascading delete

### Entity CRUD

- **Create**: "+Entity" button in ProjectHome or via AI operations
- **Open**: Click card or tab, Cmd+1 (first table), Cmd+2 (first doc)
- **Rename**: Context menu or double-click title
- **Duplicate**: Creates copy with "(Copy)" suffix, separate ID
- **Delete**: Context menu, closes tab if open, debounced save

## 10. Sharing & Public Views

### Share Functionality

- **Access**: "Share" button on entity or project
- **Modes**: Share individual entity or entire project
- **Generate link**: Creates unique token, URL: `/share/{token}`
- **Disable**: Revoke token, makes link inaccessible
- **Permissions**: Public read-only (no auth required)

### Read-Only Viewers

- **DocViewReadOnly**: Markdown rendering with remark-gfm
- **SheetViewReadOnly**: View-only sheet display
- **DeckViewReadOnly**: Slide carousel, presentation mode available

## 11. AI Capabilities

### System Prompt Architecture

- **Path**: `src/lib/ai/systemPrompt.ts` (~27KB)
- **Context blocks injected**:
  - `<current_sheet_data>`: CSV of active sheet
  - `<current_doc_content>`: Markdown of active document
  - `<project_context>`: Summaries of all entities
  - `<relevant_document>`: Full content of semantically relevant KU
  - `<relevant_table>`: CSV of semantically relevant table
  - `<project_memory>`: User preferences (tone, audience, goals, custom instructions)
  - `<uploaded_file>`: Extracted file content
  - `<deck_phase>`: Current deck generation phase

### Routing Rules

- **Text content**: Create `kuops` (documents) for long responses
- **Data organization**: Use `tableops` (spreadsheets)
- **Presentations**: Use `deckops` (slide decks)
- **Entity editing**: Use entity-specific ops (docops, sheetops)

### AI Model Selection

All tasks currently route to **OpenAI** (registry in `src/lib/ai/modelRouter.ts`):

- **Chat**: openai/gpt-4.1 (16K output) → auto-promotes to 32K past a 30KB context threshold
- **Chat (deep reasoning)**: openai/gpt-5.5 (32K, effort medium / verbosity low)
- **Deck generate / edit**: openai/gpt-4.1 (32K) — moved off Gemini
- **Deck critique**: openai/gpt-4.1 (2K)
- **Title / Web search**: openai/gpt-4.1-mini
- **Summarize**: openai/gpt-4.1
- **Embeddings**: openai/text-embedding-3-small

A Google/Gemini client remains wired (`GEMINI_API_KEY`) but no task routes to it today.

### Web Search Integration

- Automatic triggers when user asks to search, look up, or needs real-time data
- Results injected as grounding sources in messages
- Clickable source links displayed

### Suggestions

- Format: `<suggestions>[...]</suggestions>`
- 1-4 contextual follow-up actions after every AI response
- Examples: "Draft the blog post", "Create a summary document", "Add a budget tab"

## 12. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+K | Search files & content |
| Cmd+N | New project |
| Cmd+B | Toggle sidebar |
| Cmd+/ | Focus chat input |
| Cmd+W | Close current tab |
| Cmd+Z | Undo AI changes |
| Cmd+Shift+Z | Redo AI changes |
| Cmd+1 | Open first table |
| Cmd+2 | Open first document |
| Enter | Send message |
| Shift+Enter | New line in message |

## 13. Undo/Redo System

- **Storage**: UndoSnapshot[] and RedoStack[] in Zustand
- **Trigger**: After AI operations complete
- **Content**: entityType, full state snapshot, label, timestamp
- **Undo**: Cmd+Z, pops from undoStack, pushes to redoStack
- **Redo**: Cmd+Shift+Z, reverse operation
- **Toast feedback**: "Undid operation" / "Redid operation"

## 14. Settings & Preferences

### Project Settings

- Title, description, type selector
- Custom AI instructions, tone, audience, goals
- Danger zone: delete project

### Project Memory

- **Tone**: casual, formal, technical, creative, etc.
- **Audience**: developers, executives, general public, etc.
- **Goals**: Free-form project description
- **Custom Instructions**: AI-specific rules for this project

## 15. API Routes

### Public Routes

- `GET /login` — Login/signup page
- `GET /forgot-password` — Password reset request
- `GET /reset-password?token=...` — Password reset form
- `GET /share/[token]` — Public shared view
- `GET /api/share/[token]` — Fetch shared data (no auth)

### Protected Routes

- `GET/POST /api/projects` — List/create projects
- `GET/PUT/DELETE /api/projects/[id]` — Fetch/update/delete project (entity upserts/deletes, folder + entity-folder moves)
- `GET /api/projects/[id]/messages` — Paginated message history
- `POST /api/projects/[id]/share` — Generate/revoke share token
- `GET/POST /api/projects/[id]/members` — Team membership (SSOT access)
- `POST /api/chat` — Stream AI response (SSE)
- `POST /api/deck-refine` — Agentic deck critique/repair (WIP)
- `POST /api/extract` — Extract text from file
- `POST /api/embeddings` — Generate embeddings
- `POST /api/export/pdf` — Generate PDF (Puppeteer/Chromium)
- `*/api/snapshots/[type]/[id]/...` — Version history + restore
- `GET /api/usage` — Plan usage counters
- `POST /api/title` — Auto-generate project title
- `POST /api/unsplash` — Search Unsplash for deck images
- `GET /api/user` · `POST /api/user/logout-all` — Profile; revoke all sessions
- `GET /api/cron/prune-snapshots` — Scheduled snapshot pruning

File uploads go directly to Vercel Blob from the client (no `/api/upload` route).

## 16. Database Schema

### Core Tables

- **Users**: id, email, name, passwordHash, plan, proUntil, tokenVersion (session revocation), hasOnboarded, createdAt
- **Projects**: id, userId, title, description, projectType, shareToken, createdAt, updatedAt
- **Folders**: id, projectId, name, color, position — in-project grouping
- **KnowledgeUnits**: id, projectId, folderId, title, content, shareToken, createdAt, updatedAt, embedding
- **ProjectTables**: id, projectId, folderId, title, sheets (JSONB), shareToken, createdAt, updatedAt, embedding
- **ProjectDecks**: id, projectId, folderId, title, theme, style (JSONB), slides (JSONB), shareToken, createdAt, updatedAt, embedding
- **ProjectPages**: id, projectId, folderId, title, html, editableFields (JSONB), shareToken, createdAt, updatedAt
- **Messages**: id, projectId, role, content, timestamp, attachments (JSONB), groundingSources (JSONB)
- Plus: team membership / access (SSOT), snapshots (version history), blob usage tracking

## 17. Error Handling & Feedback

- **Toast notifications**: Sonner (success, error, info, loading), auto-dismiss 3-5s
- **Error boundaries**: DocView, SheetView, app-level error.tsx
- **User confirmations**: Delete dialogs, inline rename, undo toast for destructive actions

## 18. Performance Optimizations

- **React.memo**: MessageBubble
- **useMemo**: MessageList (grouping)
- **Dynamic imports**: Excalidraw, ReactFlow (non-SSR)
- **Pagination**: Messages loaded in chunks
- **Debouncing**: Sheet save 800ms, project save 2000ms
- **Server caching**: TanStack Query with stale-while-revalidate
