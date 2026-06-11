"use client";

/**
 * WorkspacesView — the global workspace directory (replaces the old Library).
 *
 * Every workspace as a calm card: a deterministic identity icon on a soft
 * single-accent wash, what it is about, how many files, and its share status.
 * Ownership comes from the list endpoint (`isOwner` / `ownerName` / `orgId`);
 * filters split it into Created by me / Shared with me.
 *
 * Lives inside the shell's main area (no own theme toggle — that's in the
 * sidebar; no board topbar for system views). Card identity (glyph + accent)
 * comes from `@/lib/workspaceIcon`, the same source the sidebar will use, so a
 * workspace reads the same everywhere.
 *
 * Not yet wired: per-workspace settable icons (brand-logo picker) and live
 * member presence ("N active") — both need new backing data.
 */

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Users, Lock, LayoutGrid, Rows3, Star, ArrowUpDown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Project } from "@/lib/types";
import { relTime } from "@/lib/format";
import { workspaceGlyph, workspaceAccent } from "@/lib/workspaceIcon";

const PIN_KEY = "primy:ws:pins";
function loadPins(): Record<string, boolean> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PIN_KEY) || "[]") as string[];
    return Object.fromEntries(raw.map((id) => [id, true]));
  } catch { return {}; }
}
function savePins(p: Record<string, boolean>) {
  try { window.localStorage.setItem(PIN_KEY, JSON.stringify(Object.keys(p).filter((k) => p[k]))); } catch { /* ignore */ }
}

function fileCount(p: Project): number {
  const c = p.counts ?? { knowledgeUnits: p.knowledgeUnits.length, tables: p.tables.length, decks: p.decks.length, pages: p.pages.length };
  return c.knowledgeUnits + c.tables + c.decks + c.pages;
}
function initialsOf(name?: string): string {
  return (name || "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

/* Neutral card-coloured tile; colour comes only from the accent glyph. */
function WsIcon({ id, projectType, size = 52 }: { id: string; projectType?: string; size?: number }) {
  const Glyph = workspaceGlyph(id);
  const accent = workspaceAccent(id, projectType);
  return (
    <span className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(24,24,22,0.08)", color: accent }}>
      <Glyph size={size * 0.44} strokeWidth={1.85} />
    </span>
  );
}

/* Honest share status — we don't have live presence yet, so we show whether a
   workspace is shared with you (by whom), shared by you, or private. */
function ShareStatus({ p }: { p: Project }) {
  if (p.isOwner === false) {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className="flex items-center justify-center rounded-full text-[10px] font-semibold text-white flex-shrink-0"
          style={{ width: 24, height: 24, background: workspaceAccent(p.ownerName || p.id) }}>{initialsOf(p.ownerName)}</span>
        <span className="text-[12px] truncate" style={{ color: "var(--ink-3)" }}>{p.ownerName ? `Shared by ${p.ownerName.split(/\s+/)[0]}` : "Shared with you"}</span>
      </span>
    );
  }
  if (p.orgId || p.shareToken) {
    return <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}><Users size={13} /> Shared</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-4)" }}><Lock size={12} /> Private</span>;
}

function PinButton({ pinned, onClick }: { pinned: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title={pinned ? "Unpin" : "Pin"}
      className={`flex items-center justify-center w-8 h-8 rounded-[8px] press hover-row transition-opacity ${pinned ? "" : "opacity-0 group-hover:opacity-100"}`}
      style={{ color: pinned ? "var(--accent-amber)" : "var(--ink-4)" }}>
      <Star size={15} fill={pinned ? "var(--accent-amber)" : "none"} />
    </button>
  );
}

/* ───────────────────────── card + row ───────────────────────── */

