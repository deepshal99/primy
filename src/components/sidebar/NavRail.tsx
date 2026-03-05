"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Trash2,
  Pencil,
  Search,
  LogOut,
  FolderOpen,
  Folder,
  Settings,
  Share2,
  Plus,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ShareModal } from "@/components/settings/ShareModal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NavRail() {
  const { data: session } = useSession();
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const migrateConversations = useAppStore((s) => s.migrateConversations);
  const conversations = useAppStore((s) => s.conversations);
  const createProject = useAppStore((s) => s.createProject);
  const switchProject = useAppStore((s) => s.switchProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const renameProject = useAppStore((s) => s.renameProject);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [shareProjectToken, setShareProjectToken] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (projects.length === 0 && conversations.length > 0) migrateConversations();
  }, [projects.length, conversations.length, migrateConversations]);

  useEffect(() => {
    const handler = () => setDrawerOpen((v) => !v);
    window.addEventListener("drafta:toggle-sidebar", handler);
    return () => window.removeEventListener("drafta:toggle-sidebar", handler);
  }, []);

  useEffect(() => {
    if (drawerOpen) setTimeout(() => searchRef.current?.focus(), 200);
    else setSearch("");
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node) && !(e.target as HTMLElement)?.closest("[data-nav-rail]")) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  const sorted = [...(search
    ? projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : projects
  )].sort((a, b) => {
    if (a.id === currentProjectId) return -1;
    if (b.id === currentProjectId) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const initials = session?.user?.name ? getInitials(session.user.name) : "U";

  const resetAll = useAppStore((s) => s.resetAll);
  const handleNewProject = () => { createProject("New Project"); setDrawerOpen(false); };
  const handleNewChat = () => { resetAll(); setDrawerOpen(false); };
  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) renameProject(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      {/* ── Projects Drawer — matches chat panel width ── */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed inset-y-0 z-40 flex flex-col bg-white border-r border-[#e8e7e4] transition-transform duration-300 ease-[var(--ease-spring)]",
          drawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        style={{ left: 60, width: "clamp(300px, 25vw, 420px)" }}
      >
        {/* Header */}
        <div className="flex items-center h-[52px] px-5 flex-shrink-0">
          <span className="flex-1 text-[15px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
            Projects
          </span>
          <button
            onClick={handleNewProject}
            className="h-[30px] flex items-center gap-1.5 px-2.5 rounded-lg text-[12px] text-[#6b6b80] hover:text-[#2d2e2e] hover:bg-[#f5f4f0] active:scale-[0.95] transition-all duration-150 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[#b0ada6] pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              className="w-full h-[32px] pl-8 pr-7 text-[13px] text-[#2d2e2e] placeholder:text-[#b0ada6] outline-none rounded-lg bg-[#f5f4f0] focus:bg-[#f0eee9] transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b0ada6] hover:text-[#95928E] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <FolderOpen className="w-8 h-8 text-[#e0deda] mb-3" strokeWidth={1.25} />
              <p className="text-[13px] text-[#95928E] text-center" style={{ fontWeight: 500 }}>
                {search ? "No results" : "No projects yet"}
              </p>
              {!search && (
                <button
                  onClick={handleNewProject}
                  className="mt-3 text-[12px] text-[#ff4a00] hover:underline underline-offset-2 cursor-pointer"
                  style={{ fontWeight: 550 }}
                >
                  Create your first project
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-px">
              {sorted.map((project) => {
                const isActive = project.id === currentProjectId;

                return (
                  <ContextMenu key={project.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={() => {
                          if (isActive) {
                            useAppStore.getState().saveCurrentEntity();
                            useAppStore.setState({ currentEntityId: null, currentEntityType: null });
                          } else {
                            switchProject(project.id);
                          }
                          setDrawerOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 h-[38px] rounded-lg text-left transition-colors group cursor-pointer",
                          isActive
                            ? "bg-[#fff4ee]"
                            : "hover:bg-[#f7f6f3]"
                        )}
                      >
                        {isActive ? (
                          <FolderOpen className="w-[16px] h-[16px] text-[#ff4a00] flex-shrink-0" strokeWidth={1.75} />
                        ) : (
                          <Folder className="w-[16px] h-[16px] text-[#d5d3ce] group-hover:text-[#b0ada6] flex-shrink-0 transition-colors" strokeWidth={1.75} />
                        )}

                        <div className="flex-1 min-w-0">
                          {renamingId === project.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={handleRenameSubmit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="w-full text-[13px] bg-transparent outline-none text-[#2d2e2e]"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className={cn(
                                "block text-[13px] truncate",
                                isActive ? "text-[#ff4a00]" : "text-[#2d2e2e]"
                              )}
                              style={{ fontWeight: isActive ? 560 : 440 }}
                            >
                              {project.title}
                            </span>
                          )}
                        </div>

                        {renamingId !== project.id && (
                          <span className="text-[11px] text-[#d5d3ce] tabular-nums flex-shrink-0">
                            {timeAgo(project.updatedAt || project.createdAt)}
                          </span>
                        )}
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-[150px]">
                      <ContextMenuItem onClick={() => { setRenamingId(project.id); setRenameValue(project.title); }}>
                        <Pencil className="w-3.5 h-3.5 mr-2 text-[#95928E]" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => { setShareProjectId(project.id); setShareProjectToken(project.shareToken || null); }}>
                        <Share2 className="w-3.5 h-3.5 mr-2 text-[#95928E]" />
                        Share
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-[#d4183d] focus:text-[#d4183d]"
                        onClick={() => {
                          if (window.confirm(`Delete "${project.title || "this project"}"? This removes all documents and tables.`)) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Nav Rail ── */}
      <div
        data-nav-rail
        className="w-[60px] h-full flex flex-col items-center bg-[#fafaf8] border-r border-[#e8e7e4] flex-shrink-0 relative z-50"
      >
        <div className="flex flex-col items-center gap-1 pt-4 pb-5 w-full">
          <div className="w-8 h-8 rounded-[10px] bg-[#ff4a00] flex items-center justify-center shadow-[0_1px_3px_rgba(255,74,0,0.25)] mb-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
              <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#ff4a00" />
              <line x1="10.5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
              <line x1="10.5" y1="12.5" x2="14" y2="12.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <div className="w-[6px] h-px bg-[#e8e7e4] mb-3" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleNewChat} aria-label="New chat" className="w-8 h-8 rounded-[10px] bg-[#f0eee9] flex items-center justify-center text-[#5a5852] hover:bg-[#e8e6e0] hover:scale-105 active:scale-[0.92] transition-all duration-150 mb-3 cursor-pointer">
                <Plus className="w-3.5 h-3.5 icon-plus-hover" strokeWidth={2.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>New Chat <kbd className="ml-1.5 text-[10px] opacity-60">Cmd+N</kbd></p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                aria-label="Projects"
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-[0.92] mb-1.5 cursor-pointer",
                  drawerOpen ? "bg-[#ff4a00]/10 text-[#ff4a00]" : "text-[#8a877f] hover:bg-[#f0eee9] hover:text-[#5a5852] hover:scale-105"
                )}
              >
                <FolderOpen className="w-[18px] h-[18px] transition-transform duration-150" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Projects <kbd className="ml-1.5 text-[10px] opacity-60">Cmd+B</kbd></p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new Event("drafta:open-search"))}
                aria-label="Search"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[#8a877f] hover:bg-[#f0eee9] hover:text-[#5a5852] hover:scale-105 active:scale-[0.92] transition-all duration-150 mb-1.5 cursor-pointer"
              >
                <Search className="w-[18px] h-[18px] transition-transform duration-150" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Search <kbd className="ml-1.5 text-[10px] opacity-60">Cmd+K</kbd></p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1" />
        <div className="relative mb-4">
          <Popover open={profileOpen} onOpenChange={setProfileOpen}>
            <PopoverTrigger asChild>
              <button aria-label="Profile menu" className={cn("w-8 h-8 rounded-full flex items-center justify-center active:scale-[0.92] transition-all duration-150 cursor-pointer overflow-hidden", profileOpen && "ring-2 ring-[#b0ada6]/40 ring-offset-1")}>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#e8e6e0] flex items-center justify-center">
                    <span className="text-[#5a5852] text-[11.5px]" style={{ fontWeight: 600 }}>{initials}</span>
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" sideOffset={10} align="end" className="w-[200px] p-1.5 rounded-xl border border-[#e8e7e4]" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-[#e8e6e0] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#5a5852] text-[11px]" style={{ fontWeight: 600 }}>{initials}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-[#2d2e2e] truncate" style={{ fontWeight: 550 }}>{session?.user?.name || "User"}</div>
                  <div className="text-[11px] text-[#9a968f] truncate">{session?.user?.email || ""}</div>
                </div>
              </div>
              <div className="h-px bg-[#f0eee9] mx-1 mb-1" />
              <button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }} className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] hover:bg-[#f5f4f1] transition-colors text-left active:scale-[0.99]">
                <Settings className="w-3.5 h-3.5 text-[#9a968f]" strokeWidth={1.75} />
                Settings
              </button>
              <div className="h-px bg-[#f0eee9] mx-1 my-1" />
              <button onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/login" }); }} className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#d4183d] hover:bg-red-50 transition-colors text-left active:scale-[0.99]">
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                Sign out
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Scrim */}
      {drawerOpen && <div className="fixed inset-0 z-30" onClick={() => setDrawerOpen(false)} />}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {shareProjectId && (
        <ShareModal
          open={!!shareProjectId}
          onClose={() => setShareProjectId(null)}
          mode="project"
          entityId={shareProjectId}
          entityTitle={projects.find((p) => p.id === shareProjectId)?.title || "Project"}
          currentToken={shareProjectToken}
          onTokenChange={(token) => {
            setShareProjectToken(token);
            const state = useAppStore.getState();
            useAppStore.setState({ projects: state.projects.map((p) => p.id === shareProjectId ? { ...p, shareToken: token } : p) });
          }}
        />
      )}
    </TooltipProvider>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
