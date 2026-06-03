# Project-Scoped AI Streams + Completion Affordances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chat stream belongs to the project it started in. Results land there, never the active project. Never auto-switch the user. Reveal instantly only when they're idle in that project; otherwise show a clickable artifact widget + a sidebar dot.

**Architecture:** Stamp each stream with its origin `streamProjectId` at send time (ChatPanel). `finishStreaming` becomes project-targeted: it applies ops to the stamped project, and decides one of three dispositions — `foreground-open` (active project, user idle → auto-open, today's behavior), `foreground-quiet` (active project, user actively editing another entity → apply + widget, no focus steal), `background` (different project → apply silently + mark unread). Produced entities are recorded on the assistant message for a clickable artifact widget. A per-project unread set drives a sidebar dot. `deckPhase` mutations only touch the foreground.

**Tech Stack:** Zustand v5 + Immer store (`src/lib/store.ts`), React 19, Next.js 16, Vitest. Entity presentation via `ENTITY_META` (`src/lib/entityMeta.ts`).

---

## File Structure

- **Create** `src/lib/streamDisposition.ts` — pure routing logic (unit-testable): `resolveStreamDisposition()`, `isActivelyEditing()`.
- **Create** `src/components/chat/ArtifactWidget.tsx` — clickable entity card rendered in assistant messages.
- **Modify** `src/lib/types.ts` — add `Message.producedEntities`, `ProducedEntity` type.
- **Modify** `src/lib/store.ts` — new state (`aiUnreadProjectIds`, `lastEditorInteractionAt`), new actions (`markProjectUnread`, `clearProjectUnread`, `noteEditorInteraction`, `saveProjectById`), and the `finishStreaming(streamProjectId, …)` refactor + `deckPhase`/flat-field gating + clear-unread in `switchProject`/`openProject`.
- **Modify** `src/components/chat/ChatPanel.tsx` — capture `streamProjectId` at send, thread through every `finishStreaming` call.
- **Modify** `src/components/chat/MessageBubble.tsx` — render `ArtifactWidget` list under assistant messages.
- **Modify** `src/components/shell/v2/AppShellV2.tsx` — unread dot on workspace rows.
- **Modify** editors (`DocView.tsx`, `SheetView.tsx`, `DeckView`/deck editor, page editor) — call `noteEditorInteraction()` on user input.
- **Create/Modify** tests under `tests/`.

---

## Task 1: Types — produced entities on messages

**Files:**
- Modify: `src/lib/types.ts:159-168` (Message), add new `ProducedEntity` near `EntityType` (`src/lib/types.ts:295`).

- [ ] **Step 1: Add `ProducedEntity` type and extend `Message`.**

In `src/lib/types.ts`, after `export type EntityType = ...` (line 295) add:

```ts
/** An entity an AI turn created or updated — surfaced as a clickable widget in chat. */
export interface ProducedEntity {
  id: string;
  type: EntityType;
  title: string;
  action: "created" | "updated";
}
```

Extend the `Message` interface (line 159-168) by adding one field:

```ts
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  interrupted?: boolean;
  groundingSources?: GroundingSource[];
  mentionedEntities?: { id: string; type: EntityType; title: string }[];
  producedEntities?: ProducedEntity[]; // entities this assistant turn created/updated
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: no new errors from this file.

- [ ] **Step 3: Commit.** `git add src/lib/types.ts && git commit -m "feat(types): ProducedEntity + Message.producedEntities"`

---

## Task 2: Pure stream-disposition logic (TDD)

**Files:**
- Create: `src/lib/streamDisposition.ts`
- Test: `tests/streamDisposition.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/streamDisposition.test.ts
import { describe, it, expect } from "vitest";
import { resolveStreamDisposition, isActivelyEditing } from "@/lib/streamDisposition";

describe("isActivelyEditing", () => {
  it("true when an entity is open and input was recent", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 1000, now: 5000, thresholdMs: 8000 })).toBe(true);
  });
  it("false when no entity open", () => {
    expect(isActivelyEditing({ currentEntityId: null, lastInteractionAt: 1000, now: 2000, thresholdMs: 8000 })).toBe(false);
  });
  it("false when last input is stale", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 1000, now: 20000, thresholdMs: 8000 })).toBe(false);
  });
  it("false when never interacted", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 0, now: 5000, thresholdMs: 8000 })).toBe(false);
  });
});

