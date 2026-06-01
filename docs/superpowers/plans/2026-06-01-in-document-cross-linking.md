# In-Document Cross-Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type `@` inside a document to insert a clickable, preview-on-hover chip linking to any other entity (doc/sheet/deck/page), and show each document a "Linked from" backlinks footer.

**Architecture:** A custom inline-void Plate element (`mention`) registered via `createPlatePlugin` (same pattern the repo uses for `hr`/`tr`/`td`). A plain-React caret-anchored popover handles the `@` picker. Links persist in markdown as `[@Title](drafta://<type>/<id>)` — serialized via a markdown `rules` entry and rehydrated by post-walking the tree in `mdToValue`. Backlinks come from a hook that scans the project's documents for `drafta://` references. **No new dependencies.**

**Tech Stack:** Plate.js v52 (`platejs/react`, `@platejs/markdown`), Zustand store, React 19, Tailwind v4, lucide-react.

> **Note on testing:** This repo has **no test framework** (`CLAUDE.md`: "No test framework is configured"). Verification steps are therefore manual: TypeScript type-checking (`npx tsc --noEmit`), `npm run lint`, a throwaway Node script for pure functions, and dogfooding in `npm run dev`. Do **not** add a test runner.

---

## File Structure

**New files**
- `src/lib/entityLinks.ts` — `drafta://` URI format/parse, the `mention` Slate-node factory, the open-entity dispatcher, and the `useBacklinks` hook. Pure/near-pure logic, no JSX.
- `src/components/doc/mention/MentionElement.tsx` — the inline chip element component (resolve entity, color pill, click-to-open, stale handling, hover trigger).
- `src/components/doc/mention/EntityHoverCard.tsx` — type-switched preview popover content.
- `src/components/doc/mention/MentionCombobox.tsx` — the `@` picker (caret detection, entity list, filter, keyboard nav, insert).

**Modified**
- `src/components/doc/DocView.tsx` — register the mention plugin, add the markdown serialize rule, post-walk deserialize in `mdToValue`, render `<MentionCombobox />`, render the backlinks footer.

---

## Reference facts (verified against the codebase — do not re-discover)

- `EntityType = "ku" | "table" | "deck" | "page"` (`src/lib/types.ts:295`).
- `ENTITY_META: Record<EntityType, { label; group; color; bg; Icon }>` (`src/lib/entityMeta.ts:20`). `Icon` is a lucide component.
- Store open actions (call via `useAppStore.getState()`): `openKnowledgeUnit(id)`, `openTable(id)`, `openDeck(id)`, `openPage(id)` (`src/lib/store.ts:1692/1880/2047/2234`).
- Store project data: `useAppStore` state has `projects` (array) and `currentProjectId`. A project has `knowledgeUnits`, `tables`, `decks`, `pages` (some optional). See the entity-collection block in `src/components/chat/ChatInput.tsx:86-103` for the exact access pattern.
- Store doc state: `docContent: string`, `currentEntityId: string | null`, `currentEntityType: EntityType | null` (`src/lib/store.ts:505,548`).
- `DocView.tsx`: editor created at line 349; `plugins` memo at 312-347; `mdToValue` at 288-294; `MarkdownPlugin.configure({ options: { remarkPlugins:[remarkGfm] } })` at 321; `serializeMd(editor)` used in `handleChange` at 384; AI-sync `setValue` at 364; `<Plate editor={editor} onChange={handleChange}>` wraps `<PlateContent/>` at ~623.
- Custom node registration pattern already in file: `createPlatePlugin({ key: "tr", node: { isElement: true, component: TableRowElement } })` (`DocView.tsx:330`). `createPlatePlugin`, `useEditorRef` already imported from `platejs/react` (`DocView.tsx:4`).
- `@platejs/markdown` `MdRules` shape: `{ [nodeKey]: { serialize(slateNode, opts) => mdastNode; deserialize?(mdastNode, deco, opts) => slateNode } }` (`node_modules/@platejs/markdown/dist/index.d.ts:171-180`). Pass via `MarkdownPlugin.configure({ options: { remarkPlugins, rules } })`.

---

## Task 1: `entityLinks.ts` — URI helpers, node factory, dispatcher, backlinks hook

**Files:**
- Create: `src/lib/entityLinks.ts`

