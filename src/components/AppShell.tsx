"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { ProjectSidebar } from "@/components/sidebar/ProjectSidebar";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { useAppStore } from "@/lib/store";

export function AppShell() {
  const workspaceOpen = useAppStore((s) => s.workspaceOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const createProject = useAppStore((s) => s.createProject);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const closeTab = useAppStore((s) => s.closeTab);
  const [chatWidth, setChatWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          setSearchOpen(true);
        }
        if (e.key === "n") {
          e.preventDefault();
          createProject("New Project");
        }
        if (e.key === "b") {
          e.preventDefault();
          toggleSidebar();
        }
        if (e.key === "/" && !e.shiftKey) {
          e.preventDefault();
          window.dispatchEvent(new Event("drafta:focus-chat"));
        }
        if (e.key === "w") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentEntityId) {
            closeTab(s.currentEntityId);
          }
        }
        if (e.key === "1") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentProjectId) {
            const project = s.projects.find((p) => p.id === s.currentProjectId);
            if (project && project.tables.length > 0) {
              s.openTable(project.tables[0].id);
              if (!s.workspaceOpen) useAppStore.setState({ workspaceOpen: true });
            }
          }
        }
        if (e.key === "2") {
          e.preventDefault();
          const s = useAppStore.getState();
          if (s.currentProjectId) {
            const project = s.projects.find((p) => p.id === s.currentProjectId);
            if (project && project.knowledgeUnits.length > 0) {
              s.openKnowledgeUnit(project.knowledgeUnits[0].id);
              if (!s.workspaceOpen) useAppStore.setState({ workspaceOpen: true });
            }
          }
        }
        if (e.key === "z" && !e.shiftKey && canUndo) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
            e.preventDefault();
            undo();
          }
        }
        if (e.key === "z" && e.shiftKey && canRedo) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
            e.preventDefault();
            redo();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar, createProject, undo, redo, canUndo, canRedo, closeTab]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!workspaceOpen) return;
      e.preventDefault();
      setIsDragging(true);

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(340, Math.min(560, e.clientX - rect.left));
        setChatWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [workspaceOpen]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Sidebar — ChatGPT style, always present */}
      <ProjectSidebar />

      {/* Main area: chat + workspace */}
      <div ref={containerRef} className="flex flex-1 h-full min-w-0">
        {/* Chat Panel */}
        <div
          className="h-full flex-shrink-0 transition-all ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            width: workspaceOpen ? chatWidth : "100%",
            maxWidth: workspaceOpen ? 560 : undefined,
            minWidth: workspaceOpen ? 340 : undefined,
            flex: workspaceOpen ? "none" : "1",
            transitionDuration: "500ms",
          }}
        >
          <ChatPanel centered={!workspaceOpen} />
        </div>

        {/* Divider */}
        {workspaceOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={`w-px flex-shrink-0 cursor-col-resize relative group animate-fade-in-soft ${
              isDragging ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
            }`}
          >
            <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-all duration-200 ${
                isDragging
                  ? "bg-[var(--color-brand)] opacity-100"
                  : "bg-[var(--color-border)] opacity-0 group-hover:opacity-100"
              }`}
            />
          </div>
        )}

        {/* Workspace Panel */}
        {workspaceOpen && (
          <div className="flex-1 h-full min-w-0 animate-slide-in-right">
            <WorkspacePanel />
          </div>
        )}
      </div>

      <KeyboardShortcuts />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
