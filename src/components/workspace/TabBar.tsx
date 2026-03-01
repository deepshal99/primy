"use client";

import { useState, useEffect, useRef } from "react";
import { Table2, FileText, GitBranch, Presentation, Share2, Download, Loader2, Undo2, Redo2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ShareModal } from "@/components/settings/ShareModal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const ENTITY_COLORS: Record<string, string> = {
  ku: "#4a7aed",
  table: "#2e9e47",
  diagram: "#7c5cb8",
  deck: "#d4582a",
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  ku: FileText,
  table: Table2,
  diagram: GitBranch,
  deck: Presentation,
};

export function TabBar({ exportAction }: { exportAction?: React.ReactNode }) {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const openTabs = useAppStore((s) => s.openTabs);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDiagram = useAppStore((s) => s.openDiagram);
  const openDeck = useAppStore((s) => s.openDeck);
  const closeTab = useAppStore((s) => s.closeTab);
  const projects = useAppStore((s) => s.projects);
  const aiPhase = useAppStore((s) => s.aiPhase);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const aiModifiedEntityIds = useAppStore((s) => s.aiModifiedEntityIds);
  const clearAiModifiedEntity = useAppStore((s) => s.clearAiModifiedEntity);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Share modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  let projectTitle = "";
  if (currentProjectId) {
    const project = projects.find((p) => p.id === currentProjectId);
    if (project) projectTitle = project.title;
  }

  // Get the current entity's share token from the project
  useEffect(() => {
    if (!currentEntityId || !currentProjectId) return;
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return;
    if (currentEntityType === "ku") {
      const ku = project.knowledgeUnits?.find((k) => k.id === currentEntityId);
      setShareToken(ku?.shareToken || null);
    } else if (currentEntityType === "table") {
      const table = project.tables?.find((t) => t.id === currentEntityId);
      setShareToken(table?.shareToken || null);
    } else if (currentEntityType === "diagram") {
      const diagram = (project.diagrams || []).find((d) => d.id === currentEntityId);
      setShareToken(diagram?.shareToken || null);
    } else if (currentEntityType === "deck") {
      const deck = (project.decks || []).find((d) => d.id === currentEntityId);
      setShareToken(deck?.shareToken || null);
    }
  }, [currentEntityId, currentEntityType, currentProjectId, projects]);

  // Auto-clear AI highlight after 2s
  useEffect(() => {
    if (aiModifiedEntityIds.length === 0) return;
    const timers = aiModifiedEntityIds.map((id) =>
      setTimeout(() => clearAiModifiedEntity(id), 2000)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [aiModifiedEntityIds, clearAiModifiedEntity]);

  const isProjectHome = !currentEntityId;
  const activeTab = openTabs.find((t) => t.id === currentEntityId);

  const navigateToProjectHome = () => {
    useAppStore.getState().saveCurrentEntity();
    useAppStore.setState({
      currentEntityId: null,
      currentEntityType: null,
    });
  };

  const handleTabClick = (tab: { id: string; type: string }) => {
    if (tab.id === currentEntityId) return;
    if (tab.type === "deck") openDeck(tab.id);
    else if (tab.type === "diagram") openDiagram(tab.id);
    else if (tab.type === "ku") openKnowledgeUnit(tab.id);
    else openTable(tab.id);
  };

  const isBeingUpdated = aiPhase === "streaming" || aiPhase === "updating";

  return (
    <div data-tab-bar className="flex items-stretch h-[52px] bg-[#f7f5f2] border-b border-[#e8e7e4] flex-shrink-0">
      {/* Home button */}
      <button
        onClick={navigateToProjectHome}
        className="w-[52px] h-[52px] flex items-center justify-center border-r border-[#e8e7e4] hover:bg-[#efeee9] active:scale-[0.93] transition-all duration-150 flex-shrink-0 cursor-pointer"
        title={projectTitle || "Project home"}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
          <path
            d="M9 3.86998L17.25 8.625V6.89998L15.75 6.02998V3.74998H14.25V5.16748L9 2.13749L0.75 6.89998V8.625L2.25 7.7625V15.75H15.75V9.5025L14.25 8.6325V14.25H3.75V6.89998L9 3.86998Z"
            fill={isProjectHome ? "#2d2e2e" : "#95928E"}
          />
        </svg>
      </button>

      {/* Tabs */}
      <div ref={tabsContainerRef} className="flex-1 flex items-stretch overflow-x-auto scrollbar-none min-w-0">
        {openTabs.map((tab) => {
          const isActive = tab.id === currentEntityId;
          const tabType = tab.type || "ku";
          const color = ENTITY_COLORS[tabType] || "#95928E";
          const Icon = ENTITY_ICONS[tabType] || FileText;
          const showSpinner = isActive && isBeingUpdated;
          const isAiModified = aiModifiedEntityIds.includes(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "relative flex items-center gap-2.5 px-4 cursor-pointer flex-shrink-0 min-w-0 max-w-[200px] border-r border-[#e8e7e4] transition-all duration-150",
                isActive ? "bg-white" : "bg-[#f7f5f2] text-[#95928E] hover:bg-[#f0eeea]",
                isAiModified && "ai-tab-highlight"
              )}
            >
              {/* Active tab top accent */}
              {isActive && (
                <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-[#ff4a00]", showSpinner && "ai-tab-pulse")} />
              )}

              {/* AI spinner on active tab */}
              {showSpinner && (
                <Loader2 className="w-3 h-3 animate-spin text-[#ff4a00] flex-shrink-0 mr-[-4px]" />
              )}

              {/* Entity icon */}
              <Icon
                className="w-[14px] h-[14px] flex-shrink-0"
                style={{ color: isActive ? color : "#95928E" }}
                strokeWidth={1.5}
              />

              {/* Tab name */}
              <span
                className={cn(
                  "text-[12px] truncate",
                  isActive ? "text-[#2d2e2e]" : "text-[#95928E]"
                )}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                {tab.title}
              </span>

              {/* Close button */}
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[#e8e7e4] active:scale-[0.88] transition-all duration-150 ml-1"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right side: undo, redo, export, share */}
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0">
        {currentEntityId && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] active:scale-[0.92] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Undo (⌘Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] active:scale-[0.92] transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-[#e8e7e4] mx-1" />

            {exportAction}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShareOpen(true)}
                  className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] active:scale-[0.92] transition-all duration-150 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Share modal */}
      {currentEntityId && activeTab && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          mode="file"
          entityId={currentEntityId}
          entityTitle={activeTab.title}
          currentToken={shareToken}
          onTokenChange={(token) => {
            setShareToken(token);
            const state = useAppStore.getState();
            useAppStore.setState({
              projects: state.projects.map((p) => {
                if (p.id !== state.currentProjectId) return p;
                const updated = { ...p };
                if (currentEntityType === "ku") {
                  updated.knowledgeUnits = p.knowledgeUnits.map((k) =>
                    k.id === currentEntityId ? { ...k, shareToken: token } : k
                  );
                } else if (currentEntityType === "table") {
                  updated.tables = p.tables.map((t) =>
                    t.id === currentEntityId ? { ...t, shareToken: token } : t
                  );
                } else if (currentEntityType === "diagram") {
                  updated.diagrams = (p.diagrams || []).map((d) =>
                    d.id === currentEntityId ? { ...d, shareToken: token } : d
                  );
                } else if (currentEntityType === "deck") {
                  updated.decks = (p.decks || []).map((d) =>
                    d.id === currentEntityId ? { ...d, shareToken: token } : d
                  );
                }
                return updated;
              }),
            });
          }}
        />
      )}
    </div>
  );
}