- [ ] **Step 1: Write the module**

```ts
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";

export const DRAFTA_SCHEME = "drafta://";

/** Matches drafta://<type>/<id> inside arbitrary text (g flag for scanning). */
export const DRAFTA_URI_RE = /drafta:\/\/(ku|table|deck|page)\/([A-Za-z0-9_-]+)/g;

export interface EntityRef {
  id: string;
  type: EntityType;
  title: string;
}

/** Build a stable cross-link URI. */
export function formatEntityUri(type: EntityType, id: string): string {
  return `${DRAFTA_SCHEME}${type}/${id}`;
}

/** Parse a single drafta:// URI. Returns null if it isn't one or is malformed. */
export function parseEntityUri(uri: string): { type: EntityType; id: string } | null {
  if (!uri || !uri.startsWith(DRAFTA_SCHEME)) return null;
  const rest = uri.slice(DRAFTA_SCHEME.length); // "<type>/<id>"
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const type = rest.slice(0, slash) as EntityType;
  const id = rest.slice(slash + 1);
  if (!id) return null;
  if (type !== "ku" && type !== "table" && type !== "deck" && type !== "page") return null;
  return { type, id };
}

/** The Slate node shape for an inline cross-link chip. */
export interface MentionNode {
  type: "mention";
  entityType: EntityType;
  entityId: string;
  value: string; // title snapshot for graceful display if target is deleted
  children: [{ text: "" }];
}

export function createMentionNode(ref: EntityRef): MentionNode {
  return {
    type: "mention",
    entityType: ref.type,
    entityId: ref.id,
    value: ref.title,
    children: [{ text: "" }],
  };
}

/** Open an entity by type using the existing store actions. */
export function openEntity(type: EntityType, id: string): void {
  const s = useAppStore.getState();
  switch (type) {
    case "ku":
      s.openKnowledgeUnit(id);
      break;
    case "table":
      s.openTable(id);
      break;
    case "deck":
      s.openDeck(id);
      break;
    case "page":
      s.openPage(id);
      break;
  }
}

/** Collect every entity in the current project as EntityRef[] (for the picker). */
export function useProjectEntities(): EntityRef[] {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const out: EntityRef[] = [];
    for (const ku of project.knowledgeUnits || []) out.push({ id: ku.id, type: "ku", title: ku.title });
    for (const t of project.tables || []) out.push({ id: t.id, type: "table", title: t.title });
    for (const d of project.decks || []) out.push({ id: d.id, type: "deck", title: d.title });
    for (const p of project.pages || []) out.push({ id: p.id, type: "page", title: p.title });
    return out;
  }, [projects, currentProjectId]);
}

/** Resolve an entity's current title; undefined if it no longer exists. */
export function useResolvedEntity(type: EntityType, id: string): EntityRef | undefined {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return undefined;
    const list =
      type === "ku" ? project.knowledgeUnits
      : type === "table" ? project.tables
      : type === "deck" ? project.decks
      : project.pages;
    const found = (list || []).find((e: { id: string }) => e.id === id) as { id: string; title: string } | undefined;
    return found ? { id, type, title: found.title } : undefined;
  }, [projects, currentProjectId, type, id]);
}

/** Documents that reference the given entity id (scans markdown content). */
export function useBacklinks(targetId: string | null): EntityRef[] {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  // docContent is the live (possibly-unsaved) body of the open doc; include it
  // so the open doc's own outgoing edits don't matter, but saved KUs are scanned.
  return useMemo(() => {
    if (!targetId) return [];
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const out: EntityRef[] = [];
    for (const ku of project.knowledgeUnits || []) {
      if (ku.id === targetId) continue; // no self-backlink
      const content: string = ku.content || "";
      if (content.includes(`${DRAFTA_SCHEME}`) && content.includes(`/${targetId}`)) {
        // Confirm it's a real drafta ref to this id, not a coincidental substring.
        DRAFTA_URI_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        let hit = false;
        while ((m = DRAFTA_URI_RE.exec(content)) !== null) {
          if (m[2] === targetId) { hit = true; break; }
        }
        if (hit) out.push({ id: ku.id, type: "ku", title: ku.title });
      }
    }
    return out;
  }, [projects, currentProjectId, targetId]);
}
```

- [ ] **Step 2: Type-check the module**

