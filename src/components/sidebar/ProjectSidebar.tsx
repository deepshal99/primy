"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  PanelLeft,
  LogOut,
  FolderOpen,
  Folder,
  Ellipsis,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { SettingsModal } from "@/components/settings/SettingsModal";

export function ProjectSidebar() {
  const { data: session } = useSession();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadConversations = useAppStore((s) => s.loadConversations);
  const migrateConversations = useAppStore((s) => s.migrateConversations);
  const conversations = useAppStore((s) => s.conversations);
  const createProject = useAppStore((s) => s.createProject);
  const switchProject = useAppStore((s) => s.switchProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const renameProject = useAppStore((s) => s.renameProject);

  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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

  // Collapsed state
  if (!sidebarOpen) {
    return (
      <div
        className="h-full flex-shrink-0 flex flex-col items-center py-3 gap-2 border-r"
        style={{
          width: 52,
          backgroundColor: design.colors.bg.sidebar,
          borderColor: design.colors.border.sidebar,
        }}
      >
        <button
          onClick={toggleSidebar}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Open sidebar"
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleNewProject}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover;
            e.currentTarget.style.color = design.colors.brand.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = design.colors.text.sidebarMuted;
          }}
          title="New project"
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full flex-shrink-0 border-r flex flex-col"
      style={{
        width: 260,
        backgroundColor: design.colors.bg.sidebar,
        borderColor: design.colors.border.sidebar,
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ color: design.colors.text.sidebarMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Close sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={handleNewProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
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
              style={{ color: design.colors.text.sidebarDim }}
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
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.text.sidebarDim; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.sidebar; }}
            />
          </div>
        </div>
      )}

      {/* Section label */}
      <div className="px-4 pt-1 pb-2 flex-shrink-0">
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: design.colors.text.sidebarDim,
          }}
        >
          Projects
        </span>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <FolderOpen
              className="w-6 h-6 mb-3"
              style={{ color: design.colors.text.sidebarDim }}
              strokeWidth={1}
            />
            <p className="text-[13px] text-center mb-1" style={{ color: design.colors.text.sidebarMuted }}>
              {search ? "No matches" : "No projects yet"}
            </p>
            {!search && (
              <p className="text-[11px] text-center mb-3" style={{ color: design.colors.text.sidebarDim }}>
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
                  }}
                  onContextMenu={(e) => handleContextMenu(e, project.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors relative"
                  style={{
                    backgroundColor: isActive ? design.colors.bg.sidebarActive : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = design.colors.bg.sidebarHover; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? design.colors.bg.sidebarActive : "transparent"; }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                      style={{ backgroundColor: design.colors.brand.primary }}
                    />
                  )}

                  {/* Folder icon */}
                  {isActive ? (
                    <FolderOpen className="w-[18px] h-[18px] flex-shrink-0" style={{ color: design.colors.brand.primary }} strokeWidth={1.5} />
                  ) : (
                    <Folder className="w-[18px] h-[18px] flex-shrink-0" style={{ color: design.colors.text.sidebarDim }} strokeWidth={1.5} />
                  )}

                  {/* Name only — clean, minimal */}
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
                        className="block text-[14px] truncate leading-tight"
                        style={{
                          color: isActive ? design.colors.text.sidebar : design.colors.text.sidebarMuted,
                          fontWeight: isActive ? 500 : 400,
                          fontFamily: design.typography.family.heading,
                        }}
                      >
                        {project.title}
                      </span>
                    )}
                  </div>
                </button>

                {/* Hover actions: ... button */}
                {renamingId !== project.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, project.id);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                      style={{ color: design.colors.text.sidebarMuted }}
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
          className="fixed z-50 border rounded-xl py-1.5 min-w-[140px] animate-scale-in"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: design.colors.bg.sidebarHover,
            borderColor: design.colors.border.sidebar,
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
            style={{ color: design.colors.text.sidebar }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarActive; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Rename
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
        className="flex-shrink-0 border-t px-2 py-2 relative"
        style={{ borderColor: design.colors.border.sidebar }}
        ref={userMenuRef}
      >
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors"
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
          <span className="flex-1 text-[13px] truncate text-left" style={{ color: design.colors.text.sidebar }}>
            {session?.user?.name || "User"}
          </span>
          <Ellipsis className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.text.sidebarDim }} />
        </button>

        {userMenuOpen && (
          <div
            className="absolute left-2 right-2 bottom-full mb-1 z-50 border rounded-xl py-1.5 animate-scale-in"
            style={{
              backgroundColor: design.colors.bg.sidebarHover,
              borderColor: design.colors.border.sidebar,
              boxShadow: design.shadows.dropdown,
            }}
          >
            {session?.user?.email && (
              <div className="px-3 py-2 border-b" style={{ borderColor: design.colors.border.sidebar }}>
                <p className="text-[11px] truncate" style={{ color: design.colors.text.sidebarMuted }}>
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
              style={{ color: design.colors.text.sidebar }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.sidebarActive; }}
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

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
