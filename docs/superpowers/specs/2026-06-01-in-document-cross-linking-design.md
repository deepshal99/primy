# In-Document Cross-Linking — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation plan
**Author:** Drafta eng

## Problem

Drafta is a connected workspace of docs, sheets, decks, and pages, but entities cannot reference each other from *inside* a document. Today `@`-mentions exist only in the chat input. A user writing a document cannot link to a related spreadsheet or deck. For a "project memory keeps everything connected" product, in-document interlinking is table stakes.

## Goal

Let a user, while editing a document, type `@` to insert a clickable, preview-on-hover link to any other entity in the project — and let every entity show what links back to it.

## Non-Goals (v2+)

- Live transclusion / embedding the target's actual content inline (sync + staleness + recursion cost).
- Standalone "link-card" block variant (only the inline chip ships in v1).
- Visual graph view of the link network.
- AI-authored cross-links (the AI inserting `drafta://` links when generating docs).
- Backlinks UI surfaced inside sheet / deck / page views (v1 shows backlinks only in the doc view; the hook is reusable so those views can adopt it later).
- Cross-linking *from* sheets/decks/pages (only documents use the Plate editor, so only documents author links in v1; any entity can be a link **target**).

## User Experience

### Inserting a link
1. In a document, the user types `@`.
2. A combobox opens at the caret listing every entity in the current project — documents, spreadsheets, decks, pages — grouped by type, each row showing the entity's monochrome icon + color dot + title.
3. Typing filters the list (case-insensitive title match).
4. Selecting an entry (click or Enter) inserts an inline **chip** at the caret and returns focus to the editor. Escape dismisses the combobox leaving the literal `@` text.

### The chip
- Inline, flows with text, entity-colored text on a faint tinted background, monochrome entity icon, rounded (matches the existing chat-mention pill so it reads as native).
- **Click** → opens the target entity using the existing store actions (`openKnowledgeUnit` / `openTable` / `openDeck` / `openPage`).
- **Hover (~300ms delay)** → a preview hovercard:
  - document → first ~3 non-empty lines of its content (markdown stripped to text)
  - spreadsheet → a compact 4×3 cell grid from the first sheet
  - deck → the title slide rendered small (or its title + slide count if no thumbnail)
  - page → title + a one-line snapshot/summary
- **Stale target** (entity deleted/missing) → muted, non-clickable chip reading the stored title with an "unavailable" affordance; never throws.
- Respects `prefers-reduced-motion` (no hover animation, instant show).

### Backlinks
- Each document view gets a quiet **"Linked from"** footer section: a chip list of every entity that references this document.
- Clicking a backlink chip opens the source entity.
- Empty state: the section is hidden when nothing links in.

## Architecture

### Link reference format
A cross-link is identified by a stable URI: `drafta://<type>/<id>` where `<type>` ∈ `ku | table | deck | page`. This URI is the single source of truth for a link and is what persists in markdown.

### Plate node
A new inline void element node `mention`:
```
{ type: 'mention', entityType: EntityType, entityId: string, value: string /* title snapshot */, children: [{ text: '' }] }
```
`value` stores a title snapshot for graceful display if the target is later deleted.

### Plugins (added to `DocView.tsx` plugin stack)
- `@platejs/mention@^52.3.10` — `MentionPlugin` (the inline void node + trigger handling) and its input plugin. Compatible with the installed `platejs@52.3.4`.
- `@platejs/combobox@^52.3.10` — backing the `@` picker (pulled in transitively / used by the combobox UI).
- Custom render: `MentionPlugin.withComponent(MentionElement)` (or `.configure({ render: { node: MentionElement } })`).

### Markdown round-trip (persistence)
Documents are stored as markdown (`docContent`), serialized via `MarkdownPlugin`. The markdown plugin exposes a `rules` option (`MdRules`). We register a rule for the `mention` node:
- **serialize**: `mention` node → markdown link `[@<value>](drafta://<type>/<id>)`.
- **deserialize**: a `link`/`a` mdast node whose `url` starts with `drafta://` → a `mention` node (parse `<type>/<id>` from the URI; `value` from the link text, stripping a leading `@`). Non-`drafta://` links fall through to the normal `LinkPlugin` behavior.