Run: `npx tsc --noEmit`
Expected: PASS (no errors referencing `src/lib/entityLinks.ts`). If the store's `projects`/`pages`/`decks` typing complains, narrow with the same access already used in `ChatInput.tsx:86-103` (those are the source of truth for shape).

- [ ] **Step 3: Smoke-test the pure functions**

Create a throwaway file `/tmp/el.test.mjs` and run it with `node`:

```js
// Mirror the pure logic to confirm behavior (no imports from the app).
const DRAFTA_SCHEME = "drafta://";
const RE = /drafta:\/\/(ku|table|deck|page)\/([A-Za-z0-9_-]+)/g;
function parse(uri){ if(!uri?.startsWith(DRAFTA_SCHEME))return null; const r=uri.slice(9); const i=r.indexOf("/"); if(i<=0)return null; const t=r.slice(0,i),id=r.slice(i+1); if(!id)return null; if(!["ku","table","deck","page"].includes(t))return null; return {type:t,id}; }
console.assert(JSON.stringify(parse("drafta://ku/abc123"))==='{"type":"ku","id":"abc123"}', "parse ku");
console.assert(parse("https://x.com")===null, "non-drafta");
console.assert(parse("drafta://bad/abc")===null, "bad type");
RE.lastIndex=0; const found=[...("see [@A](drafta://table/t1) and [@B](drafta://ku/k2)".matchAll(RE))].map(m=>m[2]);
console.assert(JSON.stringify(found)==='["t1","k2"]', "scan ids");
console.log("entityLinks logic OK");
```

Run: `node /tmp/el.test.mjs`
Expected: prints `entityLinks logic OK` with no assertion errors. Then `rm /tmp/el.test.mjs`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/entityLinks.ts
git commit -m "feat(doc): entityLinks helpers for cross-linking (uri, node, backlinks)"
```

---

## Task 2: `MentionElement` chip + register the mention plugin in DocView

**Files:**
- Create: `src/components/doc/mention/MentionElement.tsx`
- Modify: `src/components/doc/DocView.tsx` (import + add to `plugins` memo at 312-347)

- [ ] **Step 1: Write `MentionElement.tsx` (chip only; hovercard added in Task 5)**

```tsx
"use client";

import { useState } from "react";
import { PlateElement, useReadOnly } from "platejs/react";
import { ENTITY_META } from "@/lib/entityMeta";
import { openEntity, useResolvedEntity } from "@/lib/entityLinks";
import type { EntityType } from "@/lib/types";
import { toast } from "@/components/ui/AppToaster";

export function MentionElement(props: any) {
  const { element } = props;
  const entityType = element.entityType as EntityType;
  const entityId = element.entityId as string;
  const snapshotTitle = (element.value as string) || "Untitled";
  const readOnly = useReadOnly();
  const resolved = useResolvedEntity(entityType, entityId);
  const exists = !!resolved;
  const title = resolved?.title || snapshotTitle;
  const meta = ENTITY_META[entityType] || ENTITY_META.ku;
  const Icon = meta.Icon;
  const [hovered, setHovered] = useState(false); // used by Task 5

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!exists) {
      toast.error("This item no longer exists");
      return;
    }
    openEntity(entityType, entityId);
  };

  return (
    <PlateElement {...props} as="span" className="inline-block align-baseline">
      <span
        contentEditable={false}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(e as any); }
        }}
        className={[
          "relative inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md",
          "text-[0.92em] font-medium leading-tight cursor-pointer select-none align-baseline",
          "transition-colors press",
          exists ? "" : "opacity-50 cursor-not-allowed line-through",
        ].join(" ")}
        style={
          exists
            ? { color: meta.color, backgroundColor: meta.bg }
            : { color: "var(--ink-muted, #B9B6AE)", backgroundColor: "rgba(24,24,22,0.04)" }
        }
        title={exists ? `Open ${meta.label.toLowerCase()}: ${title}` : "Item unavailable"}
      >
        <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
        <span>@{title}</span>
      </span>
      {props.children}
    </PlateElement>
  );
}
```

> Note: `useReadOnly` and `PlateElement` come from `platejs/react` (already a dependency). `toast` import path is `@/components/ui/AppToaster` — confirm the export name; if it exports `toast` differently, match it (the repo added `src/components/ui/AppToaster.tsx`). If no `toast` is exported, fall back to `import { toast } from "sonner"` only if `sonner` is in deps, else drop the toast and make a no-op.

- [ ] **Step 2: Verify the toast import is real**

Run: `grep -nE "export (const|function|\{).*toast|from \"sonner\"" src/components/ui/AppToaster.tsx`
Expected: shows how `toast` is exported. Adjust the import in Step 1 to match exactly. (`ChatInput.tsx:285` already calls `toast.error(...)` — copy its import line verbatim: `grep -n "toast" src/components/chat/ChatInput.tsx | head -1`.)

- [ ] **Step 3: Register the plugin in `DocView.tsx`**

Add import near the other doc imports (after line 30):

```tsx
import { MentionElement } from "./mention/MentionElement";
```

Inside the `plugins` memo (the array at `DocView.tsx:313-345`), add as a new entry (e.g. after the `ImagePlugin.configure(...)` entry):

```tsx
      createPlatePlugin({
        key: "mention",
        node: {
          isElement: true,
          isInline: true,
          isVoid: true,
          component: MentionElement,
        },
      }),
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. No unused-import or type errors in the touched files.