function WsCard({ p, index, pinned, onOpen, onTogglePin }: { p: Project; index: number; pinned: boolean; onOpen: () => void; onTogglePin: () => void }) {
  const accent = workspaceAccent(p.id, p.projectType);
  const files = fileCount(p);
  return (
    <button onClick={onOpen}
      className="group relative flex flex-col text-left rounded-[16px] overflow-hidden cursor-pointer lift animate-fade-in-up"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${Math.min(index, 16) * 26}ms` }}>
      <div className="relative flex items-center px-5" style={{ height: 92, background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 13%, var(--card)) 0%, var(--card) 76%)` }}>
        <WsIcon id={p.id} projectType={p.projectType} size={52} />
        <div className="absolute top-2.5 right-2.5">
          <PinButton pinned={pinned} onClick={(e) => { e.stopPropagation(); onTogglePin(); }} />
        </div>
      </div>
      <div className="flex flex-col flex-1 px-5 pt-3.5 pb-4">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--ink)" }}>{p.title || "Untitled workspace"}</h3>
        <p className="text-[12.5px] mt-1 line-clamp-2 min-h-[35px]" style={{ color: "var(--ink-4)" }}>{p.description || "No description yet."}</p>
        <div className="flex items-center justify-between gap-3 mt-3.5 pt-3.5 min-w-0" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: "var(--ink-3)" }}>
            {files} {files === 1 ? "file" : "files"} · {relTime(p.updatedAt)}
          </span>
          <span className="min-w-0"><ShareStatus p={p} /></span>
        </div>
      </div>
    </button>
  );
}

const ROW_GRID = "44px minmax(0,1fr) 84px 180px 84px 32px";

function WsRow({ p, index, first, pinned, onOpen, onTogglePin }: { p: Project; index: number; first: boolean; pinned: boolean; onOpen: () => void; onTogglePin: () => void }) {
  const files = fileCount(p);
  return (
    <div onClick={onOpen}
      className="group grid items-center px-5 cursor-pointer animate-fade-in-up transition-colors hover:bg-[var(--sidebar-accent)]"
      style={{ gridTemplateColumns: ROW_GRID, columnGap: 18, minHeight: 74, borderTop: first ? undefined : "1px solid var(--border)", animationDelay: `${Math.min(index, 16) * 24}ms` }}>
      <WsIcon id={p.id} projectType={p.projectType} size={40} />
      <div className="min-w-0 pr-4">
        <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--ink)" }}>{p.title || "Untitled workspace"}</h3>
        <p className="text-[12.5px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>{p.description || "No description yet."}</p>
      </div>
      <span className="text-[13px] tabular-nums" style={{ color: "var(--ink-2)" }}>{files} <span className="text-[11.5px]" style={{ color: "var(--ink-4)" }}>files</span></span>
      <span className="min-w-0"><ShareStatus p={p} /></span>
      <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-4)" }}>{relTime(p.updatedAt)}</span>
      <PinButton pinned={pinned} onClick={(e) => { e.stopPropagation(); onTogglePin(); }} />
    </div>
  );
}

/* ───────────────────────── view ───────────────────────── */

type Filter = "all" | "owned" | "shared";
type Layout = "grid" | "list";