describe("resolveStreamDisposition", () => {
  it("background when stream project differs from active", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "B", editingDifferentEntity: false }).mode).toBe("background");
  });
  it("foreground-open when same project and not editing elsewhere", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "A", editingDifferentEntity: false }).mode).toBe("foreground-open");
  });
  it("foreground-quiet when same project but actively editing a different entity", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "A", editingDifferentEntity: true }).mode).toBe("foreground-quiet");
  });
  it("treats null streamProjectId as foreground (legacy/no-project send)", () => {
    expect(resolveStreamDisposition({ streamProjectId: null, currentProjectId: "A", editingDifferentEntity: false }).mode).toBe("foreground-open");
  });
});
```

- [ ] **Step 2: Run, verify fail.** `npx vitest run tests/streamDisposition.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**

```ts
// src/lib/streamDisposition.ts

export type StreamDisposition =
  | { mode: "foreground-open" }   // active project + user idle → auto-open the result
  | { mode: "foreground-quiet" }  // active project + user editing another entity → apply, no focus steal
  | { mode: "background" };       // different project → apply silently, mark unread

/** Default window after the last keystroke during which we treat the user as "actively editing". */
export const ACTIVE_EDIT_WINDOW_MS = 8000;

export function isActivelyEditing(opts: {
  currentEntityId: string | null;
  lastInteractionAt: number;
  now: number;
  thresholdMs?: number;
}): boolean {
  const { currentEntityId, lastInteractionAt, now, thresholdMs = ACTIVE_EDIT_WINDOW_MS } = opts;
  if (!currentEntityId) return false;
  if (!lastInteractionAt) return false;
  return now - lastInteractionAt <= thresholdMs;
}

export function resolveStreamDisposition(opts: {
  streamProjectId: string | null;
  currentProjectId: string | null;
  /** True when the user is actively editing an entity that is NOT the one this turn targets for focus. */
  editingDifferentEntity: boolean;
}): StreamDisposition {
  const { streamProjectId, currentProjectId, editingDifferentEntity } = opts;
  // A null streamProjectId means the send had no project scope captured (legacy
  // path / brand-new auto-created project) — treat as foreground.
  const targetIsActive = streamProjectId == null || streamProjectId === currentProjectId;
  if (!targetIsActive) return { mode: "background" };
  if (editingDifferentEntity) return { mode: "foreground-quiet" };
  return { mode: "foreground-open" };
}
```

- [ ] **Step 4: Run, verify pass.** `npx vitest run tests/streamDisposition.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit.** `git add src/lib/streamDisposition.ts tests/streamDisposition.test.ts && git commit -m "feat(chat): pure stream-disposition routing logic"`

---

## Task 3: Store — new state, actions, and `saveProjectById`

**Files:**
- Modify: `src/lib/store.ts` (state init near line 286-302; actions near `clearAiModifiedEntity` line 1077; save helpers near `saveCurrentEntity` line 2529).
- Modify: the store's TypeScript interface (search the `interface AppState`/`AppStore` declaration; add the new fields/actions to its type).

- [ ] **Step 1: Add new state fields.** In the store initializer (near line 286, alongside `aiModifiedEntityIds: []`), add:

```ts
      aiUnreadProjectIds: [] as string[],
      lastEditorInteractionAt: 0,
```

Add to the store type interface:

```ts
  aiUnreadProjectIds: string[];
  lastEditorInteractionAt: number;
  markProjectUnread: (projectId: string) => void;
  clearProjectUnread: (projectId: string) => void;
  noteEditorInteraction: () => void;
  saveProjectById: (projectId: string) => void;