- [ ] **Step 5: Visual smoke test (temporary hard-coded node)**

Temporarily change `DocView.tsx`'s `mdToValue` fallback OR the initial value to inject a mention node so you can see the chip render. Easiest: in `mdToValue`, after computing `value`, do **not** edit permanently — instead in dev, open a doc and run in the browser console isn't possible for Slate. So instead: in Task 4 the combobox will insert nodes. For now just confirm the build renders the editor with no crash:

Run: `npm run dev` and open any document.
Expected: editor loads normally (the new plugin is registered but no mention nodes exist yet, so nothing visually changes; no console errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/doc/mention/MentionElement.tsx src/components/doc/DocView.tsx
git commit -m "feat(doc): mention chip element + register inline-void mention plugin"
```

---

## Task 3: Markdown round-trip (serialize rule + deserialize post-walk)

**Files:**
- Modify: `src/components/doc/DocView.tsx` (`MarkdownPlugin.configure` at 321; `mdToValue` at 288)

- [ ] **Step 1: Add the serialize rule to `MarkdownPlugin.configure`**

Replace the existing configure block (`DocView.tsx:321-325`):

```tsx
      MarkdownPlugin.configure({
        options: {
          remarkPlugins: [remarkGfm],
        },
      }),
```

with:

```tsx
      MarkdownPlugin.configure({
        options: {
          remarkPlugins: [remarkGfm],
          rules: {
            mention: {
              serialize: (node: any) => ({
                type: "link",
                url: `drafta://${node.entityType}/${node.entityId}`,
                children: [{ type: "text", value: `@${node.value || ""}` }],
              }),
            },
          },
        },
      }),
```

- [ ] **Step 2: Add the deserialize post-walk to `mdToValue`**

Replace `mdToValue` (`DocView.tsx:288-294`):

```tsx
function mdToValue(editor: any, md: string) {
  try {
    return editor.getApi(MarkdownPlugin).markdown.deserialize(md);
  } catch {
    return [{ type: "p", children: [{ text: md || "" }] }];
  }
}
```

with:

```tsx
import { parseEntityUri } from "@/lib/entityLinks"; // add to imports at top of file

// Convert any link node whose url is drafta:// into a mention node, in place.
function hydrateMentions(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n) => {
    if (n && n.type === "a" || n?.type === "link") {
      const url: string = n.url || n.href || "";
      const parsed = parseEntityUri(url);
      if (parsed) {
        const text = (n.children?.[0]?.text ?? n.children?.[0]?.value ?? "").replace(/^@/, "");
        return {
          type: "mention",
          entityType: parsed.type,
          entityId: parsed.id,
          value: text,
          children: [{ text: "" }],
        };
      }
    }
    if (Array.isArray(n?.children)) {
      return { ...n, children: hydrateMentions(n.children) };
    }
    return n;
  });
}

