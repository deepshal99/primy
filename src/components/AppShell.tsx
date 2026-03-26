"use client";

import { useState, useEffect, useMemo } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { NavRail } from "@/components/sidebar/NavRail";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { useAppStore } from "@/lib/store";
import { MessageSquare, PanelRight } from "lucide-react";

type ViewMode = "chat" | "editor" | "project";
type MobilePanel = "chat" | "workspace";

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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");

  // Derive view mode
  const viewMode: ViewMode = useMemo(() => {
    if (currentEntityId && workspaceOpen) return "editor";
    if (currentProjectId && workspaceOpen) return "project";
    return "chat";
  }, [currentEntityId, currentProjectId, workspaceOpen]);

  // When workspace opens (e.g. AI creates an entity), switch mobile to workspace
  useEffect(() => {
    if (workspaceOpen && currentEntityId) {
      setMobilePanel("workspace");
    }
  }, [workspaceOpen, currentEntityId]);

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

  const showMobileToggle = workspaceOpen && viewMode !== "chat";

  return (
    <div className="h-screen w-screen flex bg-[#EAEAEA] overflow-hidden">
      {/* Navigation Rail — hidden on mobile */}
      <div className="hidden md:flex">
        <NavRail />
      </div>

      {/* Main content area with floating panels */}
      <div className="flex-1 flex gap-0 md:gap-2 p-0 md:p-2 md:pl-0 min-w-0 overflow-hidden">
        {/* Chat Panel — floating pane; on mobile, full-width or hidden when workspace is showing */}
        <div
          data-chat-panel
          className={`flex-shrink-0 overflow-hidden bg-white md:rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.03)] transition-[flex,width,min-width,max-width,margin] duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobilePanel === "workspace" && showMobileToggle
              ? "hidden md:block"
              : ""
          } ${
            viewMode === "chat"
              ? "flex-1"
              : "w-full md:w-[25vw] md:min-w-[300px] md:max-w-[420px]"
          }`}
        >
          <ChatPanel centered={viewMode === "chat"} />
        </div>

        {/* Workspace Panel — on mobile, full-width or hidden when chat is showing */}
        {workspaceOpen && (
          <div
            data-workspace-panel
            className={`flex-1 flex flex-col overflow-hidden animate-fade-in min-w-0 ${
              mobilePanel === "chat" && showMobileToggle
                ? "hidden md:flex"
                : ""
            }`}
          >
            <WorkspacePanel />
          </div>
        )}
      </div>

      {/* Mobile panel toggle — only visible when both panels exist */}
      {showMobileToggle && (
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-white/90 backdrop-blur-md rounded-full p-1 shadow-[0_2px_12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => setMobilePanel("chat")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              mobilePanel === "chat"
                ? "bg-[#ff4a00] text-white shadow-sm"
                : "text-[#737373] hover:text-[#171717]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMobilePanel("workspace")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              mobilePanel === "workspace"
                ? "bg-[#ff4a00] text-white shadow-sm"
                : "text-[#737373] hover:text-[#171717]"
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            Workspace
          </button>
        </div>
      )}

      <KeyboardShortcuts />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WelcomeModal />
    </div>
  );
}
