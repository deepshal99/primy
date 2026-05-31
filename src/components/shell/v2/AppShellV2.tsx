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

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox, PenLine, Search, ChevronRight, Plus, FileText, Table2, Presentation,
  LayoutTemplate, MoreHorizontal, LayoutGrid, CalendarDays,
  PanelRightOpen, Sun, Moon, ArrowLeft, Settings, CircleHelp, Check,
  Folder as FolderIcon, FolderPlus, Home, Trash2, Pencil, FolderInput,
  Rocket, Sparkles, Compass, Layers, Target, Box, Hexagon, Flame,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useDarkMode } from "@/lib/useShellV2";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { EntityShareButton, DeckExport } from "@/components/workspace/EntityActions";
import { ArtifactHistoryButton } from "@/components/snapshots/ArtifactHistoryButton";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SettingsModal } from "@/components/settings/SettingsModal";
import type { EntityType, Project, Folder } from "@/lib/types";

/* ───────────────────────── shared meta ───────────────────────── */

const FONT = "Inter, system-ui, sans-serif";
const CARD_H = 224; // consistent board card height
const ENTITY: Record<EntityType, { Icon: typeof FileText; label: string; color: string; tint: string; chipBg: string; chipText: string }> = {
  ku:    { Icon: FileText,       label: "Doc",   color: "#4285F4", tint: "rgba(66,133,244,0.14)",  chipBg: "#EDF4FF", chipText: "#3F79E0" },
  table: { Icon: Table2,         label: "Sheet", color: "#42C366", tint: "rgba(66,195,102,0.16)",  chipBg: "#E7F7ED", chipText: "#2E9E47" },
  deck:  { Icon: Presentation,   label: "Deck",  color: "#FFAD45", tint: "rgba(255,173,69,0.18)",  chipBg: "#FFF1DF", chipText: "#B87426" },
  page:  { Icon: LayoutTemplate, label: "Page",  color: "#8757D7", tint: "rgba(135,87,215,0.14)",  chipBg: "#F3ECFF", chipText: "#8051CC" },
};
const WORKSPACE_ICONS = [Rocket, Sparkles, Compass, Layers, Target, Box, Hexagon, Flame];
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function iconFor(id: string): typeof Rocket {
  return WORKSPACE_ICONS[hashOf(id) % WORKSPACE_ICONS.length];
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

type ViewMode = "board" | "timeline";
type Item = {
  id: string; type: EntityType; title: string; updatedAt: number; folderId?: string | null;
  excerpt?: string;        // doc / page: plain-text preview
  cells?: string[][];      // sheet: top-left sample
  slideCount?: number;     // deck
};

function stripText(s: string): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sheetSample(sheets: { celldata?: { r: number; c: number; v: unknown }[] }[] | undefined): string[][] {
  const cd = sheets?.[0]?.celldata;
  if (!Array.isArray(cd)) return [];
  const grid: string[][] = [[], [], []];
  let any = false;
  for (const c of cd) {
    if (c.r < 3 && c.c < 3) {
      const cv = c.v as { v?: unknown; m?: unknown } | null;
      const val = cv && typeof cv === "object" ? (cv.m ?? cv.v ?? "") : (cv ?? "");
      grid[c.r][c.c] = String(val ?? "");
      if (grid[c.r][c.c]) any = true;
    }
  }
  return any ? grid : [];
}

const TYPE_ORDER: { type: EntityType; label: string; color: string }[] = [
  { type: "ku", label: "Docs", color: ENTITY.ku.color },
  { type: "table", label: "Sheets", color: ENTITY.table.color },
  { type: "deck", label: "Decks", color: ENTITY.deck.color },
  { type: "page", label: "Pages", color: ENTITY.page.color },
];

function projectItems(p: Project | undefined): Item[] {
  if (!p) return [];
  const items: Item[] = [];
  for (const k of p.knowledgeUnits) items.push({ id: k.id, type: "ku", title: k.title, updatedAt: k.updatedAt, folderId: k.folderId ?? null, excerpt: stripText(k.content).slice(0, 220) });
  for (const t of p.tables) items.push({ id: t.id, type: "table", title: t.title, updatedAt: t.updatedAt, folderId: t.folderId ?? null, cells: sheetSample(t.sheets) });
  for (const d of p.decks) items.push({ id: d.id, type: "deck", title: d.title, updatedAt: d.updatedAt, folderId: d.folderId ?? null, slideCount: d.slides?.length ?? 0 });
  for (const pg of p.pages) items.push({ id: pg.id, type: "page", title: pg.title, updatedAt: pg.updatedAt, folderId: pg.folderId ?? null, excerpt: stripText(pg.html).slice(0, 160) });
  return items;
}

function createInFolder(projectId: string, type: EntityType, folderId: string | null) {
  const s = useAppStore.getState();
  let id: string;
  if (type === "ku") { const e = s.createKnowledgeUnit(projectId, "New Document"); id = e.id; s.openKnowledgeUnit(e.id); }
  else if (type === "table") { const e = s.createTable(projectId, "New Table"); id = e.id; s.openTable(e.id); }
  else if (type === "deck") { const e = s.createDeck(projectId, "New Deck"); id = e.id; s.openDeck(e.id); }
  else { const e = s.createPage(projectId, "New Page"); id = e.id; s.openPage(e.id); }
  if (folderId) s.moveEntityToFolder(projectId, id, type, folderId);
}

async function fetchUserForGate(): Promise<{ hasOnboarded: boolean }> {
  const res = await fetch("/api/user", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
  return res.json();
}

/** Reveal the scrollbar only while the element is scrolling, hide ~800ms after. */
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const on = () => {
      el.classList.add("is-scrolling");
      clearTimeout(t);
      t = setTimeout(() => el.classList.remove("is-scrolling"), 800);
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => { el.removeEventListener("scroll", on); clearTimeout(t); };
  }, []);
  return ref;
}

