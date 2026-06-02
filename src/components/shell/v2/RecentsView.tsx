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

const SHORT_LABEL: Record<EntityType, string> = { ku: "Doc", table: "Sheet", deck: "Deck", page: "Page" };
const CANDY = ["#FFB43F", "#4285F4", "#8757D7", "#67CEC8", "#F073A7", "#42C366"];
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function wsDot(projectId: string): string {
  return CANDY[hashOf(projectId) % CANDY.length];
}

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

type Bucket = { key: string; label: string; list: RecentEntry[] };
function bucketize(items: RecentEntry[]): Bucket[] {
  const day = 86400000;
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const buckets: Bucket[] = [
    { key: "today", label: "Today", list: [] },
    { key: "yesterday", label: "Yesterday", list: [] },
    { key: "week", label: "This week", list: [] },
    { key: "earlier", label: "Earlier", list: [] },
  ];
  for (const it of items) {
    if (it.openedAt >= startOfToday) buckets[0].list.push(it);
    else if (it.openedAt >= startOfToday - day) buckets[1].list.push(it);
    else if (it.openedAt >= now - 7 * day) buckets[2].list.push(it);
    else buckets[3].list.push(it);
  }
  return buckets.filter((b) => b.list.length > 0);
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

  const buckets = useMemo(() => bucketize(filtered), [filtered]);

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
      <div className="max-w-[760px] mx-auto px-8 py-9">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1">
          <Clock size={20} style={{ color: "var(--icon)" }} />
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Recents</h1>
        </div>
        <p className="text-[13px] mb-6" style={{ color: "var(--ink-3)" }}>Everything you’ve touched, across all workspaces.</p>

        {/* Controls */}
        {recents.length > 0 && (
          <div className="flex items-center gap-3 mb-7">
            <div className="inline-flex items-center rounded-full p-1" style={{ background: "var(--accent-soft)" }}>
              {TYPE_FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className="h-[26px] px-3 rounded-full text-[12px] font-medium press t-fast"
                    style={{ background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--ink-3)", boxShadow: on ? "0 1px 4px rgba(24,24,22,0.10)" : undefined }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 h-[34px] px-3 rounded-[9px] w-[200px]"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <Search size={14} style={{ color: "var(--ink-4)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter recents"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px]" style={{ color: "var(--ink)" }} />
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
          buckets.map((b) => (
            <section key={b.key} className="mb-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5 px-1" style={{ color: "var(--ink-4)" }}>{b.label}</div>
              <div className="rounded-[14px] overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {b.list.map((r, i) => {
                  const meta = ENTITY_META[r.type];
                  const Icon = meta.Icon;
                  const row = index++;
                  return (
                    <div key={r.entityId} role="button" tabIndex={0}
                      onClick={() => open(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r); } }}
                      className="group flex items-center gap-3.5 px-3.5 h-[58px] cursor-pointer animate-fade-in-up hover-row"
                      style={{ borderTop: i === 0 ? undefined : "1px solid var(--border)", animationDelay: `${Math.min(row, 12) * 22}ms` }}>
                      <span className="flex items-center justify-center w-[34px] h-[34px] rounded-[9px] flex-shrink-0"
                        style={{ background: "var(--accent-soft)", color: "var(--icon)" }}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.title || "Untitled"}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                          <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: wsDot(r.projectId) }} />
                          <span className="truncate">{r.projectTitle}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: meta.bg, color: meta.color }}>{SHORT_LABEL[r.type]}</span>
                      <span className="text-[12px] tabular-nums w-[64px] text-right flex-shrink-0" style={{ color: "var(--ink-4)" }}>{relTime(r.openedAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRecent(r.entityId); }}
                        title="Remove from recents"
                        className="flex items-center justify-center w-7 h-7 rounded-[7px] opacity-0 group-hover:opacity-100 transition-opacity press flex-shrink-0"
                        style={{ color: "var(--ink-4)" }}>
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
