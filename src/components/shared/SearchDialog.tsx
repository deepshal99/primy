"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Table2, GitBranch, Presentation, X, MessageSquare } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { cosineSimilarity } from "@/lib/ai/embeddings";

interface SearchResult {
  id: string;
  title: string;
  type: "ku" | "table" | "diagram" | "deck" | "message";
  projectId: string;
  projectTitle: string;
  snippet?: string;
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const projects = useAppStore((s) => s.projects);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDiagram = useAppStore((s) => s.openDiagram);
  const openDeck = useAppStore((s) => s.openDeck);
  const switchProject = useAppStore((s) => s.switchProject);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced semantic embedding for query
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setQueryEmbedding(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: [query] }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.embeddings?.[0]) {
            setQueryEmbedding(data.embeddings[0]);
          }
        }
      } catch {
        // Silently fail — fall back to string search
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search across all projects
  const search = useCallback(
    (q: string, queryEmb: number[] | null) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const lower = q.toLowerCase();
      const found: SearchResult[] = [];
      const foundIds = new Set<string>();

      for (const project of projects) {
        // Search KUs
        for (const ku of project.knowledgeUnits) {
          if (ku.title.toLowerCase().includes(lower) || ku.content.toLowerCase().includes(lower)) {
            const snippetIdx = ku.content.toLowerCase().indexOf(lower);
            found.push({
              id: ku.id,
              title: ku.title,
              type: "ku",
              projectId: project.id,
              projectTitle: project.title,
              snippet: snippetIdx >= 0
                ? "..." + ku.content.slice(Math.max(0, snippetIdx - 30), snippetIdx + 60).replace(/<[^>]*>/g, "") + "..."
                : undefined,
            });
            foundIds.add(ku.id);
          }
        }

        // Search tables
        for (const table of project.tables) {
          if (table.title.toLowerCase().includes(lower)) {
            found.push({
              id: table.id,
              title: table.title,
              type: "table",
              projectId: project.id,
              projectTitle: project.title,
            });
            foundIds.add(table.id);
          }
        }

        // Search diagrams
        for (const diagram of (project.diagrams || [])) {
          if (diagram.title.toLowerCase().includes(lower) || diagram.source.toLowerCase().includes(lower)) {
            found.push({
              id: diagram.id,
              title: diagram.title,
              type: "diagram",
              projectId: project.id,
              projectTitle: project.title,
            });
            foundIds.add(diagram.id);
          }
        }

        // Search decks
        for (const deck of (project.decks || [])) {
          if (deck.title.toLowerCase().includes(lower)) {
            found.push({
              id: deck.id,
              title: deck.title,
              type: "deck",
              projectId: project.id,
              projectTitle: project.title,
            });
            foundIds.add(deck.id);
          }
        }

        // Search messages
        for (const msg of project.messages) {
          if (msg.content.toLowerCase().includes(lower)) {
            const snippetIdx = msg.content.toLowerCase().indexOf(lower);
            found.push({
              id: `msg-${msg.id}`,
              title: msg.content.slice(0, 60).replace(/<[^>]*>/g, "") + (msg.content.length > 60 ? "..." : ""),
              type: "message",
              projectId: project.id,
              projectTitle: project.title,
              snippet: "..." + msg.content.slice(Math.max(0, snippetIdx - 20), snippetIdx + 50).replace(/<[^>]*>/g, "") + "...",
            });
            foundIds.add(`msg-${msg.id}`);
            if (found.filter((f) => f.type === "message").length >= 5) break;
          }
        }
      }

      // Semantic search: find entities by embedding similarity
      if (queryEmb) {
        for (const project of projects) {
          for (const ku of project.knowledgeUnits) {
            if (ku.embedding && !foundIds.has(ku.id)) {
              const score = cosineSimilarity(queryEmb, ku.embedding);
              if (score > 0.5) {
                found.push({
                  id: ku.id,
                  title: ku.title,
                  type: "ku",
                  projectId: project.id,
                  projectTitle: project.title,
                  snippet: "Semantic match",
                });
                foundIds.add(ku.id);
              }
            }
          }
          for (const table of project.tables) {
            if (table.embedding && !foundIds.has(table.id)) {
              const score = cosineSimilarity(queryEmb, table.embedding);
              if (score > 0.5) {
                found.push({
                  id: table.id,
                  title: table.title,
                  type: "table",
                  projectId: project.id,
                  projectTitle: project.title,
                  snippet: "Semantic match",
                });
                foundIds.add(table.id);
              }
            }
          }
          for (const diagram of (project.diagrams || [])) {
            if (diagram.embedding && !foundIds.has(diagram.id)) {
              const score = cosineSimilarity(queryEmb, diagram.embedding);
              if (score > 0.5) {
                found.push({
                  id: diagram.id,
                  title: diagram.title,
                  type: "diagram",
                  projectId: project.id,
                  projectTitle: project.title,
                  snippet: "Semantic match",
                });
                foundIds.add(diagram.id);
              }
            }
          }
          for (const deck of (project.decks || [])) {
            if (deck.embedding && !foundIds.has(deck.id)) {
              const score = cosineSimilarity(queryEmb, deck.embedding);
              if (score > 0.5) {
                found.push({
                  id: deck.id,
                  title: deck.title,
                  type: "deck",
                  projectId: project.id,
                  projectTitle: project.title,
                  snippet: "Semantic match",
                });
                foundIds.add(deck.id);
              }
            }
          }
        }
      }

      setResults(found.slice(0, 20));
      setSelectedIndex(0);
    },
    [projects]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query, queryEmbedding), 150);
    return () => clearTimeout(timer);
  }, [query, queryEmbedding, search]);

  const openResult = (result: SearchResult) => {
    const state = useAppStore.getState();
    if (state.currentProjectId !== result.projectId) {
      switchProject(result.projectId);
    }
    if (result.type === "ku") openKnowledgeUnit(result.id);
    else if (result.type === "table") openTable(result.id);
    else if (result.type === "diagram") openDiagram(result.id);
    else if (result.type === "deck") openDeck(result.id);
    else if (result.type === "message") {
      // For messages, just switch to the project
      switchProject(result.projectId);
    }
    if (!state.workspaceOpen && result.type !== "message") {
      useAppStore.setState({ workspaceOpen: true });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      openResult(results[selectedIndex]);
    }
  };

  const typeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "ku": return <FileText className="w-4 h-4" style={{ color: design.colors.entity.doc }} />;
      case "table": return <Table2 className="w-4 h-4" style={{ color: design.colors.entity.sheet }} />;
      case "diagram": return <GitBranch className="w-4 h-4" style={{ color: design.colors.entity.diagram }} />;
      case "deck": return <Presentation className="w-4 h-4" style={{ color: design.colors.entity.deck }} />;
      case "message": return <MessageSquare className="w-4 h-4" style={{ color: design.colors.text.muted }} />;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-xl border overflow-hidden animate-scale-in mx-4"
        style={{
          backgroundColor: design.colors.bg.elevated,
          borderColor: design.colors.border.default,
          boxShadow: design.shadows.xl,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${design.colors.border.light}` }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.text.muted }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, content, messages..."
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: design.colors.text.primary }}
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{
              borderColor: design.colors.border.default,
              color: design.colors.text.placeholder,
              backgroundColor: design.colors.bg.secondary,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.trim() && (
          <div className="max-h-[360px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
                  No results for &ldquo;{query}&rdquo;
                </p>
              </div>
            ) : (
              results.map((result, i) => (
                <button
                  key={result.id + result.type}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: i === selectedIndex ? design.colors.bg.hover : "transparent",
                  }}
                  onClick={() => openResult(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="flex-shrink-0">{typeIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate text-[13px] font-medium"
                      style={{ color: design.colors.text.primary }}
                    >
                      {result.title}
                    </div>
                    {result.snippet && (
                      <div
                        className="truncate text-[11px] mt-0.5"
                        style={{ color: design.colors.text.muted }}
                      >
                        {result.snippet}
                      </div>
                    )}
                  </div>
                  <span
                    className="flex-shrink-0 text-[10px]"
                    style={{ color: design.colors.text.placeholder }}
                  >
                    {result.projectTitle}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Empty state — no query yet */}
        {!query.trim() && (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
              Type to search across all projects
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
