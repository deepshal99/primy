"use client";

import { useState, useCallback, useRef } from "react";
import { GripVertical, Plus, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { DeckOutlineItem } from "@/lib/types";

/* ── tiny id helper ── */
const uid = () => Math.random().toString(36).slice(2, 10);

export function DeckOutlineEditor() {
  const outline = useAppStore((s) => s.deckOutline);
  const setOutline = useAppStore((s) => s.setDeckOutline);
  const setPhase = useAppStore((s) => s.setDeckPhase);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);

  /* ── drag handlers ── */
  const handleDragStart = useCallback((idx: number) => {
    dragNode.current = idx;
    setDragIdx(idx);
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    setOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current !== null && overIdx !== null && dragNode.current !== overIdx) {
      const next = [...outline];
      const [moved] = next.splice(dragNode.current, 1);
      next.splice(overIdx, 0, moved);
      setOutline(next);
    }
    dragNode.current = null;
    setDragIdx(null);
    setOverIdx(null);
  }, [outline, overIdx, setOutline]);

  /* ── item CRUD ── */
  const updateItem = useCallback(
    (id: string, patch: Partial<DeckOutlineItem>) => {
      setOutline(outline.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [outline, setOutline],
  );

  const deleteItem = useCallback(
    (id: string) => setOutline(outline.filter((it) => it.id !== id)),
    [outline, setOutline],
  );

  const addItem = useCallback(() => {
    setOutline([
      ...outline,
      { id: uid(), title: "", description: "", layout: undefined },
    ]);
  }, [outline, setOutline]);

  /* ── empty guard ── */
  if (outline.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      {/* scrollable card list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {outline.map((item, idx) => {
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;

          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-start gap-2 rounded-lg border bg-white p-3",
                "transition-all duration-[120ms]",
                isDragging && "opacity-40",
                isOver && "border-[#d4582a] ring-1 ring-[#d4582a]/30",
                !isOver && "border-[#e8e7e4]",
              )}
            >
              {/* grip handle */}
              <button
                type="button"
                className="mt-1 cursor-grab text-[#b0ada6] hover:text-[#6b6b80] transition-colors duration-[120ms]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical size={16} />
              </button>

              {/* slide number */}
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#d4582a]/10 text-[11px] font-semibold text-[#d4582a]">
                {idx + 1}
              </span>

              {/* editable fields */}
              <div className="flex-1 min-w-0 space-y-1">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  placeholder="Slide title"
                  className="w-full bg-transparent text-[13px] font-medium text-[#1a1a2e] placeholder:text-[#b0ada6] outline-none"
                />
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Brief description or talking points"
                  className="w-full bg-transparent text-[12px] text-[#6b6b80] placeholder:text-[#b0ada6] outline-none"
                />
              </div>

              {/* delete */}
              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                className="mt-1 opacity-0 group-hover:opacity-100 text-[#b0ada6] hover:text-red-500 transition-all duration-[120ms]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {/* add slide */}
        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#dddfe3] py-2.5 text-[12px] text-[#95928E] hover:border-[#d4582a] hover:text-[#d4582a] transition-colors duration-[120ms]"
        >
          <Plus size={14} />
          Add slide
        </button>
      </div>

      {/* sticky footer CTA */}
      <div className="shrink-0 border-t border-[#e8e7e4] bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setPhase("theming")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#d4582a] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#d4582a]/90 transition-colors duration-[120ms]"
        >
          <Sparkles size={14} />
          Looks good, pick a theme
        </button>
      </div>
    </div>
  );
}