function mdToValue(editor: any, md: string) {
  try {
    const value = editor.getApi(MarkdownPlugin).markdown.deserialize(md);
    return hydrateMentions(value);
  } catch {
    return [{ type: "p", children: [{ text: md || "" }] }];
  }
}
```

> The `import` line goes with the other top-of-file imports (after line 18's store import), not inside the function. The comment above just marks where it belongs.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Round-trip verification (after Task 4 exists you can insert via UI; for now verify the functions in isolation)**

Confirm the serialize shape by reading the Plate markdown source contract: a mdast `link` with `url` + a text child stringifies to `[text](url)`. This is standard mdast → confirmed by `remark-stringify`. No code change. Mark done once Steps 1-3 pass type-check; full round-trip is validated end-to-end in Task 4 Step 6 and Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/components/doc/DocView.tsx
git commit -m "feat(doc): persist cross-link chips as drafta:// markdown links (round-trip)"
```

---

## Task 4: `MentionCombobox` — the `@` picker

**Files:**
- Create: `src/components/doc/mention/MentionCombobox.tsx`
- Modify: `src/components/doc/DocView.tsx` (render inside `<Plate>`, near `<PlateContent/>` at ~623)

- [ ] **Step 1: Write `MentionCombobox.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useEditorRef } from "platejs/react";
import { ENTITY_META } from "@/lib/entityMeta";
import { createMentionNode, useProjectEntities, type EntityRef } from "@/lib/entityLinks";

interface Pos { top: number; left: number; }

export function MentionCombobox() {
  const editor = useEditorRef();
  const entities = useProjectEntities();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const [active, setActive] = useState(0);
  const triggerRangeRef = useRef<{ atOffset: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    triggerRangeRef.current = null;
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q ? entities.filter((e) => e.title.toLowerCase().includes(q)) : entities;
    return list.slice(0, 8);
  }, [entities, query]);

  // Detect "@" + query from the DOM selection on every selection/key change.
  const recompute = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) { close(); return; }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) { close(); return; }
    const text = node.textContent || "";
    const caret = range.startOffset;
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) { close(); return; }
    const charBefore = at > 0 ? before[at - 1] : " ";
    if (charBefore !== " " && charBefore !== "\n" && at !== 0) { close(); return; }
    const q = before.slice(at + 1);
    if (/\s/.test(q)) { close(); return; }
    // Position popover just below the caret.
    const rect = range.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
    setQuery(q);
    triggerRangeRef.current = { atOffset: at };
    setActive(0);
    setOpen(true);
  }, [close]);

  useEffect(() => {
    const handler = () => recompute();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [recompute]);

  const select = useCallback(
    (ref: EntityRef) => {
      // Delete the "@query" the user typed, then insert the mention node.
      const q = query;
      try {
        // Remove "@" + query: q.length + 1 characters before the caret.
        editor.tf.deleteBackward({ unit: "character", distance: q.length + 1 } as any);
      } catch {
        // Fallback: delete one char at a time
        for (let i = 0; i < q.length + 1; i++) {
          try { editor.tf.deleteBackward("character" as any); } catch { /* noop */ }
        }
      }
      editor.tf.insertNodes(createMentionNode(ref));
      editor.tf.insertText(" ");
      close();
      // Return focus to the editor
      try { editor.tf.focus(); } catch { /* noop */ }
    },
    [editor, query, close]
  );

  // Keyboard nav while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") {
        if (filtered[active]) { e.preventDefault(); select(filtered[active]); }
      } else if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, filtered, active, select, close]);

  if (!open || !pos || filtered.length === 0) return null;

  return (
    <div
      className="fixed z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-pane p-1 anim-pop"
      style={{ top: pos.top, left: pos.left }}
      role="listbox"
      // Prevent the editor from losing selection on mousedown
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.map((ref, i) => {
        const meta = ENTITY_META[ref.type] || ENTITY_META.ku;
        const Icon = meta.Icon;
        return (
          <button
            key={`${ref.type}:${ref.id}`}
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => select(ref)}
            className={[
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm hover-row",
              i === active ? "bg-[rgba(24,24,22,0.05)]" : "",
            ].join(" ")}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-md shrink-0"
              style={{ backgroundColor: meta.bg }}
            >
              <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
            </span>
            <span className="truncate flex-1 text-ink">{ref.title}</span>
            <span className="text-[11px] text-ink-tertiary shrink-0">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

> If `editor.tf.deleteBackward` does not accept the `{ unit, distance }` form in this Plate version, the loop fallback covers it. If `anim-pop`/`hover-row`/`text-ink-tertiary` classes don't exist, drop them — verify with `grep -rn "anim-pop\|hover-row\|text-ink-tertiary" src/styles src/app/globals.css`. Use whatever exists; otherwise plain Tailwind.

- [ ] **Step 2: Verify utility class names exist (adjust if not)**

Run: `grep -rnE "hover-row|shadow-pane|anim-pop|\.press|text-ink-tertiary" src/app/globals.css src/styles 2>/dev/null | head`
Expected: shows which exist. Replace any missing class with an equivalent inline style or existing token. (`shadow-pane`, `press`, `hover-row` are referenced in `CLAUDE.md` design system, so they should exist.)

- [ ] **Step 3: Render the combobox in `DocView.tsx`**

Add the import (after line 30):

```tsx
import { MentionCombobox } from "./mention/MentionCombobox";
```

Inside the `<Plate editor={editor} onChange={handleChange}>` JSX tree (around `DocView.tsx:623`), add `<MentionCombobox />` as a sibling of `<PlateContent/>` (must be inside `<Plate>` so `useEditorRef` resolves):

```tsx
      <Plate editor={editor} onChange={handleChange}>
        {/* existing children ... */}
        <PlateContent /* existing props */ />
        <MentionCombobox />
        {/* existing children ... */}
      </Plate>
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual test — insert a chip**

