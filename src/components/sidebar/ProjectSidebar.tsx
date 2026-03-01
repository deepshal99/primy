"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  LogOut,
  FolderOpen,
  Folder,
  Ellipsis,
  Settings,
  Share2,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useProjects } from "@/lib/hooks/useProjects";
import { cn } from "@/lib/cn";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ShareModal } from "@/components/settings/ShareModal";

export function ProjectSidebar() {
  const { data: session } = useSession();
  const { data: serverProjects } = useProjects();
  const storeProjects = useAppStore((s) => s.projects);
  const projects = serverProjects && serverProjects.length > 0 ? serverProjects : storeProjects;
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadConversations = useAppStore((s) => s.loadConversations);
  const migrateConversations = useAppStore((s) => s.migrateConversations);
  const conversations = useAppStore((s) => s.conversations);
  const createProject = useAppStore((s) => s.createProject);
  const switchProject = useAppStore((s) => s.switchProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const renameProject = useAppStore((s) => s.renameProject);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [shareProjectToken, setShareProjectToken] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serverProjects && serverProjects.length > 0) {
      // Merge server list metadata into existing projects (preserving full project data for loaded projects)
      const existing = useAppStore.getState().projects;
      const merged = serverProjects.map((sp) => {
        const full = existing.find((p) => p.id === sp.id);
        return full || { ...sp, knowledgeUnits: [], tables: [], diagrams: [], decks: [], messages: [], memory: {} } as any;
      });
      useAppStore.setState({ projects: merged });
    }
  }, [serverProjects]);

  useEffect(() => {
    loadConversations();
    loadProjects();
  }, [loadConversations, loadProjects]);

  useEffect(() => {
    if (projects.length === 0 && conversations.length > 0) {
      migrateConversations();
    }
  }, [projects.length, conversations.length, migrateConversations]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("drafta:toggle-sidebar", handler);
    return () => window.removeEventListener("drafta:toggle-sidebar", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const filteredProjects = search
    ? projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const initials = session?.user?.name ? getInitials(session.user.name) : "U";

  const handleNewProject = () => createProject("New Project");

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: projectId, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      {/* Backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity duration-200"
          onClick={() => {
            setOpen(false);
            setUserMenuOpen(false);
            setContextMenu(null);
          }}
        />
      )}

      {/* Slide-in drawer panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-[300px] border-r border-[#e8e7e4] bg-[#fafaf8] overflow-hidden transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.08)]" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-[52px] flex-shrink-0">
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#95928E] hover:bg-[#f0eee9] transition-colors duration-150 flex-shrink-0"
            title="Close sidebar"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
          <span className="flex-1 text-[13px] font-semibold text-[#2d2e2e] truncate font-heading">
            Projects
          </span>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#ff4a00] bg-[rgba(255,74,0,0.06)] hover:bg-[rgba(255,74,0,0.12)] transition-colors duration-150 flex-shrink-0"
            title="New project"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        {/* Search */}
        {projects.length > 3 && (
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#95928E]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#e8e7e4] bg-[#f0eee9] text-[13px] text-[#2d2e2e] outline-none transition-colors duration-150 focus:border-[#ff4a00] placeholder:text-[#b0ada6]"
              />
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <FolderOpen className="w-6 h-6 mb-3 text-[#95928E]" strokeWidth={1} />
              <p className="text-[13px] text-center mb-1 text-[#6b6b80]">
                {search ? "No matches" : "No projects yet"}
              </p>
              {!search && (
                <p className="text-[11px] text-center mb-3 text-[#95928E]">
                  Create a project to get started
                </p>
              )}
              {!search && (
                <button
                  onClick={handleNewProject}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#ff4a00] bg-[rgba(255,74,0,0.06)] hover:bg-[rgba(255,74,0,0.12)] transition-colors duration-150"
                >
                  Create a project
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isActive = project.id === currentProjectId;

              return (
                <div key={project.id} className="relative group mb-0.5">
                  <button
                    onClick={() => {
                      if (isActive) {
                        useAppStore.getState().saveCurrentEntity();
                        useAppStore.setState({
                          currentEntityId: null,
                          currentEntityType: null,
                        });
                      } else {
                        switchProject(project.id);
                      }
                      setOpen(false);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, project.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors duration-150 relative",
                      isActive ? "bg-[#f0eee9]" : "hover:bg-[#f0eee9]"
                    )}
                  >
                    <div className="flex-shrink-0 w-[18px] h-[18px] relative">
                      {isActive ? (
                        <FolderOpen
                          className="w-[18px] h-[18px] text-[#ff4a00] transition-transform duration-200 group-hover:scale-110"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <>
                          <Folder
                            className="w-[18px] h-[18px] absolute inset-0 text-[#95928E] transition-all duration-200 group-hover:opacity-0 group-hover:scale-90"
                            strokeWidth={1.5}
                          />
                          <FolderOpen
                            className="w-[18px] h-[18px] absolute inset-0 text-[#6b6b80] transition-all duration-200 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                            strokeWidth={1.5}
                          />
                        </>
                      )}
                    </div>

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
                          className="w-full text-[14px] bg-transparent outline-none border-b border-[#ff4a00] pb-0.5 text-[#2d2e2e] font-heading"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={cn(
                            "block text-[14px] truncate leading-tight whitespace-nowrap font-heading",
                            isActive ? "text-[#1a1a2e] font-medium" : "text-[#6b6b80]"
                          )}
                        >
                          {project.title}
                        </span>
                      )}
                    </div>
                  </button>

                  {renamingId !== project.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, project.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-[#95928E] hover:bg-[#e8e6e0] transition-colors duration-150"
                      >
                        <Ellipsis className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed z-[60] border border-[#e8e8ed] rounded-lg py-1 min-w-[140px] bg-white animate-scale-in"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)",
            }}
          >
            <button
              onClick={() => {
                const p = projects.find((p) => p.id === contextMenu.id);
                if (p) {
                  setRenamingId(p.id);
                  setRenameValue(p.title);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a2e] hover:bg-[#f5f4f0] transition-colors duration-150 text-left"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rename
            </button>
            <button
              onClick={() => {
                const project = projects.find((p) => p.id === contextMenu.id);
                if (project) {
                  setShareProjectId(project.id);
                  setShareProjectToken(project.shareToken || null);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a2e] hover:bg-[#f5f4f0] transition-colors duration-150 text-left"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            <button
              onClick={() => {
                const project = projects.find((p) => p.id === contextMenu.id);
                const name = project?.title || "this project";
                if (window.confirm(`Delete "${name}"? This will remove all its documents and tables.`)) {
                  deleteProject(contextMenu.id);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#d4183d] hover:bg-red-50 transition-colors duration-150 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}

        {/* Bottom: User */}
        <div
          className="flex-shrink-0 border-t border-[#e8e7e4] px-3 py-2 relative"
          ref={userMenuRef}
        >
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-[#f0eee9] transition-colors duration-150"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 bg-[rgba(255,74,0,0.06)] text-[#ff4a00]">
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <span className="flex-1 text-[13px] text-[#2d2e2e] truncate text-left whitespace-nowrap">
              {session?.user?.name || "User"}
            </span>
            <Ellipsis className="w-4 h-4 flex-shrink-0 text-[#95928E]" />
          </button>

          {userMenuOpen && (
            <div
              className="absolute left-2 right-2 bottom-full mb-1 z-[60] border border-[#e8e8ed] rounded-lg py-1 bg-white animate-scale-in"
              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)" }}
            >
              {session?.user?.email && (
                <div className="px-3 py-2 border-b border-[#e8e8ed]">
                  <p className="text-[11px] text-[#95928E] truncate">
                    {session.user.email}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a2e] hover:bg-[#f5f4f0] transition-colors duration-150 text-left"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#d4183d] hover:bg-red-50 transition-colors duration-150 text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Share project modal */}
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
            useAppStore.setState({
              projects: state.projects.map((p) =>
                p.id === shareProjectId ? { ...p, shareToken: token } : p
              ),
            });
          }}
        />
      )}
    </>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
