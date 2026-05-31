"use client";

/**
 * AppShellV2 — the Strut-inspired overhaul shell (locked design = /preview/strut).
 *
 * Reuses the real ChatPanel + WorkspacePanel (editors) and wires everything to
 * the real Zustand store. The deltas from the legacy shell:
 *   - expanded 232px sidebar with a Workspaces tree (project → entities)
 *   - topbar with a board / kanban / timeline view toggle
 *   - project "home" rendered as board / kanban / timeline (not the 4-grid)
 *   - docked, collapsible chat card; full light + dark
 *
 * Gated by useShellV2(); the legacy AppShell stays available via /app?shell=v1.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox, PenLine, Search, ChevronRight, Plus, FileText, Table2, Presentation,
  LayoutTemplate, MoreHorizontal, LayoutGrid, Columns3, CalendarDays,
  PanelRightClose, PanelRightOpen, Sun, Moon, ArrowLeft, Settings, CircleHelp, Check,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useDarkMode } from "@/lib/useShellV2";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SettingsModal } from "@/components/settings/SettingsModal";
import type { EntityType, Project } from "@/lib/types";

/* ───────────────────────── shared meta ───────────────────────── */

const FONT = "Inter, system-ui, sans-serif";
const ENTITY: Record<EntityType, { Icon: typeof FileText; label: string }> = {
  ku: { Icon: FileText, label: "Doc" },
  table: { Icon: Table2, label: "Sheet" },
  deck: { Icon: Presentation, label: "Deck" },
  page: { Icon: LayoutTemplate, label: "Page" },
};
const CANDY = ["#FFB43F", "#4285F4", "#8757D7", "#67CEC8", "#F073A7", "#42c366", "#ecb730"];
function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CANDY[h % CANDY.length];
}
function relTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type ViewMode = "board" | "kanban" | "timeline";
type Item = { id: string; type: EntityType; title: string; updatedAt: number };

const TYPE_ORDER: { type: EntityType; label: string; color: string }[] = [
  { type: "ku", label: "Docs", color: "#4285F4" },
  { type: "table", label: "Sheets", color: "#42c366" },
  { type: "deck", label: "Decks", color: "#FFB43F" },
  { type: "page", label: "Pages", color: "#8757D7" },
];

function projectItems(p: Project | undefined): Item[] {
  if (!p) return [];
  const map = (arr: { id: string; title: string; updatedAt: number }[], type: EntityType) =>
    arr.map((e) => ({ id: e.id, type, title: e.title, updatedAt: e.updatedAt }));
  return [
    ...map(p.knowledgeUnits, "ku"),
    ...map(p.tables, "table"),
    ...map(p.decks, "deck"),
    ...map(p.pages, "page"),
  ];
}

