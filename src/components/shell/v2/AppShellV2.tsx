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
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  Inbox, PenLine, Search, Plus, FileText, Table2, Presentation,
  LayoutTemplate, MoreHorizontal, LayoutGrid, CalendarDays,
  PanelRightOpen, Sun, Moon, ArrowLeft, Settings, Check,
  Folder as FolderIcon, FolderPlus, Home, Trash2, Pencil, FolderInput,
  Rocket, Sparkles, Compass, Layers, Target, Box, Hexagon, Flame,
  LogOut, ChevronsUpDown, ChevronRight, ChevronDown,
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
const CARD_H = 300; // consistent board card height
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
const CANDY = ["#FFB43F", "#4285F4", "#8757D7", "#67CEC8", "#F073A7", "#42C366"];
const TYPE_COLOR: Record<string, string> = {
  Design: "#8757D7", Research: "#4285F4", Marketing: "#F073A7", Finance: "#42C366",
  People: "#FFB43F", Content: "#67CEC8", Engineering: "#4285F4", Sales: "#FF7A2F", Other: "#8757D7",
};
function wsColor(p: { id: string; projectType?: string }): string {
  return (p.projectType && TYPE_COLOR[p.projectType]) || CANDY[hashOf(p.id) % CANDY.length];
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
  excerpt?: string;        // doc / page: plain-text prose preview
  bullets?: string[];      // doc: leading list items, rendered above the prose
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

// Pull leading list items + prose out of a doc so the card mirrors the real
// document shape (bullets on top, paragraph below) instead of one flat run.
function docPreview(raw: string): { bullets: string[]; body: string } {
  const src = raw || "";
  const bullets: string[] = [];
  const liMatches = src.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  if (liMatches) {
    for (const li of liMatches) {
      const t = stripText(li);
      if (t) bullets.push(t);
      if (bullets.length >= 4) break;
    }
  }
  if (bullets.length === 0) {
    for (const line of src.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:[-*+•]|\d+\.)\s+(.+)/);
      if (m) { const t = stripText(m[1]); if (t) bullets.push(t); }
      if (bullets.length >= 4) break;
    }
  }
  const bodySrc = src
    .replace(/<li[^>]*>[\s\S]*?<\/li>/gi, " ")
    .split(/\r?\n/)
    .filter((l) => !/^\s*(?:[-*+•]|\d+\.)\s+/.test(l))
    .join(" ");
  return { bullets, body: stripText(bodySrc).slice(0, 320) };
}