export function WorkspacesView({ onExit, onNewWorkspace }: { onExit: () => void; onNewWorkspace: () => void }) {
  const projects = useAppStore((s) => s.projects);
  const quickNotesProjectId = useAppStore((s) => s.quickNotesProjectId);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<Layout>("grid");
  const [pins, setPins] = useState<Record<string, boolean>>({});

  useEffect(() => { setPins(loadPins()); }, []);
  const togglePin = (id: string) => setPins((prev) => { const next = { ...prev, [id]: !prev[id] }; savePins(next); return next; });

  const { owned, shared } = useMemo(() => {
    const visible = projects.filter((p) => p.id !== quickNotesProjectId);
    return { owned: visible.filter((p) => p.isOwner !== false), shared: visible.filter((p) => p.isOwner === false) };
  }, [projects, quickNotesProjectId]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = filter === "owned" ? owned : filter === "shared" ? shared : [...owned, ...shared];
    return base
      .filter((p) => !needle || (p.title || "").toLowerCase().includes(needle) || (p.description || "").toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filter, owned, shared, q]);

  const pinned = list.filter((p) => pins[p.id]);
  const rest = list.filter((p) => !pins[p.id]);

  async function openProject(id: string) {
    const s = useAppStore.getState();
    if (s.currentProjectId !== id) s.switchProject(id);
    if (!useAppStore.getState().projectsFullyLoaded[id]) await useAppStore.getState().loadFullProject(id);
    onExit();
  }

  const TABS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: owned.length + shared.length },
    { key: "owned", label: "Created by me", n: owned.length },
    { key: "shared", label: "Shared with me", n: shared.length },
  ];

  function Group({ items, offset }: { items: Project[]; offset: number }) {
    if (layout === "list") {
      return (
        <div className="rounded-[16px] overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          {items.map((p, i) => <WsRow key={p.id} p={p} index={offset + i} first={i === 0} pinned={!!pins[p.id]} onOpen={() => openProject(p.id)} onTogglePin={() => togglePin(p.id)} />)}
        </div>
      );
    }
    return (
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {items.map((p, i) => <WsCard key={p.id} p={p} index={offset + i} pinned={!!pins[p.id]} onOpen={() => openProject(p.id)} onTogglePin={() => togglePin(p.id)} />)}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto v2-scroll" style={{ background: "var(--canvas)" }}>
      <div className="max-w-[1100px] mx-auto px-10 pt-12 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Workspaces</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-3)" }}>Every workspace you own or share, with what is inside and who is in it.</p>
          </div>
          <button onClick={onNewWorkspace}
            className="inline-flex items-center gap-2 h-10 pl-3.5 pr-5 rounded-[10px] text-[13.5px] font-medium press lift flex-shrink-0"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Plus size={17} /> New workspace
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 mt-9 mb-7">
          <div className="flex items-center gap-1">
            {TABS.map((t) => {
              const on = filter === t.key;
              return (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`h-9 pl-4 pr-3 rounded-full text-[13px] font-medium press inline-flex items-center gap-1.5 ${!on ? "hover-row" : ""}`}
                  style={on ? { background: "var(--sidebar-accent)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>
                  {t.label}<span className="text-[11.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{t.n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 h-9 px-3.5 rounded-full" style={{ background: "var(--sidebar-accent)" }}>
              <Search size={14} style={{ color: "var(--ink-4)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a workspace"
                className="w-[140px] bg-transparent outline-none text-[12.5px] placeholder:text-[var(--ink-4)]" style={{ color: "var(--ink)" }} />
            </div>
            <div className="hidden sm:inline-flex items-center rounded-full p-1" style={{ background: "var(--sidebar-accent)" }}>
              {([["grid", LayoutGrid], ["list", Rows3]] as const).map(([m, Ic]) => {
                const on = layout === m;
                return (
                  <button key={m} onClick={() => setLayout(m)} className="flex items-center justify-center w-8 h-8 rounded-full press"
                    style={{ background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--icon)", boxShadow: on ? "0 1px 6px rgba(24,24,22,0.10)" : undefined }}>
                    <Ic size={15} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body */}
        {list.length === 0 ? (
          <EmptyState
            size="lg"
            icon={filter === "shared" ? Users : LayoutGrid}
            title={filter === "shared" ? "Nothing shared with you yet" : q.trim() ? "No workspaces match" : "No workspaces yet"}
            description={
              filter === "shared" ? "When a teammate or your org shares a workspace, it shows up here."
                : q.trim() ? `Nothing matches “${q.trim()}”.`
                : "Workspaces you create will live here. Start one to get going."
            }
          >
            {filter !== "shared" && !q.trim() && (
              <button onClick={onNewWorkspace} className="inline-flex items-center gap-2 h-9 px-4 rounded-[9px] text-[13px] font-medium press lift"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                <Plus size={16} /> New workspace
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-10">
            {pinned.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3.5">
                  <Star size={13} fill="var(--accent-amber)" style={{ color: "var(--accent-amber)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>Pinned</span>
                </div>
                <Group items={pinned} offset={0} />
              </div>
            )}
            {rest.length > 0 && (
              <div>
                {pinned.length > 0 && <div className="mb-3.5"><span className="text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>All workspaces</span></div>}
                <Group items={rest} offset={pinned.length} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
