"use client";

/**
 * LibraryView — the global "your work, by ownership" surface (replaces Recents).
 *
 * In a multi-tenant world the sidebar blends workspaces you own, ones shared with
 * you, and your org's. The Library disambiguates them: a calm gallery split into
 * "Created by me" and "Shared with me", each workspace card summarizing what's
 * inside so you can tell at a glance what it holds and whose it is.
 *
 * Ownership comes from the list endpoint (`isOwner` / `ownerName` / `orgId`).
 * File-level "created by me" (inside a shared workspace) is a fast-follow that
 * needs a per-entity `createdBy` column.
 */

import { useMemo, useState } from "react";
import { Library, Search, ChevronRight, Users } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ENTITY_META } from "@/lib/entityMeta";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EntityType, Project } from "@/lib/types";
import { hashOf, relTime } from "@/lib/format";

// Workspace identity — a stable accent per workspace (this is the design-system's
// legitimate use of colour: workspace identity, not entity type).
const ACCENTS = ["#4285F4", "#8757D7", "#67CEC8", "#F073A7", "#42C366", "#F2A24C"];
const accentFor = (id: string) => ACCENTS[hashOf(id) % ACCENTS.length];

/* A tiny stylized artifact tile — the same visual language as the in-project
   entity previews, shrunk down so a workspace can "peek" at its contents. */
const TILE = "w-[62px] h-[80px] rounded-[8px] flex-shrink-0 overflow-hidden";
const TILE_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-strong)",
  boxShadow: "0 6px 16px rgba(24,24,22,0.13)",
};

function MiniArtifact({ type }: { type: EntityType }) {
  const color = ENTITY_META[type].color;
  if (type === "ku") {
    return (
      <div className={`${TILE} p-2.5 flex flex-col gap-[5px]`} style={TILE_STYLE}>
        {[100, 74, 88, 58, 80].map((w, i) => (
          <div key={i} className="h-[3px] rounded-full" style={{ width: `${w}%`, background: `color-mix(in srgb, ${color} ${i === 0 ? 55 : 26}%, transparent)` }} />
        ))}
      </div>
    );
  }
  if (type === "table") {
    return (
      <div className={TILE} style={TILE_STYLE}>
        <div className="grid h-full w-full" style={{ gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(4,1fr)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              borderRight: i % 3 !== 2 ? "1px solid var(--border)" : undefined,
              borderBottom: i < 9 ? "1px solid var(--border)" : undefined,
              background: i < 3 ? `color-mix(in srgb, ${color} 16%, transparent)` : undefined,
            }} />
          ))}
        </div>
      </div>
    );
  }
  if (type === "deck") {
    return (
      <div className={`${TILE} p-2 flex flex-col justify-end`} style={{ ...TILE_STYLE, background: "linear-gradient(150deg, #FFF4DE, #F4A24C 58%, #8AC7EA)" }}>
        <div className="h-[3px] w-[72%] rounded-full mb-[5px]" style={{ background: "rgba(255,255,255,0.78)" }} />
        <div className="h-[3px] w-[46%] rounded-full" style={{ background: "rgba(255,255,255,0.55)" }} />
      </div>
    );
  }
  // page — a little browser window
  return (
    <div className={`${TILE} flex flex-col`} style={TILE_STYLE}>
      <div className="h-[14px] flex items-center gap-[3px] px-1.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
        {["#F0876A", "#F7C853", "#67CEC8"].map((c) => <span key={c} className="w-[3px] h-[3px] rounded-full" style={{ background: c }} />)}
      </div>
      <div className="p-2 flex flex-col gap-1.5 flex-1">
        <div className="h-[4px] w-[58%] rounded-full" style={{ background: `color-mix(in srgb, ${color} 34%, transparent)` }} />
        <div className="h-[13px] rounded-[3px]" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }} />
        <div className="flex gap-1 mt-auto">
          <div className="h-[7px] flex-1 rounded-[2px]" style={{ background: "var(--secondary)" }} />
          <div className="h-[7px] flex-1 rounded-[2px]" style={{ background: "var(--secondary)" }} />
        </div>
      </div>
    </div>
  );
}

/* Fan the workspace's top content types as overlapping artifact tiles — the
   most-numerous type sits front-and-center. Empty workspaces get a quiet card. */
function WorkspaceMontage({ types }: { types: { type: EntityType; n: number }[] }) {
  if (types.length === 0) {
    return <div className="w-[62px] h-[80px] rounded-[8px] border border-dashed" style={{ borderColor: "var(--border-strong)" }} aria-hidden />;
  }
  const top = types.slice(0, 3);
  const POS = [
    { rot: 0, x: 0, y: 0, z: 3 },     // front / most-numerous
    { rot: -10, x: -36, y: 5, z: 1 }, // left, behind
    { rot: 10, x: 36, y: 5, z: 2 },   // right, behind
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center" aria-hidden>
      {top.map((t, i) => (
        <div key={t.type} className="absolute t-normal group-hover:-translate-y-[3px]"
          style={{ transform: `translate(${POS[i].x}px, ${POS[i].y}px) rotate(${POS[i].rot}deg)`, zIndex: POS[i].z }}>
          <MiniArtifact type={t.type} />
        </div>
      ))}
    </div>
  );
}