function sheetSample(sheets: { celldata?: { r: number; c: number; v: unknown }[] }[] | undefined): string[][] {
  const cd = sheets?.[0]?.celldata;
  if (!Array.isArray(cd)) return [];
  const grid: string[][] = [[], [], [], []];
  let any = false;
  for (const c of cd) {
    if (c.r < 4 && c.c < 3) {
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
  for (const k of p.knowledgeUnits) { const dp = docPreview(k.content); items.push({ id: k.id, type: "ku", title: k.title, updatedAt: k.updatedAt, folderId: k.folderId ?? null, excerpt: dp.body, bullets: dp.bullets }); }
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
  const [wsMenu, setWsMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const [renamingWs, setRenamingWs] = useState<string | null>(null);
  const [profileMenu, setProfileMenu] = useState(false);
  const { data: session } = useSession();
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

  // search open event (from sidebar) + Cmd+K
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener("primy:open-search", open);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); createProject("Untitled project"); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("primy:open-search", open); window.removeEventListener("keydown", key); };
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
          <span className="text-[18px] font-semibold tracking-[-0.035em]" style={{ color: "var(--ink)" }}>Primy</span>
          <button onClick={toggleDark} title="Toggle theme"
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-[7px] press" style={{ color: "var(--icon)" }}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="px-4 pb-2">
          <NavRow icon={<Inbox size={17} />} label="Inbox" onClick={() => {}} />
          <NavRow icon={<PenLine size={17} />} label="Quick Note" onClick={() => createProject("Untitled project")} />
          <NavRow icon={<Search size={17} />} label="Search" hint="⌘K" onClick={() => setSearchOpen(true)} />
        </div>

        <div ref={sidebarScroll} className="flex-1 overflow-y-auto px-4 pt-4 min-h-0 v2-scroll">
          <div className="flex items-center justify-between px-2 mb-2.5">
            <span className="text-[13px] font-medium" style={{ color: "var(--ink-3)" }}>Workspaces</span>
            <button onClick={() => createProject("Untitled project")}
              className="flex items-center justify-center w-5 h-5 rounded-[5px] press" style={{ color: "var(--icon)" }} title="New project">
              <Plus size={15} />
            </button>
          </div>

          {projects.length === 0 && (
            <div className="px-2 py-3 text-[12px]" style={{ color: "var(--ink-4)" }}>No workspaces yet.</div>
          )}

          {projects.map((p) => {
            const isActive = p.id === currentProjectId;
            if (renamingWs === p.id) {
              return (
                <div key={p.id} className="flex items-center w-full h-[36px] px-3 mb-0.5 rounded-full" style={{ background: "var(--sidebar-accent)" }}>
                  <input autoFocus defaultValue={p.title || "Untitled"}
                    onBlur={(e) => { setRenamingWs(null); const v = e.target.value.trim(); if (v && v !== p.title) useAppStore.getState().renameProject(p.id, v); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenamingWs(null); }}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-medium" style={{ color: "var(--ink)" }} />
                </div>
              );
            }
            return (
              <button key={p.id}
                onClick={() => switchProject(p.id)}
                onContextMenu={(ev) => { ev.preventDefault(); setWsMenu({ id: p.id, title: p.title || "Untitled", x: ev.clientX, y: ev.clientY }); }}
                className="flex items-center w-full h-[36px] px-3 mb-0.5 rounded-full press hover-row text-left text-[13px]"
                style={{ background: isActive ? "var(--sidebar-accent)" : "transparent", color: isActive ? "var(--ink)" : "var(--ink-2)", fontWeight: isActive ? 500 : 400 }}>
                <span className="flex-1 truncate">{p.title || "Untitled"}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2.5 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Profile */}
          <div className="relative">
            <button onClick={() => setProfileMenu((v) => !v)}
              className="flex items-center gap-3 w-full h-[44px] px-2 rounded-[10px] press hover-row">
              {(() => {
                const name = session?.user?.name || session?.user?.email || "You";
                const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
                return <span className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 text-[12px] font-semibold text-white" style={{ background: "var(--accent-purple, #8757D7)" }}>{initials}</span>;
              })()}
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{session?.user?.name || "Account"}</div>
              </div>
              <ChevronsUpDown size={14} style={{ color: "var(--ink-4)" }} />
            </button>
            {profileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileMenu(false)} />
                <div className="absolute bottom-[52px] left-0 right-0 z-50 rounded-[11px] p-1.5"
                  style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                  <button onClick={() => { setSettingsOpen(true); setProfileMenu(false); }}
                    className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                    <Settings size={14} /> Settings
                  </button>
                  <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                  <button onClick={() => { setProfileMenu(false); signOut({ callbackUrl: "/login" }); }}
                    className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "#d4183d" }}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ───── Main area ───── */}
      {!currentProjectId ? (
        /* No project → full-screen, ChatGPT-style chat (no board, no docked card) */
        <main className="flex-1 min-w-0 flex flex-col" style={{ background: "var(--canvas)" }}>
          <ChatPanel centered branded />
        </main>
      ) : (
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
              <div className="flex items-center gap-1.5 min-w-0">
                <button onClick={goToProjectsHome} title="All workspaces"
                  className="flex items-center justify-center w-8 h-8 -ml-1 rounded-[8px] press hover-row flex-shrink-0" style={{ color: "var(--icon)" }}>
                  <Home size={16} />
                </button>
                <button
                  onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); if (project) setWsMenu({ id: project.id, title: project.title || "Untitled", x: r.left, y: r.bottom + 6 }); }}
                  className="flex items-center gap-1.5 h-8 pl-1.5 pr-2 rounded-[8px] press hover-row min-w-0" title="Workspace options">
                  <span className="font-semibold text-[15px] tracking-[-0.005em] truncate" style={{ color: "var(--ink)" }}>{project?.title}</span>
                  <ChevronDown size={15} className="flex-shrink-0" style={{ color: "var(--ink-4)" }} />
                </button>
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

            {/* Project board → view toggle only (create + folders live in the board) */}
            {currentProjectId && !currentEntityId && (
              <>
                <div className="inline-flex items-center rounded-full p-1 mr-1" style={{ background: "var(--accent-soft)" }}>
                  {([["board", LayoutGrid], ["timeline", CalendarDays]] as const).map(([m, Ic]) => {
                    const on = view === m;
                    return (
                      <button key={m} onClick={() => setView(m)}
                        className="flex items-center justify-center w-8 h-8 rounded-full press"
                        style={{ background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--icon)", boxShadow: on ? "0 1px 6px rgba(24,24,22,0.10)" : undefined }}>
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
          <div ref={bodyScroll} className={`flex-1 min-h-0 v2-scroll ${currentEntityId ? "overflow-hidden" : "overflow-y-auto"}`}>
            {currentEntityId ? (
              <div className="h-full p-4 pt-0 pr-3">
                <div className="h-full overflow-hidden rounded-[14px]" style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                  <WorkspacePanel hideActions />
                </div>
              </div>
            ) : (
              <ProjectBody project={project} view={view} />
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
      )}

      {wsMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setWsMenu(null)} onContextMenu={(e) => { e.preventDefault(); setWsMenu(null); }} />
          <div className="fixed z-[61] w-48 rounded-[11px] p-1.5"
            style={{ left: Math.min(wsMenu.x, window.innerWidth - 200), top: Math.min(wsMenu.y, window.innerHeight - 120), background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
            {wsMenu.id !== currentProjectId && (
              <button onClick={() => { switchProject(wsMenu.id); setWsMenu(null); }}
                className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                <ArrowLeft size={13} className="rotate-180" /> Open
              </button>
            )}
            <button onClick={() => { setRenamingWs(wsMenu.id); setWsMenu(null); }}
              className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
              <Pencil size={13} /> Rename
            </button>
            <div className="my-1 h-px" style={{ background: "var(--border)" }} />
            <button onClick={() => { if (confirm(`Delete workspace "${wsMenu.title}"? This removes all its files.`)) { useAppStore.getState().deleteProject(wsMenu.id); } setWsMenu(null); }}
              className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "#d4183d" }}>
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
  // No header block — the title + workspace menu live in the top bar; the board
  // starts right under it for a cleaner, more breathable canvas.
  return (
    <div className="pt-2">
      {empty ? <EmptyProject projectId={project.id} />
        : view === "timeline" ? <TimelineView projectId={project.id} items={items} folders={folders} />
        : folders.length > 0 ? <FolderBoardView projectId={project.id} items={items} folders={folders} />
        : <BoardView projectId={project.id} items={items} folders={folders} />}
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
      <BoardFooter projectId={projectId} />
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
                <div className="absolute right-0 top-7 z-50 w-44 rounded-[11px] p-1.5"
                  style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                  <button onClick={() => { setMenuOpen(false); setRenaming(true); }}
                    className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                    <Pencil size={13} /> Rename
                  </button>
                  <div className="my-1 h-px" style={{ background: "var(--border)" }} />
                  <button onClick={() => { setMenuOpen(false); if (confirm(`Delete folder "${folder.name}"? Its files move to Unfiled.`)) useAppStore.getState().deleteFolder(projectId, folder.id); }}
                    className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "#d4183d" }}>
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
      <div className="grid gap-4 px-9 pb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
        <NewCard pick={{ projectId, folderId: folder?.id ?? null }} />
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
              <span className="text-[13px] font-medium">New {e.label}</span>
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
        // Every type section is always shown so its Create tile is always
        // reachable — this is how you make a sheet/deck/page (no top-bar action).
        const TIcon = ENTITY[t.type].Icon;
        return (
          <section key={t.type} style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2.5 h-[72px] group px-8">
              <TIcon size={16} style={{ color: t.color }} />
              <span className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: "var(--ink)" }}>{t.label}</span>
              {list.length > 0 && <span className="text-[12px] tabular-nums" style={{ color: "var(--ink-4)" }}>{list.length}</span>}
              <div className="flex-1" />
              <button onClick={() => createInProject(projectId, t.type)}
                className="flex items-center justify-center w-6 h-6 rounded-[6px] press opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--icon)" }}>
                <Plus size={17} />
              </button>
            </div>
            <div className="grid gap-4 px-9 pb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
              <NewCard label={ENTITY[t.type].label} onClick={() => createInProject(projectId, t.type)} />
              {list.map((it) => <EntityCard key={it.id} item={it} projectId={projectId} folders={folders} />)}
            </div>
          </section>
        );
      })}
      <BoardFooter projectId={projectId} />
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
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
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
        className="text-left rounded-[12px] px-[18px] pt-[18px] pb-[14px] lift flex flex-col relative overflow-hidden group w-full cursor-pointer"
        style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)", height: CARD_H }}>
        <div className="flex items-start gap-3 mb-3.5 flex-shrink-0">
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
              <MoreHorizontal size={16} />
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col"><EntityPreview item={item} /></div>
        <div className="flex items-center gap-2 mt-3.5 flex-shrink-0 relative z-10">
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{relTime(item.updatedAt)}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full text-[12px] font-medium" style={{ background: e.chipBg, color: e.chipText }}>
            <e.Icon size={12.5} /> {e.label}
          </span>
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
  const [showMove, setShowMove] = useState(false);
  const pane = { background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" } as const;
  const move = (folderId: string | null) => { useAppStore.getState().moveEntityToFolder(projectId, item.id, item.type, folderId); onClose(); };
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-3 top-11 z-50 w-52 rounded-[11px] p-1.5" style={pane}>
        <button onClick={onRename} className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
          <Pencil size={13} /> Rename
        </button>
        {/* Move to — opens a nested popover (left of this menu) with the folders */}
        <div className="relative">
          <button onClick={() => setShowMove((v) => !v)}
            className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row"
            style={{ color: "var(--ink-2)", background: showMove ? "var(--sidebar-accent)" : undefined }}>
            <FolderInput size={13} /> Move to
            <ChevronRight size={14} className="ml-auto" style={{ color: "var(--ink-4)" }} />
          </button>
          {showMove && (
            <div className="absolute right-full top-0 mr-1.5 z-50 w-48 rounded-[11px] p-1.5" style={pane}>
              <button onClick={() => move(null)} className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: item.folderId ? "var(--ink-2)" : "var(--ink)" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ink-4)" }} /> Unfiled
                {!item.folderId && <Check size={13} className="ml-auto" style={{ color: "var(--accent-amber)" }} />}
              </button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => move(f.id)} className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} /> <span className="truncate">{f.name}</span>
                  {item.folderId === f.id && <Check size={13} className="ml-auto flex-shrink-0" style={{ color: "var(--accent-amber)" }} />}
                </button>
              ))}
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              <button onClick={() => { const f = useAppStore.getState().createFolder(projectId); useAppStore.getState().moveEntityToFolder(projectId, item.id, item.type, f.id); onClose(); }}
                className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-3)" }}>
                <Plus size={13} /> New folder
              </button>
            </div>
          )}
        </div>
        <div className="my-1 h-px" style={{ background: "var(--border)" }} />
        <button onClick={() => { if (confirm(`Delete "${item.title}"?`)) deleteEntity(projectId, item); onClose(); }}
          className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "#d4183d" }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </>
  );
}

