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
    body = <span className="text-xs" style={{ color: "var(--ink-3)" }}>Unavailable</span>;
  } else if (type === "ku") {
    body = (
      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--ink-2)" }}>
        {excerpt(rec.content) || "Empty document"}
      </p>
    );
  } else if (type === "table") {
    const sheet = rec.sheets?.[0];
    const cells: { r: number; c: number; v: { v?: string | number | null } | null }[] = sheet?.celldata || [];
    const grid: string[][] = [];
    for (const cell of cells) {
      if (cell.r < 3 && cell.c < 4) {
        grid[cell.r] = grid[cell.r] || [];
        grid[cell.r][cell.c] = String(cell.v?.v ?? "");
      }
    }
    body = (
      <div
        className="grid gap-px rounded overflow-hidden"
        style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", backgroundColor: "var(--border)" }}
      >
        {Array.from({ length: 3 }).flatMap((_, r) =>
          Array.from({ length: 4 }).map((__, c) => (
            <div
              key={`${r}-${c}`}
              className="px-1.5 py-1 text-[10px] truncate"
              style={{ backgroundColor: "var(--card)", color: "var(--ink-2)" }}
            >
              {grid[r]?.[c] ?? ""}
            </div>
          ))
        )}
      </div>
    );
  } else if (type === "deck") {
    const count = rec.slides?.length ?? 0;
    const first = rec.slides?.[0];
    // DeckSlide uses `title`; HtmlDeckSlide has no title field — fall back gracefully
    const titleText = first?.title || "Untitled slide";
    body = (
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        <div className="font-medium mb-0.5 line-clamp-1" style={{ color: "var(--ink)" }}>
          {titleText}
        </div>
        <div style={{ color: "var(--ink-3)" }}>
          {count} slide{count === 1 ? "" : "s"}
        </div>
      </div>
    );
  } else {
    body = (
      <p className="text-xs line-clamp-2" style={{ color: "var(--ink-2)" }}>
        {rec.title}
      </p>
    );
  }

  return (
    <div
      className="w-60 rounded-xl border p-3"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-pane)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
        <span
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <div className="text-sm font-medium mb-1.5 line-clamp-1" style={{ color: "var(--ink)" }}>
        {rec?.title || "Untitled"}
      </div>
      {body}
    </div>
  );
}