```

And update `finishStreaming`'s type signature to take a leading `streamProjectId: string | null` (see Task 4).

- [ ] **Step 2: Add the unread + interaction actions** (place near `clearAiModifiedEntity`, ~line 1077):

```ts
  markProjectUnread: (projectId: string) =>
    set((state) => state.aiUnreadProjectIds.includes(projectId)
      ? {}
      : { aiUnreadProjectIds: [...state.aiUnreadProjectIds, projectId] }),

  clearProjectUnread: (projectId: string) =>
    set((state) => state.aiUnreadProjectIds.includes(projectId)
      ? { aiUnreadProjectIds: state.aiUnreadProjectIds.filter((id) => id !== projectId) }
      : {}),

  noteEditorInteraction: () => set({ lastEditorInteractionAt: Date.now() }),
```

- [ ] **Step 3: Add `saveProjectById`** — persists an arbitrary project (not necessarily active) to localStorage + server. Extract the sync-payload shape from `saveCurrentEntity` (`src/lib/store.ts:2606-2642`). Place after `saveCurrentEntity`:

```ts
  // Persist a specific project (used when an AI stream finishes for a project
  // the user is NOT currently viewing — the debounced save only covers the
  // active project). Entities/messages are assumed already updated in store.
  saveProjectById: (projectId: string) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    saveProjectsToStorage(state.projects);
    const syncPayload: Record<string, any> = {
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      memory: project.memory,
      knowledgeUnits: project.knowledgeUnits.map((k) => ({ id: k.id, title: k.title, content: k.content })),
      tables: project.tables.map((t) => ({ id: t.id, title: t.title, sheets: t.sheets })),
      decks: (project.decks || []).map((d) => ({ id: d.id, title: d.title, theme: d.theme, style: d.style || null, slides: d.slides })),
      pages: (project.pages || []).map((pg) => ({ id: pg.id, title: pg.title, html: pg.html, editableFields: pg.editableFields || [], sourceKuId: pg.sourceKuId || null })),
      newMessages: project.messages.slice(-2).map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp, attachments: m.attachments })),
    };
    updateProjectOnServer(projectId, syncPayload).catch(() => {
      console.warn("[Primy] Background project save failed:", projectId);
    });
  },
```

- [ ] **Step 4: Clear unread on entering a project.** In `switchProject` (after the `set({...})` at line 1410-1436, before `loadFullProject`) add:

```ts
    get().clearProjectUnread(project.id);