function renameEntity(projectId: string, item: Item, title: string) {
  const t = title.trim();
  if (!t || t === item.title) return;
  const s = useAppStore.getState();
  if (item.type === "ku") s.renameKnowledgeUnit(projectId, item.id, t);
  else if (item.type === "table") s.renameTable(projectId, item.id, t);
  else if (item.type === "deck") s.renameDeck(projectId, item.id, t);
  else s.renamePage(projectId, item.id, t);
}
function deleteEntity(projectId: string, item: Item) {
  const s = useAppStore.getState();
  if (item.type === "ku") s.deleteKnowledgeUnit(projectId, item.id);
  else if (item.type === "table") s.deleteTable(projectId, item.id);
  else if (item.type === "deck") s.deleteDeck(projectId, item.id);
  else s.deletePage(projectId, item.id);
}

/* ───────────────────────── shell ───────────────────────── */

export function AppShellV2() {
  const router = useRouter();
  const pathname = usePathname();
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const switchProject = useAppStore((s) => s.switchProject);
  const goToProjectsHome = useAppStore((s) => s.goToProjectsHome);
  const createProject = useAppStore((s) => s.createProject);

  const [dark, toggleDark] = useDarkMode();
  const [view, setView] = useState<ViewMode>("board");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [wsMenu, setWsMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const [renamingWs, setRenamingWs] = useState<string | null>(null);
  const sidebarScroll = useScrollReveal<HTMLDivElement>();
  const bodyScroll = useScrollReveal<HTMLDivElement>();

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

        <div ref={sidebarScroll} className="flex-1 overflow-y-auto px-4 pt-1 min-h-0 v2-scroll">
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
              <div key={p.id} className="mb-[5px]">
                {renamingWs === p.id ? (
                  <div className="flex items-center w-full h-[34px] rounded-[9px]" style={{ background: "var(--sidebar-accent)" }}>
                    <span className="w-6 flex-shrink-0" />
                    <WorkspaceBadge id={p.id} />
                    <input autoFocus defaultValue={p.title || "Untitled"}
                      onBlur={(e) => { setRenamingWs(null); const v = e.target.value.trim(); if (v && v !== p.title) useAppStore.getState().renameProject(p.id, v); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenamingWs(null); }}
                      className="flex-1 min-w-0 ml-2.5 mr-2.5 bg-transparent outline-none text-[12.5px] font-medium" style={{ color: "var(--ink)" }} />
                  </div>
                ) : (
                  <TreeRow
                    leading={<WorkspaceBadge id={p.id} />}
                    label={p.title || "Untitled"}
                    active={isActive && !currentEntityId}
                    caret={items.length > 0}
                    open={isOpen}
                    onCaret={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                    onClick={() => { if (p.id !== currentProjectId) switchProject(p.id); setExpanded((e) => ({ ...e, [p.id]: true })); }}
                    onContextMenu={(ev) => { ev.preventDefault(); setWsMenu({ id: p.id, title: p.title || "Untitled", x: ev.clientX, y: ev.clientY }); }}
                  />
                )}
                {isOpen && (() => {
                  const pFolders = (p.folders || []).slice().sort((a, b) => a.position - b.position);
                  const inFolder = (fid: string) => items.filter((it) => it.folderId === fid);
                  const unfiled = items.filter((it) => !it.folderId || !pFolders.some((f) => f.id === it.folderId));
                  const openEntity = (it: Item) => { if (p.id !== currentProjectId) switchProject(p.id); openItem(it); };
                  return (
                    <>
                      {pFolders.map((f) => (
                        <div key={f.id}>
                          <Leaf folder icon={<FolderIcon size={14} style={{ color: f.color }} />} label={f.name} count={inFolder(f.id).length} onClick={() => {}} />
                          {inFolder(f.id).map((it) => {
                            const e = ENTITY[it.type];
                            return <Leaf key={it.id} indent icon={<e.Icon size={13} />} label={it.title} active={currentEntityId === it.id} onClick={() => openEntity(it)} />;
                          })}
                        </div>
                      ))}
                      {unfiled.map((it) => {
                        const e = ENTITY[it.type];
                        return <Leaf key={it.id} icon={<e.Icon size={14} />} label={it.title} active={currentEntityId === it.id} onClick={() => openEntity(it)} />;
                      })}
                    </>
                  );
                })()}
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
                <button onClick={goToProjectsHome} title="All workspaces"
                  className="flex items-center justify-center w-8 h-8 -ml-1 rounded-[8px] press hover-row flex-shrink-0" style={{ color: "var(--icon)" }}>
                  <Home size={16} />
                </button>
                <span className="font-semibold text-[15px] tracking-[-0.005em] truncate" style={{ color: "var(--ink)" }}>{project?.title}</span>
              </div>
            ) : (
              <span className="font-semibold text-[15px] tracking-[-0.005em]" style={{ color: "var(--ink)" }}>Workspaces</span>
            )}

            <div className="flex-1" />

            {/* Entity open → editor actions hoisted from WorkspacePanel */}
            {currentProjectId && currentEntityId && currentEntityType && (
              <div className="flex items-center gap-0.5 mr-1">
                {currentEntityType !== "page" && <ArtifactHistoryButton />}
                <EntityShareButton />
                {currentEntityType === "deck" ? <DeckExport /> : currentEntityType === "table" ? <ExportMenu /> : currentEntityType !== "page" ? <DocExportMenu /> : null}
              </div>
            )}

            {/* Project board → view toggle + New folder */}
            {currentProjectId && !currentEntityId && (
              <>
                <button onClick={() => useAppStore.getState().createFolder(currentProjectId)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 mr-1 rounded-[8px] text-[12.5px] font-medium press hover-row" style={{ color: "var(--ink-2)" }}>
                  <FolderPlus size={15} /> New folder
                </button>
                <div className="inline-flex items-center rounded-full p-1 mr-1" style={{ background: "var(--accent-soft)" }}>
                  {([["board", LayoutGrid], ["timeline", CalendarDays]] as const).map(([m, Ic]) => {
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
              </>
            )}

            {!chatOpen && (
              <button onClick={() => setChatOpen(true)} title="Show chat"
                className="flex items-center justify-center w-8 h-8 rounded-[8px] press" style={{ color: "var(--icon)" }}>
                <PanelRightOpen size={16} />
              </button>
            )}
          </header>

          {/* body */}
          <div ref={bodyScroll} className={`flex-1 min-h-0 v2-scroll ${currentProjectId && currentEntityId ? "overflow-hidden" : "overflow-y-auto"}`}>
            {currentProjectId && currentEntityId ? (
              <div className="h-full p-4 pt-0 pr-3">
                <div className="h-full overflow-hidden rounded-[14px]" style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                  <WorkspacePanel hideActions />
                </div>
              </div>
            ) : currentProjectId ? (
              <ProjectBody project={project} view={view} />
            ) : (
              <AllProjects projects={projects} onOpen={switchProject} onNew={() => createProject("Untitled project")}
                onContext={(id, title, ev) => { ev.preventDefault(); setWsMenu({ id, title, x: ev.clientX, y: ev.clientY }); }} />
            )}
          </div>
        </div>

        {/* chat */}
        {chatOpen && (
          <section data-chat-panel className="hidden md:flex flex-col flex-shrink-0 m-4 ml-2 rounded-[14px] overflow-hidden t-slow"
            style={{ width: chatExpanded ? 760 : 430, background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
            <ChatPanel
              centered={!currentProjectId}
              branded
              expanded={chatExpanded}
              onToggleExpand={() => setChatExpanded((v) => !v)}
              onCollapse={() => { setChatExpanded(false); setChatOpen(false); }}
            />
          </section>
        )}
      </div>

      {wsMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setWsMenu(null)} onContextMenu={(e) => { e.preventDefault(); setWsMenu(null); }} />
          <div className="fixed z-[61] w-48 rounded-[10px] py-1.5"
            style={{ left: Math.min(wsMenu.x, window.innerWidth - 200), top: Math.min(wsMenu.y, window.innerHeight - 120), background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
            <button onClick={() => { switchProject(wsMenu.id); setWsMenu(null); }}
              className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-2)" }}>
              <ArrowLeft size={13} className="rotate-180" /> Open
            </button>
            <button onClick={() => { setRenamingWs(wsMenu.id); setWsMenu(null); }}
              className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-2)" }}>
              <Pencil size={13} /> Rename
            </button>
            <div className="my-1 h-px" style={{ background: "var(--border)" }} />
            <button onClick={() => { if (confirm(`Delete workspace "${wsMenu.title}"? This removes all its files.`)) { useAppStore.getState().deleteProject(wsMenu.id); } setWsMenu(null); }}
              className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "#d4183d" }}>
              <Trash2 size={13} /> Delete workspace
            </button>
          </div>
        </>
      )}

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
  const folders = (project.folders || []).slice().sort((a, b) => a.position - b.position);
  const empty = items.length === 0 && folders.length === 0;
  return (
    <>
      <ProjectHeader project={project} />
      {empty ? <EmptyProject projectId={project.id} />
        : view === "timeline" ? <TimelineView projectId={project.id} items={items} folders={folders} />
        : folders.length > 0 ? <FolderBoardView projectId={project.id} items={items} folders={folders} />
        : <BoardView projectId={project.id} items={items} folders={folders} />}
    </>
  );
}

/**
 * Editable workspace header. Shows the project description as "context" — this
 * is what `autoGenerateTitle` populates after the first chat exchange, and the
 * user can click to edit it. Falls back to a hint when empty.
 */
function ProjectHeader({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(project.description ?? "");
  useEffect(() => { setVal(project.description ?? ""); }, [project.id, project.description]);
  const save = () => {
    setEditing(false);
    const v = val.trim();
    if (v !== (project.description ?? "")) useAppStore.getState().updateProject(project.id, { description: v });
  };
  return (
    <div className="px-8 pt-7 pb-5 max-w-[860px]">
      <div className="flex items-center gap-2.5 mb-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>{project.title || "Untitled"}</h1>
        {project.projectType && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--ink-3)" }}>{project.projectType}</span>
        )}
      </div>
      {editing ? (
        <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); if (e.key === "Escape") { setVal(project.description ?? ""); setEditing(false); } }}
          placeholder="Describe this workspace…"
          rows={2}
          className="w-full resize-none bg-transparent outline-none text-[14px] leading-[1.55] rounded-[8px] px-2 -mx-2 py-1"
          style={{ color: "var(--ink-2)", boxShadow: "inset 0 0 0 1px var(--border-strong)" }} />
      ) : (
        <button onClick={() => setEditing(true)} className="group/desc flex items-start gap-2 text-left -mx-2 px-2 py-1 rounded-[8px] hover-row">
          <p className="text-[14px] leading-[1.55]" style={{ color: project.description ? "var(--ink-2)" : "var(--ink-4)" }}>
            {project.description || "Add a short description — or just chat, and Drafta fills this in after your first message."}
          </p>
          <Pencil size={13} className="mt-1 flex-shrink-0 opacity-0 group-hover/desc:opacity-100 transition-opacity" style={{ color: "var(--ink-4)" }} />
        </button>
      )}
    </div>
  );
}