Run: `npm run dev`. Open a document. Make sure the project has at least one other entity (a sheet or another doc). Type `@`.
Expected:
- Popover appears below the caret listing entities.
- Typing filters; ArrowUp/Down moves the highlight; Enter inserts.
- A colored chip `@<Title>` appears inline; a trailing space follows; caret is after it.
- Clicking the chip opens that entity.

- [ ] **Step 6: Manual test — persistence round-trip**

After inserting a chip, switch to another entity tab and back (or reload the page).
Expected: the chip is still there (proves serialize → `drafta://` markdown → `hydrateMentions` deserialize works). To confirm the stored form, in DevTools Application/console inspect the saved project, or add a temporary `console.log(md)` in `handleChange` and confirm it contains `[@Title](drafta://<type>/<id>)`. Remove the log after.

- [ ] **Step 7: Commit**

```bash
git add src/components/doc/mention/MentionCombobox.tsx src/components/doc/DocView.tsx
git commit -m "feat(doc): @-mention combobox to insert entity cross-links"
```

---

## Task 5: `EntityHoverCard` previews + wire into the chip

**Files:**
- Create: `src/components/doc/mention/EntityHoverCard.tsx`
- Modify: `src/components/doc/mention/MentionElement.tsx` (show card on hover)

- [ ] **Step 1: Write `EntityHoverCard.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { ENTITY_META } from "@/lib/entityMeta";
import type { EntityType } from "@/lib/types";

function useEntityRecord(type: EntityType, id: string): any | undefined {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return undefined;
    const list =
      type === "ku" ? project.knowledgeUnits
      : type === "table" ? project.tables
      : type === "deck" ? project.decks
      : project.pages;
    return (list || []).find((e: { id: string }) => e.id === id);
  }, [projects, currentProjectId, type, id]);
}

/** Strip markdown to a short plain-text excerpt. */
function excerpt(md: string, lines = 3): string {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, lines)
    .join("  ·  ")
    .slice(0, 220);
}

export function EntityHoverCard({ type, id }: { type: EntityType; id: string }) {
  const rec = useEntityRecord(type, id);
  const meta = ENTITY_META[type] || ENTITY_META.ku;
  const Icon = meta.Icon;

  let body: React.ReactNode = null;
  if (!rec) {
    body = <span className="text-ink-tertiary text-xs">Unavailable</span>;
  } else if (type === "ku") {
    body = <p className="text-xs text-ink-secondary leading-relaxed line-clamp-3">{excerpt(rec.content) || "Empty document"}</p>;
  } else if (type === "table") {
    const sheet = rec.sheets?.[0];
    const cells: any[] = sheet?.celldata || [];
    const grid: string[][] = [];
    for (const c of cells) {
      if (c.r < 3 && c.c < 4) {
        grid[c.r] = grid[c.r] || [];
        grid[c.r][c.c] = String(c.v?.v ?? c.v ?? "");
      }
    }
    body = (
      <div className="grid gap-px bg-border rounded overflow-hidden" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {Array.from({ length: 3 }).flatMap((_, r) =>
          Array.from({ length: 4 }).map((__, c) => (
            <div key={`${r}-${c}`} className="bg-card px-1.5 py-1 text-[10px] text-ink-secondary truncate">
              {grid[r]?.[c] ?? ""}
            </div>
          ))
        )}
      </div>
    );
  } else if (type === "deck") {
    const count = rec.slides?.length ?? 0;
    const first = rec.slides?.[0];
    const titleText = first?.title || first?.heading || "Untitled slide";
    body = (
      <div className="text-xs text-ink-secondary">
        <div className="font-medium text-ink mb-0.5 line-clamp-1">{titleText}</div>
        <div className="text-ink-tertiary">{count} slide{count === 1 ? "" : "s"}</div>
      </div>
    );
  } else {
    body = <p className="text-xs text-ink-secondary line-clamp-2">{rec.title}</p>;
  }

  return (
    <div className="w-60 rounded-xl border border-border bg-card shadow-pane p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
      </div>
      <div className="text-sm font-medium text-ink mb-1.5 line-clamp-1">{rec?.title || "Untitled"}</div>
      {body}
    </div>
  );
}
```