async function fetchUserForGate(): Promise<{ hasOnboarded: boolean }> {
  const res = await fetch("/api/user", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
  return res.json();
}

/* ───────────────────────── shell ───────────────────────── */

export function AppShellV2() {
  const router = useRouter();
  const pathname = usePathname();
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const switchProject = useAppStore((s) => s.switchProject);
  const goToProjectsHome = useAppStore((s) => s.goToProjectsHome);
  const createProject = useAppStore((s) => s.createProject);

  const [dark, toggleDark] = useDarkMode();
  const [view, setView] = useState<ViewMode>("board");
  const [chatOpen, setChatOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const project = projects.find((p) => p.id === currentProjectId);

  // ── Onboarding gate (mirrors legacy AppShell) ──
  const userQuery = useQuery({ queryKey: ["user"], queryFn: fetchUserForGate, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (userQuery.data && userQuery.data.hasOnboarded === false && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [userQuery.data, pathname, router]);
  useEffect(() => {
    if (userQuery.data?.hasOnboarded) loadProjects();
  }, [userQuery.data?.hasOnboarded, loadProjects]);

  // keep the active project expanded in the tree
  useEffect(() => {
    if (currentProjectId) setExpanded((e) => ({ ...e, [currentProjectId]: true }));
  }, [currentProjectId]);

  // search open event (from sidebar) + Cmd+K
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener("drafta:open-search", open);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); createProject("Untitled project"); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("drafta:open-search", open); window.removeEventListener("keydown", key); };
  }, [createProject]);

  const needsOnboarding = userQuery.data && userQuery.data.hasOnboarded === false;
  if (userQuery.isLoading || needsOnboarding) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: "var(--canvas)" }}>
        <span className="w-5 h-5 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "var(--accent-amber)", borderRightColor: "var(--accent-amber)" }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex text-[13px] overflow-hidden"
      style={{ background: "var(--app, var(--canvas))", color: "var(--ink)", fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}>

      {/* ───── Sidebar ───── */}
      <aside data-sidebar className="hidden md:flex flex-col flex-shrink-0"
        style={{ width: 232, background: "var(--sidebar)", borderRight: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5 px-7 h-[72px] flex-shrink-0">
          <LogoMark />
          <span className="text-[18px] font-semibold tracking-[-0.035em]" style={{ color: "var(--ink)" }}>Drafta</span>
          <button onClick={toggleDark} title="Toggle theme"
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-[7px] press" style={{ color: "var(--icon)" }}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="px-5 pb-5">
          <NavRow icon={<Inbox size={16} />} label="Inbox" onClick={() => {}} />
          <NavRow icon={<PenLine size={16} />} label="Quick Note" onClick={() => createProject("Untitled project")} />
          <NavRow icon={<Search size={16} />} label="Search" hint="⌘K" onClick={() => setSearchOpen(true)} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-1 min-h-0 chat-scroll">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--ink-3)" }}>Workspaces</span>
            <button onClick={() => createProject("Untitled project")}
              className="flex items-center justify-center w-5 h-5 rounded-[5px] press" style={{ color: "var(--icon)" }} title="New project">
              <Plus size={15} />
            </button>
          </div>

          {projects.length === 0 && (
            <div className="px-2 py-3 text-[12px]" style={{ color: "var(--ink-4)" }}>No workspaces yet.</div>
          )}

          {projects.map((p) => {
            const items = projectItems(p);
            const isActive = p.id === currentProjectId;
            const isOpen = !!expanded[p.id];
            return (
              <div key={p.id}>
                <TreeRow
                  leading={<WorkspaceDot color={accentFor(p.id)} />}
                  label={p.title || "Untitled"}
                  active={isActive && !currentEntityId}
                  caret={items.length > 0}
                  open={isOpen}
                  onCaret={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                  onClick={() => { if (p.id !== currentProjectId) switchProject(p.id); setExpanded((e) => ({ ...e, [p.id]: true })); }}
                />
                {isOpen && items.map((it) => {
                  const e = ENTITY[it.type];
                  return (
                    <Leaf key={it.id} icon={<e.Icon size={14} />} label={it.title}
                      active={currentEntityId === it.id}
                      onClick={() => { if (p.id !== currentProjectId) switchProject(p.id); openItem(it); }} />
                  );
                })}
                {isOpen && (
                  <Leaf muted icon={<Plus size={14} />} label="New doc"
                    onClick={() => { if (p.id !== currentProjectId) switchProject(p.id); createInProject(p.id, "ku"); }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <NavRow icon={<Settings size={16} />} label="Settings" onClick={() => setSettingsOpen(true)} />
          <NavRow icon={<CircleHelp size={16} />} label="Help & Support" onClick={() => {}} />
        </div>
      </aside>

      {/* ───── Main column ───── */}
      <div className="flex flex-1 min-w-0" style={{ background: "var(--canvas)" }}>
        <div className="flex flex-col flex-1 min-w-0">
          {/* topbar */}
          <header className="flex items-center gap-3 pl-7 pr-5 flex-shrink-0" style={{ height: 60 }}>
            {currentProjectId && currentEntityId ? (
              <button onClick={() => useAppStore.getState().goToProjectHome()}
                className="flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-[8px] press text-[13px] hover-row" style={{ color: "var(--ink-2)" }}>
                <ArrowLeft size={15} /> {project?.title || "Back"}
              </button>
            ) : currentProjectId ? (
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={goToProjectsHome} className="press text-[13px] truncate" style={{ color: "var(--ink-3)" }}>Workspaces</button>
                <ChevronRight size={13} style={{ color: "var(--ink-4)" }} />
                <span className="font-semibold text-[15px] tracking-[-0.005em] truncate" style={{ color: "var(--ink)" }}>{project?.title}</span>
              </div>
            ) : (
              <span className="font-semibold text-[15px] tracking-[-0.005em]" style={{ color: "var(--ink)" }}>Workspaces</span>
            )}

            <div className="flex-1" />

            {currentProjectId && !currentEntityId && (
              <div className="inline-flex items-center rounded-full p-1 mr-1" style={{ background: "var(--accent-soft)" }}>
                {([["board", LayoutGrid], ["kanban", Columns3], ["timeline", CalendarDays]] as const).map(([m, Ic]) => {
                  const on = view === m;
                  return (
                    <button key={m} onClick={() => setView(m)}
                      className="flex items-center justify-center w-8 h-8 rounded-full press"
                      style={{ background: on ? "var(--card)" : "transparent", color: on ? "var(--accent-blue)" : "var(--icon)", boxShadow: on ? "0 1px 6px rgba(24,24,22,0.10)" : undefined }}>
                      <Ic size={16} />
                    </button>
                  );
                })}
              </div>
            )}

            <button onClick={() => setChatOpen((v) => !v)} title={chatOpen ? "Hide chat" : "Show chat"}
              className="flex items-center justify-center w-8 h-8 rounded-[8px] press" style={{ color: "var(--icon)" }}>
              {chatOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </header>

          {/* body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {currentProjectId && currentEntityId ? (
              <div className="h-full overflow-hidden rounded-tl-[14px]" style={{ background: "var(--card)", borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                <WorkspacePanel />
              </div>
            ) : currentProjectId ? (
              <ProjectBody project={project} view={view} />
            ) : (
              <AllProjects projects={projects} onOpen={switchProject} onNew={() => createProject("Untitled project")} />
            )}
          </div>
        </div>

        {/* chat */}
        {chatOpen && (
          <section data-chat-panel className="hidden md:flex flex-col flex-shrink-0 m-4 ml-2 rounded-[14px] overflow-hidden"
            style={{ width: 420, background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
            <ChatPanel centered={!currentProjectId} />
          </section>
        )}
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      <KeyboardShortcuts />
    </div>
  );
}

/* ───────────────────────── store helpers ───────────────────────── */

function openItem(it: Item) {
  const s = useAppStore.getState();
  if (it.type === "ku") s.openKnowledgeUnit(it.id);
  else if (it.type === "table") s.openTable(it.id);
  else if (it.type === "deck") s.openDeck(it.id);
  else s.openPage(it.id);
}
function createInProject(projectId: string, type: EntityType) {
  const s = useAppStore.getState();
  if (type === "ku") { const e = s.createKnowledgeUnit(projectId, "New Document"); s.openKnowledgeUnit(e.id); }
  else if (type === "table") { const e = s.createTable(projectId, "New Table"); s.openTable(e.id); }
  else if (type === "deck") { const e = s.createDeck(projectId, "New Deck"); s.openDeck(e.id); }
  else { const e = s.createPage(projectId, "New Page"); s.openPage(e.id); }
}

/* ───────────────────────── project body (board/kanban/timeline) ───────────────────────── */

function ProjectBody({ project, view }: { project: Project | undefined; view: ViewMode }) {
  const items = useMemo(() => projectItems(project), [project]);
  if (!project) return null;
  if (items.length === 0) return <EmptyProject projectId={project.id} />;
  if (view === "kanban") return <KanbanView projectId={project.id} items={items} />;
  if (view === "timeline") return <TimelineView items={items} />;
  return <BoardView projectId={project.id} items={items} />;
}

function EmptyProject({ projectId }: { projectId: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 px-8">
      <div className="text-[15px] font-medium" style={{ color: "var(--ink-2)" }}>This workspace is empty</div>
      <div className="flex gap-3">
        {TYPE_ORDER.map((t) => {
          const e = ENTITY[t.type];
          return (
            <button key={t.type} onClick={() => createInProject(projectId, t.type)}
              className="flex flex-col items-center gap-2 w-28 h-28 rounded-[12px] press justify-center"
              style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)", color: "var(--ink-2)" }}>
              <e.Icon size={22} style={{ color: "var(--icon)" }} />
              <span className="text-[12.5px] font-medium">New {e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BoardView({ projectId, items }: { projectId: string; items: Item[] }) {
  return (
    <div>
      {TYPE_ORDER.map((t) => {
        const list = items.filter((i) => i.type === t.type);
        if (list.length === 0) return null;
        return (
          <section key={t.type} style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-4 h-[72px] group px-8">
              <span className="w-3 h-3 rounded-full" style={{ background: t.color }} />
              <span className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: "var(--ink)" }}>{t.label}</span>
              <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-4)" }}>{list.length}</span>
              <div className="flex-1" />
              <button onClick={() => createInProject(projectId, t.type)}
                className="flex items-center justify-center w-6 h-6 rounded-[6px] press opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--icon)" }}>
                <Plus size={17} />
              </button>
            </div>
            <div className="grid gap-4 px-9 pb-9" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
              <NewCard label={ENTITY[t.type].label} onClick={() => createInProject(projectId, t.type)} />
              {list.map((it) => <EntityCard key={it.id} item={it} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanView({ projectId, items }: { projectId: string; items: Item[] }) {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-8 py-8">
      <div className="grid gap-5 h-full" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {TYPE_ORDER.map((t) => {
          const list = items.filter((i) => i.type === t.type);
          return (
            <div key={t.type} className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{t.label}</span>
                <span className="text-[11.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{list.length}</span>
                <div className="flex-1" />
                <button onClick={() => createInProject(projectId, t.type)} className="press" style={{ color: "var(--ink-4)" }}><Plus size={14} /></button>
              </div>
              <div className="flex flex-col gap-2.5">
                {list.map((it) => {
                  const e = ENTITY[it.type];
                  return (
                    <button key={it.id} onClick={() => openItem(it)} className="text-left rounded-[10px] p-3 lift min-w-0"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <e.Icon size={12} style={{ color: "var(--icon)" }} />
                        <span className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{e.label}</span>
                      </div>
                      <div className="text-[13px] font-semibold tracking-[-0.01em] mb-1 line-clamp-2" style={{ color: "var(--ink)" }}>{it.title}</div>
                      <div className="text-[11px]" style={{ color: "var(--ink-4)" }}>{relTime(it.updatedAt)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  const dayMs = 86400000;
  const buckets: { key: string; label: string; list: Item[] }[] = [
    { key: "today", label: "Today", list: [] },
    { key: "yesterday", label: "Yesterday", list: [] },
    { key: "earlier", label: "Earlier", list: [] },
  ];
  const now = Date.now();
  for (const it of sorted) {
    const age = now - it.updatedAt;
    if (age < dayMs) buckets[0].list.push(it);
    else if (age < 2 * dayMs) buckets[1].list.push(it);
    else buckets[2].list.push(it);
  }
  return (
    <div className="max-w-[1100px] mx-auto px-9 py-8">
      {buckets.map((b) => b.list.length > 0 && (
        <section key={b.key} className="mb-9">
          <div className="flex items-center gap-3 mb-3.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{b.label}</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
            {b.list.map((it) => <EntityCard key={it.id} item={it} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ───────────────────────── cards ───────────────────────── */

function EntityCard({ item }: { item: Item }) {
  const e = ENTITY[item.type];
  return (
    <button onClick={() => openItem(item)}
      className="text-left rounded-[12px] px-4 py-4 lift flex flex-col relative overflow-hidden group"
      style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)", minHeight: 168 }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-[15.5px] font-semibold tracking-[-0.02em] leading-snug flex-1" style={{ color: "var(--ink)" }}>{item.title}</div>
        <MoreHorizontal size={15} style={{ color: "var(--ink-3)" }} />
      </div>
      <EntityPreview type={item.type} />
      <div className="flex items-center gap-2.5 mt-4 relative z-10">
        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
          <e.Icon size={13} /> {e.label}
        </span>
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--ink-4)" }}>{relTime(item.updatedAt)}</span>
      </div>
    </button>
  );
}

function EntityPreview({ type }: { type: EntityType }) {
  if (type === "table") {
    return (
      <div className="flex-1 rounded-[9px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-3 text-[10px] font-medium" style={{ color: "var(--ink-3)", background: "var(--accent-soft)" }}>
          {["A", "B", "C"].map((h) => <div key={h} className="px-2 py-1.5">{h}</div>)}
        </div>
        {[0, 1].map((r) => (
          <div key={r} className="grid grid-cols-3 text-[10.5px]" style={{ color: "var(--ink-3)", borderTop: "1px solid var(--border)" }}>
            {[0, 1, 2].map((c) => <div key={c} className="px-2 py-1.5">·</div>)}
          </div>
        ))}
      </div>
    );
  }
  if (type === "deck") {
    return <div className="flex-1 rounded-[10px]" style={{ background: "linear-gradient(135deg, #FFF4DE, #FFBE70 52%, #8AC7EA)", minHeight: 60 }} />;
  }
  if (type === "page") {
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="h-7 px-2.5 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--accent-soft)" }}>
          {["#FF7D6E", "#F7C853", "#67CEC8"].map((c) => <span key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
        </div>
        <div className="p-2.5 space-y-1.5">
          <div className="h-2.5 w-20 rounded-full" style={{ background: "var(--border-strong)" }} />
          <div className="h-7 rounded-[6px]" style={{ background: "var(--accent-soft)" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-1.5">
      {[90, 70, 80, 60].map((w, i) => <div key={i} className="h-2 rounded-full" style={{ width: `${w}%`, background: "var(--accent-soft)" }} />)}
    </div>
  );
}

function NewCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="relative overflow-hidden flex flex-col items-center justify-center gap-2.5 rounded-[12px] press"
      style={{ border: "1px solid var(--border-strong)", color: "var(--ink)", minHeight: 168, background: "linear-gradient(145deg, var(--card) 0%, var(--accent-soft) 100%)" }}>
      <span className="flex items-center justify-center w-14 h-14 rounded-full" style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}>
        <Plus size={26} strokeWidth={1.8} style={{ color: "var(--ink-2)" }} />
      </span>
      <span className="text-[14px] font-medium">Create</span>
      <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>New {label}</span>
    </button>
  );
}

/* ───────────────────────── all-projects home ───────────────────────── */

function AllProjects({ projects, onOpen, onNew }: { projects: Project[]; onOpen: (id: string) => void; onNew: () => void }) {
  return (
    <div className="max-w-[1100px] mx-auto px-9 py-9">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>Workspaces</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ink-3)" }}>Pick up where you left off, or start something new.</p>
        </div>
        <button onClick={onNew} className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] font-medium press"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          <Plus size={16} /> New workspace
        </button>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        <button onClick={onNew} className="flex flex-col items-center justify-center gap-2.5 rounded-[12px] press min-h-[120px]"
          style={{ border: "1px dashed var(--border-strong)", color: "var(--ink-3)", background: "linear-gradient(145deg, var(--card), var(--accent-soft))" }}>
          <Plus size={22} /> <span className="text-[13px] font-medium">New workspace</span>
        </button>
        {projects.map((p) => {
          const count = p.counts
            ? p.counts.knowledgeUnits + p.counts.tables + p.counts.decks + p.counts.pages
            : p.knowledgeUnits.length + p.tables.length + p.decks.length + p.pages.length;
          return (
            <button key={p.id} onClick={() => onOpen(p.id)} className="text-left rounded-[12px] p-4 lift"
              style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[15px] font-semibold text-white" style={{ background: accentFor(p.id) }}>
                  {(p.title || "•").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--ink)" }}>{p.title || "Untitled"}</div>
                  {p.projectType && <div className="text-[11.5px]" style={{ color: "var(--ink-4)" }}>{p.projectType}</div>}
                </div>
              </div>
              {p.description && <p className="text-[12px] leading-[1.5] line-clamp-2 mb-3" style={{ color: "var(--ink-3)" }}>{p.description}</p>}
              <div className="text-[11.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{count} file{count === 1 ? "" : "s"} · {relTime(p.updatedAt)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── atoms ───────────────────────── */

function LogoMark() {
  return (
    <div className="relative w-[22px] h-[22px] flex-shrink-0" aria-hidden>
      <span className="absolute left-0 top-[5px] w-[6px] h-[12px] rounded-r-full" style={{ background: "var(--ink)" }} />
      <span className="absolute left-[7px] top-[2px] w-[5px] h-[18px] rounded-full rotate-[-28deg]" style={{ background: "var(--ink)" }} />
      <span className="absolute left-[12px] top-[3px] w-[5px] h-[16px] rounded-full rotate-[28deg]" style={{ background: "var(--ink)" }} />
      <span className="absolute right-0 top-[6px] w-[4px] h-[10px] rounded-full" style={{ background: "var(--ink)" }} />
    </div>
  );
}

function WorkspaceDot({ color }: { color: string }) {
  return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />;
}

function NavRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full h-[34px] px-2 rounded-[9px] text-[13px] press hover-row" style={{ color: "var(--ink-3)" }}>
      <span style={{ color: "var(--icon)" }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {hint && <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-4)" }}>{hint}</span>}
    </button>
  );
}

function TreeRow({ leading, label, active, caret, open, onCaret, onClick }: {
  leading: React.ReactNode; label: string; active?: boolean; caret?: boolean; open?: boolean; onCaret: () => void; onClick: () => void;
}) {
  return (
    <div className="flex items-center w-full h-[34px] rounded-[9px] press group"
      style={{ background: active ? "var(--sidebar-accent)" : "transparent", color: active ? "var(--ink)" : "var(--ink-2)" }}>
      <button onClick={(e) => { e.stopPropagation(); onCaret(); }}
        className="flex items-center justify-center w-6 h-full flex-shrink-0" style={{ color: "var(--ink-4)" }}>
        {caret ? <ChevronRight size={13} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms" }} /> : <span className="w-[13px]" />}
      </button>
      <button onClick={onClick} className="flex items-center gap-2.5 flex-1 min-w-0 pr-2.5 h-full text-left" style={{ fontWeight: active ? 500 : 400 }}>
        {leading}
        <span className="flex-1 truncate">{label}</span>
      </button>
    </div>
  );
}

function Leaf({ icon, label, active, muted, onClick }: { icon: React.ReactNode; label: string; active?: boolean; muted?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full h-[28px] rounded-[8px] text-[12px] press hover-row" style={{
      paddingLeft: 30, paddingRight: 10,
      background: active ? "var(--sidebar-accent)" : "transparent",
      color: muted ? "var(--ink-4)" : active ? "var(--ink)" : "var(--ink-2)", fontWeight: active ? 500 : 400,
    }}>
      <span className="flex-shrink-0" style={{ color: muted ? "var(--ink-4)" : "var(--icon)" }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}
