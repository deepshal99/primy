"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q ? entities.filter((e) => e.title.toLowerCase().includes(q)) : entities;
    return list.slice(0, 8);
  }, [entities, query]);

  // Detect "@" + query from the DOM selection.
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
    const rect = range.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
    setQuery(q);
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
      const q = query;
      // Remove the "@" + query the user typed (q.length + 1 chars) in one atomic delete.
      editor.tf.delete({ reverse: true, unit: "character", distance: q.length + 1 } as any);
      editor.tf.insertNodes(createMentionNode(ref) as any);
      editor.tf.insertText(" ");
      close();
      try { editor.tf.focus(); } catch { /* noop */ }
    },
    [editor, query, close]
  );

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
      className="fixed z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1"
      style={{ top: pos.top, left: pos.left, boxShadow: "var(--shadow-pane)" }}
      role="listbox"
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
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm",
              i === active ? "bg-[rgba(24,24,22,0.05)]" : "",
            ].join(" ")}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-md shrink-0"
              style={{ backgroundColor: meta.bg }}
            >
              <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
            </span>
            <span className="truncate flex-1" style={{ color: "var(--ink)" }}>{ref.title}</span>
            <span className="text-[11px] shrink-0" style={{ color: "var(--ink-3)" }}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