> Field names (`rec.content`, `rec.sheets[].celldata`, `c.v.v`, `rec.slides[].title`) follow the repo's data shapes (`CellData` is `{r,c,v}`; deck slides have `title`/`heading`). If a field differs, adjust to the actual `src/lib/types.ts` shape — but these match the documented formats. `line-clamp-*` requires the Tailwind line-clamp utilities (built into Tailwind v4). If `text-ink-secondary`/`text-ink-tertiary` aren't real classes, replace with inline `style={{ color: 'var(--ink-secondary)' }}` etc.

- [ ] **Step 2: Wire the card into `MentionElement.tsx`**

In `MentionElement.tsx`, add the import:

```tsx
import { EntityHoverCard } from "./EntityHoverCard";
```

Add a small mount-delay so the card only shows after ~300ms hover, respecting reduced motion. Replace the `const [hovered, setHovered] = useState(false);` line and the two `onMouseEnter/onMouseLeave` handlers with:

```tsx
  const [showCard, setShowCard] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (!exists) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShowCard(true); return; }
    hoverTimer.current = setTimeout(() => setShowCard(true), 300);
  };
  const onLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowCard(false);
  };
```

Add `import { useRef } from "react";` (merge with the existing `useState` import → `import { useState, useRef } from "react";`).

Update the chip `<span>` handlers to `onMouseEnter={onEnter}` and `onMouseLeave={onLeave}`, and render the card absolutely positioned when `showCard`:

```tsx
        {showCard && (
          <span
            contentEditable={false}
            className="absolute left-0 top-full mt-1 z-50 anim-pop"
            style={{ pointerEvents: "none" }}
          >
            <EntityHoverCard type={entityType} id={entityId} />
          </span>
        )}
```

Place this inside the outer chip `<span>` (which is already `relative`), before `</span>`.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual test — hover previews**

Run: `npm run dev`. Insert chips to a doc, a sheet, and a deck. Hover each ~half a second.
Expected:
- doc → text excerpt card
- sheet → mini grid card
- deck → title + slide count card
- card appears below the chip, disappears on mouse-out
- With OS "reduce motion" on, the card appears instantly without the pop animation.

- [ ] **Step 5: Commit**

```bash
git add src/components/doc/mention/EntityHoverCard.tsx src/components/doc/mention/MentionElement.tsx
git commit -m "feat(doc): hover preview cards for cross-link chips"
```

---

## Task 6: Backlinks footer in DocView

**Files:**
- Modify: `src/components/doc/DocView.tsx` (render footer below `<PlateContent/>`)

- [ ] **Step 1: Import the hook + helpers**

Add to the imports at the top of `DocView.tsx`:

```tsx
import { useBacklinks, openEntity } from "@/lib/entityLinks";
import { ENTITY_META } from "@/lib/entityMeta";
```

> If `ENTITY_META` is already imported in DocView, don't duplicate. (Check first: `grep -n "entityMeta" src/components/doc/DocView.tsx`.)

- [ ] **Step 2: Compute backlinks inside the `DocView` component**

