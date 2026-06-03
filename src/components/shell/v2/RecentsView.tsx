"use client";

/**
 * RecentsView — the global, cross-workspace "jump back in" surface (replaces the
 * old dead Inbox slot). Reads the client-tracked `recents` list from the store
 * (snapshotted at open-time so it works even for not-yet-loaded workspaces),
 * groups it by recency, and opens an entity straight into its workspace.
 */

import { useMemo, useState } from "react";
import { Clock, X, Search, SearchX } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ENTITY_META } from "@/lib/entityMeta";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EntityType, RecentEntry } from "@/lib/types";

function relTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

const TYPE_FILTERS: { key: "all" | EntityType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ku", label: "Docs" },
  { key: "table", label: "Sheets" },
  { key: "deck", label: "Decks" },
  { key: "page", label: "Pages" },
];

export function RecentsView({ onExit }: { onExit: () => void }) {
  const recents = useAppStore((s) => s.recents);
  const removeRecent = useAppStore((s) => s.removeRecent);
  const [filter, setFilter] = useState<"all" | EntityType>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recents.filter(
      (r) =>
        (filter === "all" || r.type === filter) &&
        (!needle || r.title.toLowerCase().includes(needle) || r.projectTitle.toLowerCase().includes(needle)),
    );
  }, [recents, filter, q]);

  async function open(r: RecentEntry) {
    const s = useAppStore.getState();
    if (s.currentProjectId !== r.projectId) s.switchProject(r.projectId);
    // The owning workspace may not have its full content in memory yet.
    if (!useAppStore.getState().projectsFullyLoaded[r.projectId]) {
      await useAppStore.getState().loadFullProject(r.projectId);
    }
    const fn = ({ ku: "openKnowledgeUnit", table: "openTable", deck: "openDeck", page: "openPage" } as const)[r.type];
    const before = useAppStore.getState().currentEntityId;
    useAppStore.getState()[fn](r.entityId);
    // If nothing opened, the entity was deleted elsewhere — prune the stale row.
    if (useAppStore.getState().currentEntityId === before) {
      useAppStore.getState().removeRecent(r.entityId);
      return;
    }
    onExit();
  }

  let index = 0;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto v2-scroll" style={{ background: "var(--canvas)" }}>
      <div className="max-w-[1160px] mx-auto px-10 py-12">
        {/* Header */}
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Recents</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--ink-3)" }}>Jump back into anything you’ve touched.</p>

        {/* Filter chips + inline search */}
        {recents.length > 0 && (
          <div className="flex items-center justify-between gap-4 mt-8 mb-5">
            <div className="flex items-center gap-1">
              {TYPE_FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className="h-8 px-3 rounded-[9px] text-[13px] font-medium press transition-colors"
                    style={on ? { background: "var(--secondary)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 h-8 px-3 rounded-[9px]" style={{ background: "var(--secondary)" }}>
              <Search size={14} style={{ color: "var(--ink-4)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter"
                className="w-[120px] bg-transparent outline-none text-[12.5px] placeholder:text-[var(--ink-4)]" style={{ color: "var(--ink)" }} />
            </div>
          </div>
        )}

        {/* List */}
        {recents.length === 0 ? (
          <EmptyState
            size="lg"
            icon={Clock}
            title="Nothing opened yet"
            description="Docs, sheets and decks you open will show up here so you can jump right back in, across every workspace."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            size="md"
            icon={SearchX}
            title="No matches"
            description={`Nothing in your recents matches “${q.trim()}”. Try a shorter query.`}
          />
        ) : (
          <div className="mt-7 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))" }}>
            {filtered.map((r) => {
              const meta = ENTITY_META[r.type];
              const Icon = meta.Icon;
              const row = index++;
              return (
                <div key={r.entityId} role="button" tabIndex={0}
                  onClick={() => open(r)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r); } }}
                  className="group relative flex flex-col text-left rounded-[14px] p-4 h-[150px] cursor-pointer animate-fade-in-up lift"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${Math.min(row, 16) * 22}ms` }}>
                  <div className="flex items-start justify-between mb-3.5">
                    <span className="flex items-center justify-center w-[38px] h-[38px] rounded-[10px] flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
                      <Icon size={19} strokeWidth={1.85} />
                    </span>
                    <span className="text-[11px] tabular-nums pt-1 group-hover:opacity-0 transition-opacity" style={{ color: "var(--ink-4)" }}>{relTime(r.openedAt)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRecent(r.entityId); }}
                      title="Remove from recents"
                      className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-[7px] opacity-0 group-hover:opacity-100 transition-opacity press icon-hover"
                      style={{ color: "var(--ink-4)" }}>
                      <X size={15} />
                    </button>
                  </div>
                  <div className="text-[14px] font-medium leading-snug line-clamp-2 flex-1" style={{ color: "var(--ink)" }}>{r.title || "Untitled"}</div>
                  <div className="text-[12px] truncate mt-1.5" style={{ color: "var(--ink-4)" }}>{r.projectTitle}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
