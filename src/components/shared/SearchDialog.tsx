"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, FileText, Table2, Presentation, CornerDownLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";

interface SearchResult {
  id: string;
  title: string;
  type: "ku" | "table" | "deck";
  projectId: string;
  projectTitle: string;
}

const ENTITY_CONFIG: Record<SearchResult["type"], { label: string; section: string; color: string; Icon: typeof FileText }> = {
  ku:      { label: "Document",     section: "Documents",      color: "#4a7aed", Icon: FileText },
  table:   { label: "Spreadsheet",  section: "Spreadsheets",   color: "#2e9e47", Icon: Table2 },
  deck:    { label: "Presentation", section: "Presentations",  color: "#d4582a", Icon: Presentation },
};

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDeck = useAppStore((s) => s.openDeck);
  const switchProject = useAppStore((s) => s.switchProject);

  // Recent entities from current project
  const recentEntities = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const allEntities = [
      ...project.knowledgeUnits.map((ku) => ({ id: ku.id, title: ku.title, type: "ku" as const, projectId: project.id, projectTitle: project.title, _updatedAt: ku.updatedAt })),
      ...project.tables.map((t) => ({ id: t.id, title: t.title, type: "table" as const, projectId: project.id, projectTitle: project.title, _updatedAt: t.updatedAt })),
      ...(project.decks || []).map((d) => ({ id: d.id, title: d.title, type: "deck" as const, projectId: project.id, projectTitle: project.title, _updatedAt: d.updatedAt })),
    ];
    allEntities.sort((a, b) => (b._updatedAt || 0) - (a._updatedAt || 0));
    return allEntities.slice(0, 5).map(({ _updatedAt, ...rest }) => rest) as SearchResult[];
  }, [projects, currentProjectId]);

  // Focus + animate on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIdx(0);
      requestAnimationFrame(() => {
        setAnimateIn(true);
        inputRef.current?.focus();
      });
    } else {
      setAnimateIn(false);
    }
  }, [open]);

  // Search across all projects
  const searchResults = useMemo(() => {
    const lower = query.toLowerCase().trim();
    if (!lower) return [];
    const found: SearchResult[] = [];

    for (const project of projects) {
      for (const ku of project.knowledgeUnits) {
        if (ku.title.toLowerCase().includes(lower) || ku.content.toLowerCase().includes(lower)) {
          found.push({ id: ku.id, title: ku.title, type: "ku", projectId: project.id, projectTitle: project.title });
        }
      }
      for (const table of project.tables) {
        if (table.title.toLowerCase().includes(lower)) {
          found.push({ id: table.id, title: table.title, type: "table", projectId: project.id, projectTitle: project.title });
        }
      }
      for (const deck of (project.decks || [])) {
        if (deck.title.toLowerCase().includes(lower)) {
          found.push({ id: deck.id, title: deck.title, type: "deck", projectId: project.id, projectTitle: project.title });
        }
      }
    }
    return found.slice(0, 20);
  }, [query, projects]);

  // Build grouped sections
  const getSections = useCallback((): { section: string; items: SearchResult[] }[] => {
    if (!query.trim()) {
      if (recentEntities.length === 0) return [];
      return [{ section: "Recent", items: recentEntities }];
    }
    if (searchResults.length === 0) return [];

    const order: SearchResult["type"][] = ["ku", "table", "deck"];
    const sections: { section: string; items: SearchResult[] }[] = [];
    for (const type of order) {
      const items = searchResults.filter((r) => r.type === type);
      if (items.length > 0) {
        sections.push({ section: ENTITY_CONFIG[type].section, items });
      }
    }
    return sections;
  }, [query, searchResults, recentEntities]);

  const sections = getSections();
  const flatResults = sections.flatMap((s) => s.items);

  const openResult = (result: SearchResult) => {
    const state = useAppStore.getState();
    if (state.currentProjectId !== result.projectId) {
      switchProject(result.projectId);
    }
    if (result.type === "ku") openKnowledgeUnit(result.id);
    else if (result.type === "table") openTable(result.id);
    else if (result.type === "deck") openDeck(result.id);
    if (!state.workspaceOpen) {
      useAppStore.setState({ workspaceOpen: true });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults[highlightIdx]) openResult(flatResults[highlightIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-search-item]");
    if (items[highlightIdx]) {
      items[highlightIdx].scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[min(20vh,160px)]">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-150",
          animateIn ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Search panel */}
      <div
        className={cn(
          "relative w-[520px] max-w-[calc(100vw-32px)] bg-card rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)]",
          animateIn ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-[0.97] -translate-y-2"
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 h-[56px] px-5 border-b border-[#e8e8ed]">
          <Search className="w-5 h-5 text-[#b0ada6] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-[#f0f0f0] text-[10px] text-[#999]" style={{ fontWeight: 500 }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
          {sections.length === 0 && query.trim() && (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-[#95928E]">No results found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {sections.length === 0 && !query.trim() && (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-[#95928E]">No recent files</p>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.section}>
              <div className="px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#b0ada6]">
                  {section.section}
                </span>
              </div>
              {section.items.map((item) => {
                const idx = flatIndex++;
                const isHighlighted = idx === highlightIdx;
                const config = ENTITY_CONFIG[item.type];
                const Icon = config.Icon;

                return (
                  <button
                    key={item.id + item.type}
                    data-search-item
                    onClick={() => openResult(item)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors rounded-lg mx-2",
                      "max-w-[calc(100%-16px)]",
                      isHighlighted ? "bg-[#f7f7f8]" : ""
                    )}
                  >
                    <Icon
                      className="w-[18px] h-[18px] flex-shrink-0"
                      style={{ color: config.color }}
                      strokeWidth={1.75}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </div>
                    </div>
                    <span className="text-xs text-[#b0ada6] flex-shrink-0">
                      {config.label}
                    </span>
                    {isHighlighted && (
                      <kbd className="flex items-center px-1.5 py-0.5 rounded bg-[#efeee9] text-[10px] text-[#6b6965] flex-shrink-0" style={{ fontWeight: 500 }}>
                        <CornerDownLeft className="w-2.5 h-2.5" strokeWidth={2} />
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