Near the other store reads at the top of `DocView()` (around `DocView.tsx:296-303`), add:

```tsx
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const backlinks = useBacklinks(currentEntityType === "ku" ? currentEntityId : null);
```

- [ ] **Step 3: Render the footer**

Immediately after the `</Plate>` close tag (or after the editor container, below `<PlateContent/>` but within the scrollable doc area), add:

```tsx
      {backlinks.length > 0 && (
        <div className="mx-auto max-w-3xl w-full mt-10 mb-16 px-4">
          <div className="border-t border-border pt-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary mb-2">
              Linked from
            </div>
            <div className="flex flex-wrap gap-1.5">
              {backlinks.map((b) => {
                const meta = ENTITY_META[b.type] || ENTITY_META.ku;
                const Icon = meta.Icon;
                return (
                  <button
                    key={`${b.type}:${b.id}`}
                    type="button"
                    onClick={() => openEntity(b.type, b.id)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card text-xs text-ink hover-row press"
                    title={`Open ${meta.label.toLowerCase()}: ${b.title}`}
                  >
                    <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
                    <span className="truncate max-w-[200px]">{b.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
```

> Match the existing doc content width container (`max-w-3xl` is a guess — check what `PlateContent` is wrapped in at `DocView.tsx` and reuse the same max-width/padding so the footer aligns with the body text).

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Manual test — backlinks**

Run: `npm run dev`. In document A, insert a chip linking to document B. Make sure A is saved (wait ~2s for debounce, or switch tabs). Open document B.
Expected: B shows a "Linked from" footer containing a chip for A. Click it → A opens. Remove the link in A, save, reopen B → the backlink is gone.

- [ ] **Step 6: Commit**

```bash
git add src/components/doc/DocView.tsx
git commit -m "feat(doc): 'Linked from' backlinks footer on documents"
```

---

## Task 7: Final QA pass + edge cases

**Files:** none (verification + small fixes only)

- [ ] **Step 1: Deleted-target behavior**

Link doc A → doc B. Delete B (via the UI). Reopen A.
Expected: the chip for B renders muted/struck-through; clicking it shows the "no longer exists" toast (or no-op if toast unavailable); no crash; hover shows "Unavailable".

- [ ] **Step 2: Self-link guard**

In doc A, insert a chip pointing to A itself (it appears in the picker). Save, reopen A.
Expected: clicking it is a harmless no-op (A already open); A does **not** appear in its own "Linked from" footer (the hook skips `ku.id === targetId`).

- [ ] **Step 3: Markdown sanity**

Temporarily add `console.log(md)` in `handleChange`, type a doc with a chip plus normal text and a normal external link `[Google](https://google.com)`.
Expected: the chip serializes to `[@Title](drafta://<type>/<id>)`; the external link stays `[Google](https://google.com)` and renders as a normal link (not a chip). Remove the log.

- [ ] **Step 4: AI-edit coexistence**

With a chip in the doc, run one of the existing AI doc edits (SelectionBubble "Improve"/"Expand" on nearby text, not on the chip).
Expected: the doc re-renders via the `docVersion` → `setValue` → `mdToValue` path and the chip survives (because `hydrateMentions` runs on that path too). No duplicate-key warnings, no crash.

- [ ] **Step 5: Full type-check, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS. Fix any errors surfaced.

- [ ] **Step 6: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "fix(doc): cross-linking QA pass — deleted targets, self-link, markdown coexistence"
```

---

## Self-Review Notes (coverage vs. spec)

- Insert via `@` picker → Task 4. ✅
- Inline colored chip, click-to-open → Task 2. ✅
- Hover preview (doc/sheet/deck/page) → Task 5. ✅
- Persistence as `drafta://` markdown + rehydrate → Task 3 (+ verified in Task 4 Step 6). ✅
- Backlinks "Linked from" footer + `useBacklinks` → Tasks 1 & 6. ✅
- Stale/deleted target handling → Tasks 2 & 7. ✅
- Self-link no-op + excluded from backlinks → Tasks 1 & 7. ✅
- Reduced-motion → Task 5. ✅
- No new dependencies → confirmed (custom plugin, plain-React popover). ✅
- Out-of-scope items (transclusion, card block, graph, AI-authored links, backlinks in sheet/deck/page views) → intentionally omitted. ✅
```