function FolderBoardView({ projectId, items, folders }: { projectId: string; items: Item[]; folders: Folder[] }) {
  const unfiled = items.filter((i) => !i.folderId || !folders.some((f) => f.id === i.folderId));
  return (
    <div>
      {folders.map((f) => {
        const list = items.filter((i) => i.folderId === f.id);
        return <FolderSection key={f.id} projectId={projectId} folder={f} list={list} folders={folders} />;
      })}
      {unfiled.length > 0 && (
        <FolderSection projectId={projectId} folder={null} list={unfiled} folders={folders} />
      )}
    </div>
  );
}

function FolderSection({ projectId, folder, list, folders }: { projectId: string; folder: Folder | null; list: Item[]; folders: Folder[] }) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(folder?.name ?? "");
  const color = folder?.color ?? "#9A968D";
  return (
    <section style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 h-[72px] group px-8">
        <span className="flex-shrink-0" style={{ color }}>
          {folder ? <FolderIcon size={16} /> : <Inbox size={16} />}
        </span>
        {folder && renaming ? (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => { setRenaming(false); if (name.trim() && name !== folder.name) useAppStore.getState().renameFolder(projectId, folder.id, name.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(folder.name); setRenaming(false); } }}
            className="text-[15px] font-semibold tracking-[-0.005em] bg-transparent outline-none border-b" style={{ color: "var(--ink)", borderColor: color }} />
        ) : (
          <button onDoubleClick={() => folder && setRenaming(true)} className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: "var(--ink)" }}>
            {folder ? folder.name : "Unfiled"}
          </button>
        )}
        <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-4)" }}>{list.length}</span>
        <div className="flex-1" />
        {folder && (
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-6 h-6 rounded-[6px] press hover-row opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--ink-4)" }} title="Folder options">
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-50 w-44 rounded-[10px] py-1.5"
                  style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                  <button onClick={() => { setMenuOpen(false); setRenaming(true); }}
                    className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-2)" }}>
                    <Pencil size={13} /> Rename
                  </button>
                  <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                  <button onClick={() => { setMenuOpen(false); if (confirm(`Delete folder "${folder.name}"? Its files move to Unfiled.`)) useAppStore.getState().deleteFolder(projectId, folder.id); }}
                    className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "#d4183d" }}>
                    <Trash2 size={13} /> Delete folder
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <button onClick={() => createInFolder(projectId, "ku", folder?.id ?? null)}
          className="flex items-center justify-center w-6 h-6 rounded-[6px] press opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--icon)" }} title="New doc here">
          <Plus size={17} />
        </button>
      </div>
      <div className="grid gap-4 px-9 pb-9" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
        <NewCard label="Doc" onClick={() => createInFolder(projectId, "ku", folder?.id ?? null)} />
        {list.map((it) => <EntityCard key={it.id} item={it} projectId={projectId} folders={folders} />)}
      </div>
    </section>
  );
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

