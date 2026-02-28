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
import { design } from "@/lib/design";
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

  // Sync TanStack Query data back into Zustand so the rest of the app stays consistent
  useEffect(() => {
    if (serverProjects && serverProjects.length > 0) {
      useAppStore.setState({ projects: serverProjects });
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

  // Listen for Cmd+B toggle event
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("drafta:toggle-sidebar", handler);
    return () => window.removeEventListener("drafta:toggle-sidebar", handler);
  }, []);

  // Close on Escape
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
        className="fixed inset-y-0 left-0 z-50 flex flex-col border-r overflow-hidden"
        style={{
          width: 300,
          backgroundColor: design.colors.bg.sidebar,
          borderColor: design.colors.border.sidebar,
          boxShadow: open ? "4px 0 24px rgba(0,0,0,0.08)" : "none",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ height: 52 }}
        >
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            title="Close sidebar"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
          <span
            className="flex-1 text-[13px] font-semibold truncate"
            style={{
              color: design.colors.text.sidebar,
              fontFamily: design.typography.family.heading,
            }}
          >
            Projects
          </span>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{
              color: design.colors.brand.primary,
              backgroundColor: design.colors.brand.subtle,
              fontSize: "13px",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.muted; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.subtle; }}
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
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: design.colors.text.muted }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border text-[13px] outline-none transition-colors"
                style={{
                  backgroundColor: design.colors.bg.sidebarHover,
                  borderColor: design.colors.border.sidebar,
                  color: design.colors.text.sidebar,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
              />
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <FolderOpen
                className="w-6 h-6 mb-3"
                style={{ color: design.colors.text.muted }}
                strokeWidth={1}
              />
              <p className="text-[13px] text-center mb-1" style={{ color: design.colors.text.secondary }}>
                {search ? "No matches" : "No projects yet"}
              </p>
              {!search && (
                <p className="text-[11px] text-center mb-3" style={{ color: design.colors.text.muted }}>
                  Create a project to get started
                </p>
              )}
              {!search && (
                <button
                  onClick={handleNewProject}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    color: design.colors.brand.primary,
                    backgroundColor: design.colors.brand.subtle,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.muted; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = design.colors.brand.subtle; }}
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
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors relative"
                    style={{
                      backgroundColor: isActive ? design.colors.bg.sidebarActive : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? design.colors.bg.sidebarActive : "transparent"; }}
                  >
                    <div className="flex-shrink-0 w-[18px] h-[18px] relative">
                      {isActive ? (
                        <FolderOpen
                          className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110"
                          style={{ color: design.colors.brand.primary }}
                          strokeWidth={1.5}
                        />
                      ) : (
                        <>
                          <Folder
                            className="w-[18px] h-[18px] absolute inset-0 transition-all duration-200 group-hover:opacity-0 group-hover:scale-90"
                            style={{ color: design.colors.text.muted }}
                            strokeWidth={1.5}
                          />
                          <FolderOpen
                            className="w-[18px] h-[18px] absolute inset-0 transition-all duration-200 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                            style={{ color: design.colors.text.secondary }}
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
                          className="w-full text-[14px] bg-transparent outline-none border-b pb-0.5"
                          style={{
                            color: design.colors.text.sidebar,
                            borderColor: design.colors.brand.primary,
                            fontFamily: design.typography.family.heading,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="block text-[14px] truncate leading-tight whitespace-nowrap"
                          style={{
                            color: isActive ? design.colors.text.primary : design.colors.text.secondary,
                            fontWeight: isActive ? 500 : 400,
                            fontFamily: design.typography.family.heading,
                          }}
                        >
                          {project.title}
                        </span>
                      )}
                    </div>
                  </button>

                  {renamingId !== project.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, project.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                        style={{ color: design.colors.text.muted }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarActive; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
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
            className="fixed z-[60] border rounded-lg py-1 min-w-[140px] animate-scale-in"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: design.colors.bg.elevated,
              borderColor: design.colors.border.default,
              boxShadow: design.shadows.dropdown,
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
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left"
              style={{ color: design.colors.text.primary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
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
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left"
              style={{ color: design.colors.text.primary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
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
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left"
              style={{ color: "#E05555" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 85, 85, 0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}

        {/* Bottom: User */}
        <div
          className="flex-shrink-0 border-t px-3 py-2 relative"
          style={{ borderColor: design.colors.border.sidebar }}
          ref={userMenuRef}
        >
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
              style={{
                backgroundColor: design.colors.brand.subtle,
                color: design.colors.brand.primary,
              }}
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <span
              className="flex-1 text-[13px] truncate text-left whitespace-nowrap"
              style={{ color: design.colors.text.sidebar }}
            >
              {session?.user?.name || "User"}
            </span>
            <Ellipsis
              className="w-4 h-4 flex-shrink-0"
              style={{ color: design.colors.text.muted }}
            />
          </button>

          {userMenuOpen && (
            <div
              className="absolute left-2 right-2 bottom-full mb-1 z-[60] border rounded-lg py-1 animate-scale-in"
              style={{
                backgroundColor: design.colors.bg.elevated,
                borderColor: design.colors.border.default,
                boxShadow: design.shadows.dropdown,
              }}
            >
              {session?.user?.email && (
                <div className="px-3 py-2 border-b" style={{ borderColor: design.colors.border.default }}>
                  <p className="text-[11px] truncate" style={{ color: design.colors.text.muted }}>
                    {session.user.email}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left"
                style={{ color: design.colors.text.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left"
                style={{ color: "#E05555" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(224, 85, 85, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
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
