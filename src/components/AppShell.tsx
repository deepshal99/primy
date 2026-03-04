"use client";

import { useState, useEffect, useMemo } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { NavRail } from "@/components/sidebar/NavRail";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { useAppStore } from "@/lib/store";

type ViewMode = "chat" | "editor" | "project";

export function AppShell() {
  const workspaceOpen = useAppStore((s) => s.workspaceOpen);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const createProject = useAppStore((s) => s.createProject);
  const resetAll = useAppStore((s) => s.resetAll);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const closeTab = useAppStore((s) => s.closeTab);
  const [searchOpen, setSearchOpen] = useState(false);

  // Derive view mode
  const viewMode: ViewMode = useMemo(() => {
    if (currentEntityId && workspaceOpen) return "editor";
    if (currentProjectId && workspaceOpen) return "project";
    return "chat";
  }, [currentEntityId, currentProjectId, workspaceOpen]);

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
          resetAll();
        }
        if (e.key === "b") {
          e.preventDefault();
          window.dispatchEvent(new Event("drafta:toggle-sidebar"));
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
  }, [resetAll, undo, redo, canUndo, canRedo, closeTab]);

  // Listen for search open event from NavRail
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener("drafta:open-search", handler);
    return () => window.removeEventListener("drafta:open-search", handler);
  }, []);

  return (
    <div className="h-screen w-screen flex bg-[#f9f9fb] overflow-hidden">
      {/* Navigation Rail — fixed 60px */}
      <NavRail />

      {/* Chat Panel */}
      <div
        data-chat-panel
        className={`flex-shrink-0 bg-white overflow-hidden transition-[flex,width,min-width,max-width] duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          viewMode === "chat"
            ? "flex-1"
            : "w-[25vw] min-w-[300px] max-w-[420px] border-r border-[#e8e7e4]"
        }`}
      >
        <ChatPanel centered={viewMode === "chat"} />
      </div>

      {/* Workspace Panel */}
      {workspaceOpen && (
        <div data-workspace-panel className="flex-1 overflow-hidden animate-fade-in">
          <WorkspacePanel />
        </div>
      )}

      <KeyboardShortcuts />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WelcomeModal />
    </div>
  );
}