function BoardView({ projectId, items, folders }: { projectId: string; items: Item[]; folders: Folder[] }) {
  return (
    <div>
      {TYPE_ORDER.map((t) => {
        const list = items.filter((i) => i.type === t.type);
        if (list.length === 0) return null;
        const TIcon = ENTITY[t.type].Icon;
        return (
          <section key={t.type} style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2.5 h-[72px] group px-8">
              <TIcon size={16} style={{ color: t.color }} />
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
              {list.map((it) => <EntityCard key={it.id} item={it} projectId={projectId} folders={folders} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimelineView({ projectId, items, folders }: { projectId: string; items: Item[]; folders: Folder[] }) {
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
            {b.list.map((it) => <EntityCard key={it.id} item={it} projectId={projectId} folders={folders} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ───────────────────────── cards ───────────────────────── */

function EntityCard({ item, projectId, folders }: { item: Item; projectId?: string; folders?: Folder[] }) {
  const e = ENTITY[item.type];
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);
  useEffect(() => { setTitle(item.title); }, [item.title]);
  const canManage = !!projectId && !!folders;
  const saveTitle = () => { setRenaming(false); if (projectId) renameEntity(projectId, item, title); else setTitle(item.title); };
  return (
    <div className="relative">
      <div role="button" tabIndex={0}
        onClick={() => { if (!renaming) openItem(item); }}
        onKeyDown={(ev) => { if ((ev.key === "Enter" || ev.key === " ") && !renaming && ev.target === ev.currentTarget) { ev.preventDefault(); openItem(item); } }}
        className="text-left rounded-[12px] px-4 py-4 lift flex flex-col relative overflow-hidden group w-full cursor-pointer"
        style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)", height: CARD_H }}>
        <div className="flex items-start gap-3 mb-3 flex-shrink-0">
          {renaming ? (
            <input autoFocus value={title} onChange={(ev) => setTitle(ev.target.value)} onClick={(ev) => ev.stopPropagation()} onBlur={saveTitle}
              onKeyDown={(ev) => { ev.stopPropagation(); if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") { setTitle(item.title); setRenaming(false); } }}
              className="flex-1 min-w-0 text-[15px] font-semibold tracking-[-0.02em] bg-transparent outline-none border-b pb-0.5" style={{ color: "var(--ink)", borderColor: e.color }} />
          ) : (
            <div className="text-[15px] font-semibold tracking-[-0.02em] leading-snug flex-1 line-clamp-2" style={{ color: "var(--ink)" }}>{item.title}</div>
          )}
          {canManage && (
            <span role="button" tabIndex={0}
              onClick={(ev) => { ev.stopPropagation(); setMenuOpen((v) => !v); }}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.stopPropagation(); setMenuOpen((v) => !v); } }}
              className="flex items-center justify-center w-6 h-6 -mr-1 -mt-0.5 rounded-[6px] press hover-row cursor-pointer flex-shrink-0" style={{ color: "var(--ink-3)" }}>
              <MoreHorizontal size={15} />
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col"><EntityPreview item={item} /></div>
        <div className="flex items-center gap-2.5 mt-3.5 flex-shrink-0 relative z-10">
          <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11px] font-medium" style={{ background: e.chipBg, color: e.chipText }}>
            <e.Icon size={12} /> {e.label}
          </span>
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--ink-4)" }}>{relTime(item.updatedAt)}</span>
        </div>
      </div>
      {menuOpen && canManage && (
        <CardMenu item={item} projectId={projectId!} folders={folders!}
          onRename={() => { setMenuOpen(false); setRenaming(true); }}
          onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

function CardMenu({ item, projectId, folders, onRename, onClose }: { item: Item; projectId: string; folders: Folder[]; onRename: () => void; onClose: () => void }) {
  const move = (folderId: string | null) => { useAppStore.getState().moveEntityToFolder(projectId, item.id, item.type, folderId); onClose(); };
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-3 top-11 z-50 w-52 rounded-[10px] py-1.5 overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
        <button onClick={onRename} className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-2)" }}>
          <Pencil size={13} /> Rename
        </button>
        <div className="my-1 h-px" style={{ background: "var(--border)" }} />
        <div className="px-3 py-1 text-[11px] font-medium flex items-center gap-1.5" style={{ color: "var(--ink-4)" }}><FolderInput size={12} /> Move to</div>
        <button onClick={() => move(null)} className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: item.folderId ? "var(--ink-2)" : "var(--ink)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ink-4)" }} /> Unfiled
          {!item.folderId && <Check size={13} className="ml-auto" style={{ color: "var(--accent-amber)" }} />}
        </button>
        {folders.map((f) => (
          <button key={f.id} onClick={() => move(f.id)} className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-2)" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} /> <span className="truncate">{f.name}</span>
            {item.folderId === f.id && <Check size={13} className="ml-auto flex-shrink-0" style={{ color: "var(--accent-amber)" }} />}
          </button>
        ))}
        <button onClick={() => { const f = useAppStore.getState().createFolder(projectId); useAppStore.getState().moveEntityToFolder(projectId, item.id, item.type, f.id); onClose(); }}
          className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "var(--ink-3)" }}>
          <Plus size={13} /> New folder
        </button>
        <div className="my-1 h-px" style={{ background: "var(--border)" }} />
        <button onClick={() => { if (confirm(`Delete "${item.title}"?`)) deleteEntity(projectId, item); onClose(); }}
          className="flex items-center gap-2.5 w-full h-8 px-3 text-[12.5px] press hover-row" style={{ color: "#d4183d" }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </>
  );
}

function EntityPreview({ item }: { item: Item }) {
  const e = ENTITY[item.type];

  if (item.type === "table") {
    const grid = item.cells && item.cells.length ? item.cells : null;
    return (
      <div className="flex-1 rounded-[9px] overflow-hidden text-[10.5px]" style={{ border: `1px solid ${e.tint}` }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", color: e.chipText, background: e.chipBg, fontWeight: 600 }}>
          {(grid ? grid[0] : ["A", "B", "C"]).slice(0, 3).map((h, i) => <div key={i} className="px-2 py-1.5 truncate">{h || ""}</div>)}
        </div>
        {[1, 2].map((r) => (
          <div key={r} className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", color: "var(--ink-3)", borderTop: `1px solid ${e.tint}` }}>
            {[0, 1, 2].map((c) => <div key={c} className="px-2 py-1.5 truncate">{grid?.[r]?.[c] || ""}</div>)}
          </div>
        ))}
      </div>
    );
  }

  if (item.type === "deck") {
    return (
      <div className="flex-1 rounded-[10px] relative overflow-hidden flex items-end p-2.5" style={{ background: "linear-gradient(135deg, #FFF4DE, #FFBE70 52%, #8AC7EA)", minHeight: 64 }}>
        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.75)", color: "#7a5a1f" }}>
          {item.slideCount ?? 0} slide{item.slideCount === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  if (item.type === "page") {
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden" style={{ border: `1px solid ${e.tint}` }}>
        <div className="h-6 px-2.5 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${e.tint}`, background: "#FAF7FF" }}>
          {["#FF7D6E", "#F7C853", "#67CEC8"].map((c) => <span key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
        </div>
        <div className="p-2.5 space-y-1.5">
          <div className="h-2 w-2/3 rounded-full" style={{ background: "rgba(135,87,215,0.28)" }} />
          <div className="flex gap-1.5">
            <div className="h-9 flex-1 rounded-[5px]" style={{ background: "rgba(66,133,244,0.16)" }} />
            <div className="h-9 w-9 rounded-[5px]" style={{ background: "rgba(255,173,69,0.22)" }} />
          </div>
          <div className="h-2 w-1/2 rounded-full" style={{ background: "var(--accent-soft)" }} />
        </div>
      </div>
    );
  }

  // doc — real text excerpt, falls back to tinted lines when empty
  if (item.excerpt) {
    return <p className="flex-1 text-[11.5px] leading-[1.5] line-clamp-4" style={{ color: "var(--ink-3)" }}>{item.excerpt}</p>;
  }
  return (
    <div className="flex-1 space-y-1.5">
      {[90, 70, 80, 55].map((w, i) => (
        <div key={i} className="h-2 rounded-full" style={{ width: `${w}%`, background: i === 0 ? e.tint : "var(--accent-soft)" }} />
      ))}
    </div>
  );
}

function NewCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="relative overflow-hidden flex flex-col items-center justify-center gap-2.5 rounded-[12px] press lift"
      style={{ border: "1px solid var(--border-strong)", color: "var(--ink)", height: CARD_H, background: "linear-gradient(155deg, #FFFDFB 0%, #EEF4FF 100%)" }}>
      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
        <Plus size={26} strokeWidth={1.8} style={{ color: "var(--ink-2)" }} />
      </span>
      <span className="text-[14px] font-medium">Create</span>
      <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>New {label}</span>
    </button>
  );
}

/* ───────────────────────── all-projects home ───────────────────────── */

function AllProjects({ projects, onOpen, onNew, onContext }: { projects: Project[]; onOpen: (id: string) => void; onNew: () => void; onContext: (id: string, title: string, e: React.MouseEvent) => void }) {
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
            <button key={p.id} onClick={() => onOpen(p.id)} onContextMenu={(e) => onContext(p.id, p.title || "Untitled", e)} className="text-left rounded-[12px] p-4 lift"
              style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-3 mb-3">
                {(() => { const Icon = iconFor(p.id); return (
                  <div className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-soft)", color: "var(--icon)" }}>
                    <Icon size={18} strokeWidth={1.9} />
                  </div>
                ); })()}
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

function WorkspaceBadge({ id }: { id: string }) {
  const Icon = iconFor(id);
  return <Icon size={15} strokeWidth={1.9} className="flex-shrink-0" style={{ color: "var(--icon)" }} />;
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

function TreeRow({ leading, label, active, caret, open, onCaret, onClick, onContextMenu }: {
  leading: React.ReactNode; label: string; active?: boolean; caret?: boolean; open?: boolean; onCaret: () => void; onClick: () => void; onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center w-full h-[34px] rounded-[9px] press group" onContextMenu={onContextMenu}
      style={{ background: active ? "var(--sidebar-accent)" : "transparent", color: active ? "var(--ink)" : "var(--ink-2)" }}>
      <button onClick={(e) => { e.stopPropagation(); onCaret(); }}
        className="flex items-center justify-center w-6 h-full flex-shrink-0" style={{ color: "var(--ink-4)" }}>
        {caret ? <ChevronRight size={13} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms" }} /> : <span className="w-[13px]" />}
      </button>
      <button onClick={onClick} className="flex items-center gap-2.5 flex-1 min-w-0 pr-2.5 h-full text-left text-[12.5px]" style={{ fontWeight: active ? 500 : 400 }}>
        {leading}
        <span className="flex-1 truncate">{label}</span>
      </button>
    </div>
  );
}

function Leaf({ icon, label, active, muted, folder, indent, count, onClick }: { icon: React.ReactNode; label: string; active?: boolean; muted?: boolean; folder?: boolean; indent?: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full h-[28px] rounded-[8px] text-[12px] press hover-row" style={{
      paddingLeft: indent ? 44 : folder ? 24 : 30, paddingRight: 10,
      background: active ? "var(--sidebar-accent)" : "transparent",
      color: muted ? "var(--ink-4)" : folder ? "var(--ink-2)" : active ? "var(--ink)" : "var(--ink-2)",
      fontWeight: active || folder ? 500 : 400,
    }}>
      <span className="flex-shrink-0" style={{ color: muted ? "var(--ink-4)" : "var(--icon)" }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count != null && <span className="text-[10.5px] tabular-nums" style={{ color: "var(--ink-4)" }}>{count}</span>}
    </button>
  );
}
