"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronRight, Plus, Trash2, Sparkles, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { DeckOutlineItem } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

export function DeckOutlineEditor() {
  const outline = useAppStore((s) => s.deckOutline);
  const setOutline = useAppStore((s) => s.setDeckOutline);
  const setPhase = useAppStore((s) => s.setDeckPhase);
  const updateDeckTheme = useAppStore((s) => s.updateDeckTheme);

  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    const newItem = { id: uid(), title: "", description: "", category: "", layout: undefined };
    setOutline([...outline, newItem]);
    setExpandedId(newItem.id);
  }, [outline, setOutline]);

  /* ── generate handler ── */
  const handleGenerate = useCallback(() => {
    setPhase("generating");
    // AI auto-selects theme based on content
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: {
          content: `Generate the full presentation. Auto-select the best theme based on the topic and audience. Use the approved outline.`,
        },
      })
    );
  }, [setPhase]);

  if (outline.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <h2 className="text-[14px] font-semibold text-[#1a1a2e]">
          Storyline
        </h2>
        <p className="text-[12px] text-[#95928E] mt-0.5">
          Drag to reorder, expand to edit details
        </p>
      </div>

      {/* scrollable card list */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
        {outline.map((item, idx) => {
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              className={cn(
                "group rounded-xl border transition-all duration-150",
                isDragging && "opacity-40 scale-[0.98]",
                isOver && "border-[#d4582a] ring-1 ring-[#d4582a]/20",
                !isOver && "border-[#e8e7e4] hover:border-[#dddfe3]",
              )}
            >
              {/* collapsed row */}
              <div
                className="flex items-center gap-2.5 px-3 py-3 cursor-pointer select-none"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* drag handle */}
                <div
                  className="shrink-0 cursor-grab text-[#b0ada6] hover:text-[#6b6b80] opacity-0 group-hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical size={14} />
                </div>

                {/* chevron */}
                <ChevronRight
                  size={14}
                  className={cn(
                    "shrink-0 text-[#b0ada6] transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />

                {/* title */}
                <span className={cn(
                  "flex-1 text-[13px] font-medium min-w-0 truncate",
                  item.title ? "text-[#1a1a2e]" : "text-[#b0ada6]"
                )}>
                  {item.title || "Untitled slide"}
                </span>

                {/* category tag */}
                {item.category && (
                  <span className="shrink-0 px-2.5 py-0.5 rounded-md bg-[#f5f5f3] text-[11px] font-medium text-[#6b6b80] border border-[#e8e7e4]">
                    {item.category}
                  </span>
                )}

                {/* delete — visible on hover */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-[#b0ada6] hover:text-red-500 transition-all duration-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3.5 pt-0 space-y-2.5 border-t border-[#f0f0ee]">
                  <div className="pt-2.5">
                    <label className="text-[11px] font-medium text-[#95928E] uppercase tracking-wider">Title</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(item.id, { title: e.target.value })}
                      placeholder="Slide title"
                      className="w-full mt-1 bg-transparent text-[13px] font-medium text-[#1a1a2e] placeholder:text-[#b0ada6] outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#95928E] uppercase tracking-wider">Description</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="What should this slide cover?"
                      rows={2}
                      className="w-full mt-1 bg-transparent text-[12px] text-[#6b6b80] placeholder:text-[#b0ada6] outline-none resize-none leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#95928E] uppercase tracking-wider">Category</label>
                    <input
                      type="text"
                      value={item.category || ""}
                      onChange={(e) => updateItem(item.id, { category: e.target.value })}
                      placeholder="e.g. Opening, Problem, Solution"
                      className="w-full mt-1 bg-transparent text-[12px] text-[#6b6b80] placeholder:text-[#b0ada6] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* add slide */}
        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#dddfe3] py-2.5 text-[12px] text-[#95928E] hover:border-[#d4582a] hover:text-[#d4582a] transition-colors duration-150"
        >
          <Plus size={14} />
          Add slide
        </button>
      </div>

      {/* sticky footer CTA */}
      <div className="shrink-0 border-t border-[#e8e7e4] bg-white px-4 py-3">
        <button
          type="button"
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#2a2a3e] transition-colors duration-150 active:scale-[0.98]"
        >
          <Sparkles size={14} />
          Generate slides
        </button>
      </div>
    </div>
  );
}
