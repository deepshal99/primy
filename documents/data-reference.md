# Primy AI — Data Reference

> Domain data relationships and business logic not expressed in the database schema alone.

## Entity Hierarchy

```
User
 └── Project (workspace container)
      ├── KnowledgeUnit (document)
      ├── ProjectTable (spreadsheet)
      ├── ProjectDiagram (diagram)
      ├── ProjectDeck (presentation)
      └── ChatMessage[] (conversation history)
```

## Implicit Relationships

### Project ↔ Entities
- A project is the top-level container. All entities belong to exactly one project.
- Deleting a project cascades to all child entities.
- The project's `content` field in DB stores the full serialized state (all entities, chat history, settings) as a single JSON blob — this is the debounced-save target.

### AI Context Chain
- When a user sends a chat message, the system injects context from related entities:
  - **KnowledgeUnits**: Top 3 by relevance score get full content injected; rest get summaries
  - **Tables**: Top 3 by relevance get CSV representation injected
  - **Active entity**: The currently open/focused entity always gets full context priority
- Relevance scoring uses keyword matching + optional embedding similarity (gemini-embedding-001)

### Entity Creation Flow
- AI can create new entities via operations in fenced code blocks
- New entities are added to the store → a new tab opens → debounced save triggers
- Entity IDs are generated client-side (nanoid)

### Sheet Data Format
- Sheets use Fortune Sheet's `celldata[]` format: sparse array of `{r, c, v}` objects
- `r` = row index, `c` = column index, `v` = cell value object
- Cell value `v` contains: `v` (raw value), `m` (display value), `ct` (cell type), `fs`/`fc`/`bl` (formatting)
- This is NOT a 2D array — it's a sparse representation

### Deck Slide Structure
- Each slide has: `id`, `layout`, `title`, `subtitle`, `body`, `bullets`, `image`, `chart`, `background`
- Layouts are predefined strings: `title`, `content`, `two-column`, `image-left`, `image-right`, `quote`, `stats`, `blank`
- Slides are ordered by array position in `DeckSlide[]`

### Document Content
- Documents use Plate.js JSON format (Slate-compatible)
- Can also accept/produce Markdown (converted at API boundary)
- Rich text features: headings, lists, bold/italic, code blocks, links, images

### Diagram Types
- Mermaid source code (flowcharts, sequence diagrams, entity relationship, etc.)
- Recharts JSON (bar, line, pie charts — rendered as React components)
- Excalidraw JSON (freeform drawing)

## State Synchronization
- Client state (Zustand store) is the source of truth during a session
- Debounced save (2000ms for projects, 800ms for sheets) syncs to PostgreSQL
- No real-time sync between clients yet (planned: Yjs + PartyKit)
- `sheetVersion` counter forces Fortune Sheet remount after AI mutations

## Sharing Model
- Projects can generate a share token (UUID)
- Share links are read-only, no auth required
- Shared view uses `DocViewReadOnly` / read-only sheet/diagram renderers
- No granular permissions yet (planned for v1.2)