```

Do the same in `openProject` if such a path exists that lands on a project without going through `switchProject` (search for where a project becomes active from Recents). The `goWorkspace`/`switchProject` path in `AppShellV2` is the primary one.

- [ ] **Step 5: Typecheck.** `npx tsc --noEmit` — Expected: errors only from `finishStreaming` callers until Task 4 lands (acceptable mid-task; resolve by Task 5).

- [ ] **Step 6: Commit.** `git add src/lib/store.ts && git commit -m "feat(store): per-project unread set, editor-interaction clock, saveProjectById"`

---

## Task 4: Store — `finishStreaming` becomes project-targeted (the spine)

**Files:**
- Modify: `src/lib/store.ts:333-1022` (`finishStreaming`).

This is the core change. Read the whole function first.

- [ ] **Step 1: Change the signature.** Add `streamProjectId` as the FIRST parameter:

```ts
  finishStreaming: (
    streamProjectId: string | null,
    fullContent: string,
    sheetOperationsArg?: SheetOperation[],
    docOperationsArg?: DocOperation[],
    kuOperationsArg?: KuOperation[],
    tableOperationsArg?: TableOperation[],
    deckOperations?: DeckOperation[],
    pageOperations?: PageOperation[],
    suggestions?: string[]
  ) => {
```

- [ ] **Step 2: Compute the target + disposition** at the top of the body, right after `const state = get();` (line 343):

```ts
    const targetProjectId = streamProjectId ?? state.currentProjectId;
    const editingDifferentEntity = isActivelyEditing({
      currentEntityId: state.currentEntityId,
      lastInteractionAt: state.lastEditorInteractionAt,
      now: Date.now(),
    });
    const disposition = resolveStreamDisposition({
      streamProjectId,
      currentProjectId: state.currentProjectId,
      editingDifferentEntity,
    });
    const isForeground = disposition.mode !== "background";
    const allowFocusSteal = disposition.mode === "foreground-open";
```

Add imports at the top of `store.ts`:
```ts
import { resolveStreamDisposition, isActivelyEditing } from "@/lib/streamDisposition";
import type { ProducedEntity } from "@/lib/types";
```

- [ ] **Step 3: Target the correct project for entity ops.** Replace the project lookup at line 464-469:

```ts
      if (!targetProjectId) {
        console.error("[Primy] Entity operations received but no target project");
        toast.error("No active project. AI changes could not be applied. Please try again.");
      }
      newProjects = [...state.projects];
      const projIdx = newProjects.findIndex((p) => p.id === targetProjectId);
```

In the deck image-fetch closure (lines 731-739), it re-reads `store.currentProjectId` and `store.deckSlides`. Make it target by deck id within the right project and only touch flat `deckSlides` when that deck is the active entity:

```ts
                          const projects = [...store.projects];
                          const pIdx = projects.findIndex((p) => p.id === targetProjectId);
                          if (pIdx >= 0) {
                            const proj = { ...projects[pIdx] };
                            const dIdx = (proj.decks || []).findIndex((d) => d.id === deckId);
                            if (dIdx >= 0) {
                              proj.decks = [...proj.decks];
                              const mergedSlides = proj.decks[dIdx].slides.map((slide) =>
                                slide.id === s.id ? { ...slide, backgroundImage: firstResult.urls.regular } : slide
                              );
                              proj.decks[dIdx] = { ...proj.decks[dIdx], slides: mergedSlides };
                              projects[pIdx] = proj;
                              const patch: Record<string, any> = { projects };
                              // Only update the live deck buffer if THIS deck is the one on screen.
                              if (useAppStore.getState().currentEntityId === deckId) {
                                patch.deckSlides = mergedSlides;
                              }
                              useAppStore.setState(patch);
                            }
                          }
```

(Remove the prior `store.updateDeckSlides(updatedSlides)` call — it wrote the wrong project's buffer.)

- [ ] **Step 4: Collect produced entities + gate focus-steal.** Throughout the KU/Table/Deck/Page **CREATE** and **UPDATE** branches, the lines that set `newCurrentEntityId` / `newCurrentEntityType` / `newDocContent` / `newDeckSlides` / `newPageHtml` / `newActiveTab` / `newDeckPhase` and push to `newOpenTabs` must become conditional on `allowFocusSteal`, and every create/update must record a `ProducedEntity`.

Introduce near line 460:

```ts
    const produced: ProducedEntity[] = [];
```

Pattern for **KU CREATE** (replace lines 487-497):

```ts
                project.knowledgeUnits.push(newKu);
                produced.push({ id: newKu.id, type: "ku", title: newKu.title, action: "created" });
                if (allowFocusSteal) {
                  newCurrentEntityId = newKu.id;
                  newCurrentEntityType = "ku";
                  newDocContent = newKu.content;
                  newDocVersion = state.docVersion + 1;
                  newActiveTab = "doc";
                  if (!newOpenTabs.some((t) => t.id === newKu.id)) {
                    newOpenTabs = [...newOpenTabs, { id: newKu.id, type: "ku" as const, title: newKu.title }];
                  }
                }
```

Apply the SAME shape to:
- **Table CREATE** (analogous block — find it between KU and deck handling; record `produced` with `type: "table"`, gate `newCurrentEntityId`/`newActiveTab = "sheet"`/`newSheets`/tab push on `allowFocusSteal`).
- **Deck CREATE** (lines 697-712): gate `newCurrentEntityId`, `newCurrentEntityType`, `newDeckSlides`, `newDeckTheme`, `newDeckStyle`, `newDeckVersion`, `newDeckPhase = "viewing"`, and the `newOpenTabs` push on `allowFocusSteal`. Always `produced.push({ id: newDeck.id, type: "deck", title: newDeck.title, action: "created" })`. **`newPendingDeckPolishId` should still be set regardless** (polish runs in background; it reads the deck by id) — but verify the polish consumer targets the right project/deck; if it relies on the active deck buffer, only set it when `allowFocusSteal`. Default: only set `newPendingDeckPolishId` when `allowFocusSteal` to avoid polishing a deck that isn't loaded into the live buffer.
- **Page CREATE** (lines 807-826): gate `newCurrentEntityId`/`newCurrentEntityType`/`newPageHtml`/`newPageEditableFields`/`newPageVersion`/tab push on `allowFocusSteal`. Always record `produced`.

For **UPDATE** branches (KU 500-519, deck 749-772, page 829-849, table analog): keep the existing `if (state.currentEntityId === op.xId)` guards for flat-field writes — those are correct (they only fire when that entity is the one on screen, which can only be true in the foreground). Add `produced.push({ id: op.xId, type, title, action: "updated" })` in each UPDATE that lands (look up the title from the updated entity). The `newOpenTabs` push inside UPDATE branches should be gated on `allowFocusSteal` too (don't add tabs to a project the user isn't looking at — though tabs are per-project state that gets reset on switch, so this is mostly cosmetic; gate it for cleanliness).

- [ ] **Step 5: Attach `producedEntities` to the assistant message.**

```ts
    const newMessage = {
      id: nanoid(),
      role: "assistant" as const,
      content: displayContent,
      timestamp: Date.now(),
      producedEntities: produced.length > 0 ? produced : undefined,
    };
```

- [ ] **Step 6: Route the message + final `set()` by disposition.** The big `set({...})` at line 884-918 currently always writes flat fields and `messages: [...state.messages, newMessage]`. Split it:

For the **assistant message**: it must land in the TARGET project's `messages`. When foreground, also mirror to the live `messages` field.

Before the `set`, update the target project's stored messages inside `newProjects` (so background projects persist their chat):

```ts
    // Ensure the new assistant message is recorded on the TARGET project's
    // stored history regardless of which project is on screen.
    {
      const tIdx = newProjects.findIndex((p) => p.id === targetProjectId);
      if (tIdx >= 0) {
        const tProj = { ...newProjects[tIdx] };
        // Foreground: live `messages` already has the user msg + will get newMessage.
        // Background: the live `messages` belongs to a DIFFERENT project, so append
        // to the target project's own history (which is not the live buffer).
        if (isForeground) {
          tProj.messages = [...state.messages, newMessage];
        } else {
          tProj.messages = [...(tProj.messages || []), newMessage];
        }
        newProjects[tIdx] = tProj;
      }
    }
```

Then build the `set()` payload conditionally:

```ts
    const basePatch: Record<string, any> = {
      isStreaming: false,
      streamingContent: "",
      readingFiles: [],
      aiPhase: 'done' as const,
      streamingAction: null,
      projects: newProjects,
      undoStack: newUndoStack,
      canUndo: newUndoStack.length > 0,
      redoStack: hasAnyOps ? [] : state.redoStack,
      canRedo: hasAnyOps ? false : state.canRedo,
      suggestions: isForeground ? (suggestions || []) : state.suggestions,
    };

    if (isForeground) {
      Object.assign(basePatch, {
        messages: [...state.messages, newMessage],
        sheets: newSheets,
        sheetVersion: newSheetVersion,
        pendingSheetImages: newPendingImages,
        docContent: newDocContent,
        docVersion: newDocVersion,
        deckSlides: newDeckSlides,
        deckTheme: newDeckTheme,
        deckVersion: newDeckVersion,
        deckPhase: newDeckPhase,
        deckStyle: newDeckStyle,
        pendingDeckPolishId: newPendingDeckPolishId,
        pageHtml: newPageHtml,
        pageEditableFields: newPageEditableFields,
        pageVersion: newPageVersion,
        activeTab: newActiveTab,
        workspaceOpen: state.workspaceOpen || !!shouldOpen,
        currentEntityId: newCurrentEntityId,
        currentEntityType: newCurrentEntityType,
        openTabs: newOpenTabs,
        aiModifiedEntityIds: aiModifiedIds.length > 0 ? aiModifiedIds : state.aiModifiedEntityIds,
      });
    }

    set(basePatch);

    if (!isForeground && targetProjectId) {
      get().markProjectUnread(targetProjectId);
    }
```

Note: in `foreground-quiet` mode, `allowFocusSteal` is false so `newCurrentEntityId` etc. still equal `state.currentEntityId` (unchanged) — applying them is a safe no-op that keeps the user on their current entity. Good.

- [ ] **Step 7: Persist the background project.** Near the existing save block (line 989-992), replace/augment:

```ts
    // Auto-save (debounced for batching) — active project only.
    if (isForeground && state.currentProjectId) {
      scheduleDebouncedSave();
    } else if (!isForeground && targetProjectId) {
      // The debounced save only covers the active project; persist the target.
      get().saveProjectById(targetProjectId);
    }
```

Guard the delete-sync block (line 967-987) and snapshot block (line 997-1018) and `autoGenerateTitle` (line 1021) so they reference `targetProjectId` not `state.currentProjectId`, and the snapshot only runs when `isForeground` (it reads live flat buffers which are only valid for the foreground entity). Concretely: change the delete-sync `if (state.currentProjectId)` → `if (targetProjectId)` and use `targetProjectId` in its body; wrap the snapshot block in `if (isForeground && hasAnyOps && ...)`.

- [ ] **Step 8: Typecheck.** `npx tsc --noEmit` — Expected: only `finishStreaming` call-site arity errors in `ChatPanel.tsx` (fixed in Task 5).

- [ ] **Step 9: Commit.** `git add src/lib/store.ts && git commit -m "feat(store): project-targeted finishStreaming — no cross-project leak, no focus steal"`

---

## Task 5: ChatPanel — stamp the stream with its origin project

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx:75-615` (`sendMessage`).

- [ ] **Step 1: Capture `streamProjectId` at send.** Right after the auto-create-project block (line 88-91) and before `startStreaming()`, capture the project the stream belongs to:

```ts
      const streamProjectId = useAppStore.getState().currentProjectId;
```

(After auto-create, `currentProjectId` is set, so this is non-null in the normal path.)

- [ ] **Step 2: Thread it through EVERY `finishStreaming` call.** There are four call sites (lines ~539, ~549, ~579, ~581/584). Each gains `streamProjectId` as the new first argument:

```ts
          finishStreaming(streamProjectId, contentForFinish, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps, suggestions);
```
```ts
          finishStreaming(streamProjectId, extractDisplayText(fullText) || fullText);
```
```ts
                finishStreaming(streamProjectId, extractDisplayText(partial) || partial, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps);
```
```ts
                finishStreaming(streamProjectId, extractDisplayText(partial) || partial);
```
```ts
              finishStreaming(streamProjectId, extractDisplayText(partial) || partial);
```

- [ ] **Step 3: Typecheck + build.** `npx tsc --noEmit && npm run build` — Expected: clean.

- [ ] **Step 4: Commit.** `git add src/components/chat/ChatPanel.tsx && git commit -m "feat(chat): stamp streams with origin project id"`

---

## Task 6: Artifact widget component + render in chat

**Files:**
- Create: `src/components/chat/ArtifactWidget.tsx`
- Modify: `src/components/chat/MessageBubble.tsx` (assistant branch, after `markdown-content`, ~line 134).

- [ ] **Step 1: Create the widget.** Uses `ENTITY_META` for icon/color/tint; clicking opens the entity via the matching store action. Apply design-system tokens, concentric radius, `press`/`hover-row`, monochrome-friendly icon tint, completion pulse via a `success-pop`-style one-shot.

```tsx
// src/components/chat/ArtifactWidget.tsx
"use client";

import { ENTITY_META } from "@/lib/entityMeta";
import type { ProducedEntity } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { ArrowUpRight } from "lucide-react";

export function ArtifactWidgetList({ entities, pulse }: { entities: ProducedEntity[]; pulse?: boolean }) {
  if (!entities.length) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-2.5">
      {entities.map((e, i) => (
        <ArtifactWidget key={e.id} entity={e} pulse={pulse} index={i} />
      ))}
    </div>
  );
}

function openProduced(entity: ProducedEntity) {
  const s = useAppStore.getState();
  switch (entity.type) {
    case "ku": s.openKnowledgeUnit(entity.id); break;
    case "table": s.openTable(entity.id); break;
    case "deck": s.openDeck(entity.id); break;
    case "page": s.openPage(entity.id); break;
  }
  // Ensure the workspace canvas is visible after opening from chat.
  useAppStore.setState({ workspaceOpen: true });
}

function ArtifactWidget({ entity, pulse, index }: { entity: ProducedEntity; pulse?: boolean; index: number }) {
  const meta = ENTITY_META[entity.type] || ENTITY_META.ku;
  const Icon = meta.Icon;
  return (
    <button
      onClick={() => openProduced(entity)}
      className={`group/aw flex items-center gap-2.5 w-full max-w-[300px] px-3 py-2 rounded-[10px] text-left press hover-row ${pulse ? "success-pop" : "stagger-in"}`}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-card)",
        ["--stagger-index" as string]: index,
      }}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-[8px] flex-shrink-0" style={{ background: meta.bg }}>
        <Icon className="w-4 h-4" strokeWidth={1.8} style={{ color: meta.color }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{entity.title}</span>
        <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
          {meta.label} {entity.action === "created" ? "created" : "updated"}
        </span>
      </span>
      <ArrowUpRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover/aw:opacity-100 t-fast" style={{ color: "var(--ink-3)" }} aria-hidden />
    </button>
  );
}
```

If `--stagger-index` / `stagger-in` / `success-pop` are not the exact class/var names in `src/styles/motion.css`, use the names that exist (check the file). Do NOT introduce new keyframes — reuse existing motion primitives only. Respect `prefers-reduced-motion` (the existing classes already do).

- [ ] **Step 2: Render in `MessageBubble`.** In the assistant branch, immediately after the `markdown-content` div (after line 134), add:

```tsx
          {message.producedEntities && message.producedEntities.length > 0 && (
            <ArtifactWidgetList entities={message.producedEntities} pulse={isLastAssistant} />
          )}
```

Add the import at top: `import { ArtifactWidgetList } from "./ArtifactWidget";`

- [ ] **Step 3: Verify in browser** (manual). Generate a doc in the active project → a clickable widget appears under the assistant message → clicking opens the doc. (Covered by Task 9 QA.)

- [ ] **Step 4: Commit.** `git add src/components/chat/ArtifactWidget.tsx src/components/chat/MessageBubble.tsx && git commit -m "feat(chat): clickable artifact widget for AI-produced entities"`

---

## Task 7: Sidebar unread dot

**Files:**
- Modify: `src/components/shell/v2/AppShellV2.tsx` (workspace row, lines 368-389; add a store selector near line 252).

- [ ] **Step 1: Select the unread set.** Near `const switchProject = useAppStore((s) => s.switchProject);` (line 252) add:

```ts
  const aiUnreadProjectIds = useAppStore((s) => s.aiUnreadProjectIds);
```

- [ ] **Step 2: Render the dot.** In the workspace row `<button>` (lines 381-388), compute `const isUnread = !isActive && aiUnreadProjectIds.includes(p.id);` inside the `.map` and render an amber dot before the title:

```tsx
            return (
              <button key={p.id}
                onClick={() => goWorkspace(p.id)}
                onContextMenu={(ev) => { ev.preventDefault(); setWsMenu({ id: p.id, title: p.title || "Untitled", x: ev.clientX, y: ev.clientY }); }}
                className="flex items-center gap-2 w-full h-[36px] px-3 mb-0.5 rounded-full press hover-row text-left text-[13px]"
                style={{ background: isActive ? "var(--sidebar-accent)" : "transparent", color: isActive ? "var(--ink)" : "var(--ink-2)", fontWeight: isActive ? 500 : 400 }}>
                <span className="flex-1 truncate">{p.title || "Untitled"}</span>
                {isUnread && (
                  <span
                    aria-label="New AI result"
                    className="w-[7px] h-[7px] rounded-full flex-shrink-0 success-pop"
                    style={{ background: "var(--accent-amber, #FFB43F)" }}
                  />
                )}
              </button>
            );
```

`goWorkspace` already calls `switchProject`, which now clears the unread flag (Task 3, Step 4), so the dot disappears on entry.

- [ ] **Step 3: Typecheck + build.** `npx tsc --noEmit && npm run build` — Expected: clean.

- [ ] **Step 4: Commit.** `git add src/components/shell/v2/AppShellV2.tsx && git commit -m "feat(shell): unread dot on workspaces with finished AI work"`

---

## Task 8: Editor interaction tracking (drives foreground-quiet)

**Files:**
- Modify: the editor change handlers — document editor (`src/components/doc/DocView.tsx`), sheet editor (`src/components/**/SheetView.tsx`), deck editor, page editor. Find each component's existing onChange/onUpdate/onInput path.

- [ ] **Step 1: Call `noteEditorInteraction()` on user edits.** In each editor's change handler (the one that fires on user typing/editing, NOT on programmatic AI writes), call:

```ts
useAppStore.getState().noteEditorInteraction();
```

For Plate/doc: in the `onChange`/`onValueChange` that fires from user input. For Univer sheet: in the cell-edit / command-executed user handler (guard against the programmatic `sheetVersion`-bump remounts so AI writes don't count as user interaction — only count genuine user edits). For deck/page: their text-field edit handlers.

Be conservative: it is fine if a few programmatic changes slip through (worst case: a freshly AI-written entity briefly counts as "being edited", which only suppresses an auto-open — the widget still appears). But do NOT call it from pure render or from AI-apply paths if easily avoidable.

- [ ] **Step 2: Build.** `npm run build` — Expected: clean.

- [ ] **Step 3: Commit.** `git add -A && git commit -m "feat(editors): record user interaction timestamp for focus-steal gating"`

---

## Task 9: Verification

- [ ] **Step 1: Unit tests.** `npm run test:run` — Expected: all pass incl. `streamDisposition.test.ts`.
- [ ] **Step 2: Lint + motion lint.** `npm run lint && npm run lint:motion` — Expected: 0 errors.
- [ ] **Step 3: Build.** `npm run build` — Expected: clean.
- [ ] **Step 4: Manual QA in browser** (drive the running app):
  1. Project A: ask for a deck. While generating, switch to Project B. → You stay in B. B's chat/canvas are untouched. Project A row shows an amber dot.
  2. Click Project A. → Dot clears. The deck exists in A; the assistant message has a clickable widget; clicking opens the deck.
  3. Project A, idle (not editing): ask for a doc. → Auto-opens the doc (foreground-open). Widget present.
  4. Project A: open a doc, type in it, then ask chat for a NEW sheet. → You stay in the doc you're typing; the sheet is created; a pulsing widget appears; clicking it opens the sheet (foreground-quiet, no focus steal).
  5. Confirm no cross-project content ever appears in the wrong project.

---

## Self-Review Notes

- **Spec coverage:** (1) stream stamped at send → Task 5; (2) results land in origin project → Task 4 Step 3/6/7; (3) never auto-switch → background mode never touches active flat fields; (4) idle-in-project → foreground-open auto-opens → Task 4 Step 4 gated by `allowFocusSteal`; (5) editing-elsewhere → foreground-quiet widget+pulse, no steal → Tasks 4 + 8; (6) sidebar dot + clear on entry → Tasks 3/7; (7) artifact widget, multiple per turn → Task 6; (8) per-project deckPhase isolation → only mutated in foreground (Task 4 Step 4/6); (9) visual completion cue, no sound → `success-pop` pulse on widget + dot.
- **Background persistence:** `saveProjectById` (Task 3) covers projects the debounced save misses.
- **Type consistency:** `finishStreaming(streamProjectId, …)` signature defined in Task 4 matches all five call sites in Task 5. `ProducedEntity` defined in Task 1 used in Tasks 4 & 6. `markProjectUnread`/`clearProjectUnread`/`noteEditorInteraction`/`saveProjectById` defined in Task 3, consumed in Tasks 4/7/8.
- **Risk:** `finishStreaming` is large and coupled — Tasks 3+4 must be done by one worker sequentially. Tasks 6, 7, 8 touch disjoint files and can run in parallel after the spine lands.