function countsOf(p: Project): { type: EntityType; n: number }[] {
  const c = p.counts ?? {
    knowledgeUnits: p.knowledgeUnits.length,
    tables: p.tables.length,
    decks: p.decks.length,
    pages: p.pages.length,
  };
  return [
    { type: "ku" as const, n: c.knowledgeUnits },
    { type: "table" as const, n: c.tables },
    { type: "deck" as const, n: c.decks },
    { type: "page" as const, n: c.pages },
  ].filter((x) => x.n > 0);
}

export function LibraryView({ onExit }: { onExit: () => void }) {
  const projects = useAppStore((s) => s.projects);
  const quickNotesProjectId = useAppStore((s) => s.quickNotesProjectId);
  const [tab, setTab] = useState<"owned" | "shared">("owned");
  const [q, setQ] = useState("");

  const { owned, shared } = useMemo(() => {
    const visible = projects.filter((p) => p.id !== quickNotesProjectId);
    return {
      // `isOwner` is undefined for legacy/local rows — treat unknown as owned.
      owned: visible.filter((p) => p.isOwner !== false),
      shared: visible.filter((p) => p.isOwner === false),
    };
  }, [projects, quickNotesProjectId]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (tab === "owned" ? owned : shared)
      .filter((p) => !needle || p.title.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [tab, owned, shared, q]);

  async function openProject(id: string) {
    const s = useAppStore.getState();
    if (s.currentProjectId !== id) s.switchProject(id);
    if (!useAppStore.getState().projectsFullyLoaded[id]) {
      await useAppStore.getState().loadFullProject(id);
    }
    onExit();
  }

  const TABS = [
    { key: "owned" as const, label: "Created by me", n: owned.length },
    { key: "shared" as const, label: "Shared with me", n: shared.length },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto v2-scroll" style={{ background: "var(--canvas)" }}>
      <div className="max-w-[1040px] mx-auto px-10 py-12">
        {/* Header */}
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Library</h1>
        <p className="text-[13.5px] mt-1" style={{ color: "var(--ink-3)" }}>Everything you own, and everything shared with you.</p>

        {/* Ownership tabs + search */}
        <div className="flex items-center justify-between gap-4 mt-8 mb-6">
          <div className="flex items-center gap-1">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`h-9 pl-4 pr-3 rounded-full text-[13px] font-medium press transition-colors inline-flex items-center gap-1.5 ${!on ? "hover-row" : ""}`}
                  style={on ? { background: "var(--sidebar-accent)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>
                  {t.label}
                  <span className="text-[11.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{t.n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-full" style={{ background: "var(--sidebar-accent)" }}>
            <Search size={14} style={{ color: "var(--ink-4)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a workspace"
              className="w-[150px] bg-transparent outline-none text-[12.5px] placeholder:text-[var(--ink-4)]" style={{ color: "var(--ink)" }} />
          </div>
        </div>

        {/* Workspace gallery */}
        {list.length === 0 ? (
          <EmptyState
            size="lg"
            icon={tab === "shared" ? Users : Library}
            title={tab === "shared" ? "Nothing shared with you yet" : q.trim() ? "No workspaces match" : "No workspaces yet"}
            description={
              tab === "shared"
                ? "When a teammate or your org shares a workspace, it shows up here."
                : q.trim()
                ? `Nothing matches “${q.trim()}”.`
                : "Workspaces you create will live here. Start one from the sidebar."
            }
          />
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(296px, 1fr))" }}>
            {list.map((p, i) => {
              const accent = accentFor(p.id);
              const types = countsOf(p).sort((a, b) => b.n - a.n);
              const total = types.reduce((s, t) => s + t.n, 0);
              return (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className="group relative flex flex-col text-left rounded-[16px] overflow-hidden h-[212px] cursor-pointer animate-fade-in-up lift"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", animationDelay: `${Math.min(i, 16) * 24}ms` }}
                >
                  {/* Preview stage — a peek at what's inside the workspace */}
                  <div className="relative flex-1 overflow-hidden flex items-center justify-center"
                    style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 11%, var(--card)) 0%, var(--card) 76%)` }}>
                    <WorkspaceMontage types={types} />
                    {tab === "shared" && p.ownerName && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[11px] font-medium px-2 h-[21px] rounded-full"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--ink-3)" }}>
                        <Users size={10} /> {p.ownerName}
                      </span>
                    )}
                  </div>

                  {/* Footer — title + contents */}
                  <div className="flex items-center gap-3 px-4 h-[58px] flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold tracking-[-0.01em] truncate" style={{ color: "var(--ink)" }}>{p.title || "Untitled project"}</h3>
                      <p className="text-[11.5px] truncate" style={{ color: "var(--ink-4)" }}>
                        {total === 0 ? "Empty" : `${total} file${total === 1 ? "" : "s"}`} · {relTime(p.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight size={15} className="flex-shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" style={{ color: "var(--ink-4)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