This means links survive save/load as ordinary markdown links, remain human-readable in raw form, and are intelligible to the AI (it sees `[@Title](drafta://ku/<id>)`).

### Entity link helpers — `src/lib/entityLinks.ts`
- `formatEntityUri(type, id)` / `parseEntityUri(uri)` — build and parse `drafta://` URIs.
- `DRAFTA_URI_SCHEME` constant + a regex for scanning content.
- `useBacklinks(entityId)` — a hook that scans the current project's documents' markdown for `drafta://*/<entityId>` references and returns the list of linking entities (`{ id, type, title }`). Cheap string scan over `project.knowledgeUnits`; memoized on project + docContent.
- `resolveEntity(projectId, type, id)` — look up an entity's current title/existence from the store for chip + hovercard rendering.

### New components (`src/components/doc/mention/`)
- `MentionElement.tsx` — the inline chip: resolves the entity from the store, renders colored pill, wires click→open and hover→hovercard, handles the stale case.
- `EntityHoverCard.tsx` — type-switched preview content (doc excerpt / sheet mini-grid / deck thumb / page snapshot), reading from the store by id.
- `MentionCombobox.tsx` — the `@` picker UI (entity list, grouping, filtering, keyboard nav). Reuses the entity-collection pattern from `ChatInput.tsx` and `ENTITY_META` from `src/lib/entityMeta.ts`.

### Navigation
`MentionElement` and backlink chips call `useAppStore.getState().open<Entity>(id)` based on `entityType`. A small dispatcher maps `EntityType → open action` to avoid repetition.

### DocView wiring
- Add the mention + combobox plugins to the `plugins` array (`DocView.tsx:312`).
- Add the markdown `rules` for `mention` to the existing `MarkdownPlugin.configure` (`DocView.tsx:321`).
- Render `<MentionCombobox />` inside the `<Plate>` tree.
- Add the "Linked from" footer below `PlateContent`, driven by `useBacklinks(currentEntityId)`.

## Data Flow

```
type @  → MentionPlugin trigger → MentionCombobox (entities from store)
        → select → insert `mention` node into Slate value
edit    → handleChange → serializeMd → `[@Title](drafta://type/id)` → updateDocContent → debounced save
load    → mdToValue → deserialize rule → `mention` node → MentionElement chip
click   → open<Entity>(id)
hover   → EntityHoverCard (store lookup by id)
backlinks → useBacklinks scans knowledgeUnits markdown for drafta://.../<id>
```

## Error Handling & Edge Cases
- **Deleted target:** chip renders muted from `value` snapshot, click is a no-op (or a toast "This item no longer exists"). Hovercard shows "Unavailable."
- **Self-link:** allowed but a no-op on click (already open); not added to its own backlinks.
- **Malformed `drafta://` URI:** deserialize falls back to a normal link; never throws.
- **AI doc rewrite:** AI-generated markdown that happens to contain `drafta://` links round-trips fine; AI that drops a link simply removes the chip (no orphan state).
- **Serialization failure:** existing `try/catch` in `handleChange` already swallows serialize errors; mention rule must be defensive so one bad node can't break the whole save.
- **Reduced motion:** hovercard appears instantly, no transition.

## Testing (manual — no test framework in repo)
- Insert a link to each entity type; verify chip color/icon and that it round-trips through save/reload (check `docContent` markdown contains the `drafta://` link).
- Click each chip → correct entity opens.
- Hover each chip → correct preview.
- Delete a target → linking doc shows muted chip, no crash.
- Backlinks: link A→B, open B's doc (if B is a doc) and confirm A appears in "Linked from"; remove the link, confirm it disappears.
- Reduced-motion: hovercard shows without animation.

## File Inventory
**New**
- `src/lib/entityLinks.ts`
- `src/components/doc/mention/MentionElement.tsx`
- `src/components/doc/mention/EntityHoverCard.tsx`
- `src/components/doc/mention/MentionCombobox.tsx`

**Modified**
- `src/components/doc/DocView.tsx` (plugins, markdown rules, combobox render, backlinks footer)
- `package.json` (`@platejs/mention`, `@platejs/combobox` at `^52.3.x`)

**Reused**
- `src/lib/entityMeta.ts` (`ENTITY_META`), `src/lib/store.ts` (open actions, project data), `src/lib/types.ts` (`EntityType`).
```