function EntityPreview({ item }: { item: Item }) {
  const e = ENTITY[item.type];

  if (item.type === "table") {
    // Real table preview — header row + sampled cells, clean neutral grid.
    const grid = item.cells && item.cells.length ? item.cells : null;
    const head = grid ? grid[0] : ["A", "B", "C"];
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden text-[11px]" style={{ border: "1px solid var(--border)" }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", background: "var(--accent-soft)", color: "var(--ink-3)", fontWeight: 600 }}>
          {head.slice(0, 3).map((h, i) => (
            <div key={i} className="px-2.5 py-[7px] truncate" style={{ borderRight: i < 2 ? "1px solid var(--border)" : undefined }}>{h || ["A", "B", "C"][i]}</div>
          ))}
        </div>
        {[1, 2, 3].map((r) => (
          <div key={r} className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", color: "var(--ink-2)", borderTop: "1px solid var(--border)" }}>
            {[0, 1, 2].map((c) => (
              <div key={c} className="px-2.5 py-[7px] truncate" style={{ borderRight: c < 2 ? "1px solid var(--border)" : undefined }}>{grid?.[r]?.[c] || ""}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (item.type === "deck") {
    return (
      <div className="flex-1 rounded-[10px] relative overflow-hidden flex items-end p-3" style={{ background: "linear-gradient(135deg, #FFF4DE, #FFBE70 52%, #8AC7EA)" }}>
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.8)", color: "#7a5a1f" }}>
          {item.slideCount ?? 0} slide{item.slideCount === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  if (item.type === "page") {
    // Browser-window wireframe — mirrors the rendered page shape.
    return (
      <div className="flex-1 rounded-[10px] overflow-hidden flex flex-col" style={{ border: "1px solid var(--border)" }}>
        <div className="h-7 px-3 flex items-center gap-1.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--accent-soft)" }}>
          {["#F0876A", "#F7C853", "#67CEC8"].map((c) => <span key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
        </div>
        <div className="p-3 flex-1 flex flex-col gap-2">
          <div className="h-2.5 w-1/2 rounded-full" style={{ background: "rgba(66,133,244,0.22)" }} />
          <div className="h-12 rounded-[6px]" style={{ background: "linear-gradient(105deg, rgba(66,133,244,0.14), rgba(255,173,69,0.14))" }} />
          <div className="flex gap-2 mt-auto">
            <div className="h-8 flex-1 rounded-[6px]" style={{ background: "var(--accent-soft)" }} />
            <div className="h-8 flex-1 rounded-[6px]" style={{ background: "rgba(135,87,215,0.16)" }} />
            <div className="h-8 flex-1 rounded-[6px]" style={{ background: "var(--accent-soft)" }} />
          </div>
        </div>
      </div>
    );
  }

  // doc — clean bullets + prose with a soft bottom fade. The card title is the
  // heading, so no extra strip; just breathable, mirrors the real document.
  const bullets = item.bullets ?? [];
  if (bullets.length || item.excerpt) {
    // Crisp up top, then a gentle multi-stop ramp so the last line or two
    // dissolve smoothly into the card — soft and blended, never a hard edge.
    const fade = "linear-gradient(to bottom, #000 66%, rgba(0,0,0,0.45) 85%, transparent 100%)";
    return (
      <div className="flex-1 min-h-0 overflow-hidden" style={{ maskImage: fade, WebkitMaskImage: fade }}>
        {bullets.length > 0 && (
          <ul className="space-y-[7px] mb-3.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] leading-[1.35]" style={{ color: "var(--ink-2)" }}>
                <span className="mt-[6px] w-[4px] h-[4px] rounded-full flex-shrink-0" style={{ background: "var(--ink-3)" }} />
                <span className="line-clamp-1">{b}</span>
              </li>
            ))}
          </ul>
        )}
        {item.excerpt && (
          <p className="text-[12px] leading-[1.45]" style={{ color: "var(--ink-2)" }}>{item.excerpt}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 pt-1">
      {[92, 74, 84, 60].map((w, i) => (
        <div key={i} className="h-2 rounded-full" style={{ width: `${w}%`, background: i === 0 ? e.tint : "var(--accent-soft)" }} />
      ))}
    </div>
  );
}

/**
 * Create tile. Two modes:
 *  - `onClick` + `label`: creates a single fixed type (used in type sections).
 *  - `pick`: opens a type picker so any entity can be added (used in folder
 *    sections, where a folder holds mixed types). Creation lives entirely on
 *    the board — there's intentionally no create action in the top bar.
 */
function NewCard({ label, onClick, pick }: { label?: string; onClick?: () => void; pick?: { projectId: string; folderId: string | null } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" style={{ height: CARD_H }}>
      <button onClick={() => { if (pick) setOpen((v) => !v); else onClick?.(); }}
        className="w-full h-full overflow-hidden flex flex-col items-center justify-center gap-2.5 rounded-[12px] press lift"
        style={{ border: "1px solid var(--border-strong)", color: "var(--ink)", background: "linear-gradient(155deg, #FFFDFB 0%, #EEF4FF 100%)" }}>
        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
          <Plus size={26} strokeWidth={1.8} style={{ color: "var(--ink-2)" }} />
        </span>
        <span className="text-[14px] font-medium">Create</span>
        <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{pick ? "New file" : `New ${label}`}</span>
      </button>
      {open && pick && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 z-50 w-44 rounded-[11px] p-1.5"
            style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
            {TYPE_ORDER.map((t) => {
              const e = ENTITY[t.type];
              return (
                <button key={t.type} onClick={() => { setOpen(false); createInFolder(pick.projectId, t.type, pick.folderId); }}
                  className="flex items-center gap-2.5 w-full h-8 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                  <e.Icon size={14} style={{ color: "var(--icon)" }} /> New {e.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* Quiet end-of-board affordance for organising into folders — keeps the
   top bar clean while staying discoverable right where the cards live. */
function BoardFooter({ projectId }: { projectId: string }) {
  return (
    <div className="px-9 pb-10 pt-2">
      <button onClick={() => useAppStore.getState().createFolder(projectId)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[13px] font-medium press hover-row" style={{ color: "var(--ink-3)" }}>
        <FolderPlus size={14} /> New folder
      </button>
    </div>
  );
}

/* ───────────────────────── all-projects home ───────────────────────── */

function projCounts(p: Project): { ku: number; table: number; deck: number; page: number; total: number } {
  const c = p.counts;
  const ku = c ? c.knowledgeUnits : p.knowledgeUnits.length;
  const table = c ? c.tables : p.tables.length;
  const deck = c ? c.decks : p.decks.length;
  const page = c ? c.pages : p.pages.length;
  return { ku, table, deck, page, total: ku + table + deck + page };
}

function TypeChip({ projectType, color }: { projectType: string; color: string }) {
  return (
    <span className="inline-flex items-center h-[19px] px-2 rounded-full text-[11px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color: `color-mix(in srgb, ${color} 75%, #111)` }}>
      {projectType}
    </span>
  );
}

function Composition({ p }: { p: Project }) {
  const c = projCounts(p);
  const parts: { type: EntityType; n: number }[] = [
    { type: "ku" as const, n: c.ku }, { type: "table" as const, n: c.table }, { type: "deck" as const, n: c.deck }, { type: "page" as const, n: c.page },
  ].filter((x) => x.n > 0);
  if (parts.length === 0) return <span className="text-[12px]" style={{ color: "var(--ink-4)" }}>No files yet</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {parts.map(({ type, n }) => {
        const e = ENTITY[type];
        return (
          <span key={type} className="inline-flex items-center gap-1 h-[21px] px-1.5 rounded-[6px] text-[11px] font-semibold tabular-nums" style={{ background: e.chipBg, color: e.chipText }}>
            <e.Icon size={11} /> {n}
          </span>
        );
      })}
    </div>
  );
}

function AllProjects({ projects, onOpen, onNew, onContext }: { projects: Project[]; onOpen: (id: string) => void; onNew: () => void; onContext: (id: string, title: string, e: React.MouseEvent) => void }) {
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const totalFiles = projects.reduce((s, p) => s + projCounts(p).total, 0);

  return (
    <div className="max-w-[1160px] mx-auto px-9 py-9">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Workspaces</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ink-3)" }}>
            {projects.length} workspace{projects.length === 1 ? "" : "s"} · {totalFiles} file{totalFiles === 1 ? "" : "s"} · pick up where you left off
          </p>
        </div>
        <button onClick={onNew} className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] font-medium press lift"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          <Plus size={16} /> New workspace
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 stagger-children" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(264px, 1fr))" }}>
        {sorted.map((p) => {
          const Icon = iconFor(p.id);
          const color = wsColor(p);
          return (
            <button key={p.id} onClick={() => onOpen(p.id)} onContextMenu={(e) => onContext(p.id, p.title || "Untitled", e)} className="animate-fade-in-up text-left rounded-[14px] px-[18px] py-4 lift relative overflow-hidden group flex flex-col"
              style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-card)", minHeight: 182 }}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <Icon size={17} strokeWidth={1.9} className="flex-shrink-0" style={{ color: "var(--icon)" }} />
                <span className="text-[15px] font-semibold tracking-[-0.015em] flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{p.title || "Untitled"}</span>
                {p.projectType && <TypeChip projectType={p.projectType} color={color} />}
              </div>
              {p.description && <p className="text-[13px] leading-[1.55] line-clamp-2" style={{ color: "var(--ink-3)" }}>{p.description}</p>}
              <div className="flex items-center justify-between mt-auto pt-4">
                <Composition p={p} />
                <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-4)" }}>{relTime(p.updatedAt)}</span>
              </div>
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

function NavRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full h-[38px] px-3 rounded-full text-[13px] press hover-row" style={{ color: "var(--ink-3)" }}>
      <span style={{ color: "var(--icon)" }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {hint && <span className="text-[11px] tabular-nums" style={{ color: "var(--ink-4)" }}>{hint}</span>}
    </button>
  );
}

