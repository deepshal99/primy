"use client";

import { useState, useEffect, useRef } from "react";
import { Table2, FileText, GitBranch, Presentation, Share2, Loader2, Undo2, Redo2, Cloud, CloudOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ShareModal } from "@/components/settings/ShareModal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/* ── Design system entity colors ── */
const ENTITY_COLORS: Record<string, string> = {
  ku: "#2a6dfb",
  table: "#42c366",
  diagram: "#9061ff",
  deck: "#fa5d19",
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  ku: FileText,
  table: Table2,
  diagram: GitBranch,
  deck: Presentation,
};

/* SVG curve connector — fills the gap between active tab and bar */
function CurveLeft() {
  return (
    <svg className="absolute bottom-0 -left-3 w-3 h-3 pointer-events-none" viewBox="0 0 12 12">
      <path d="M12 12 L12 0 C12 6.627 6.627 12 0 12 Z" fill="#ffffff" />
    </svg>
  );
}
function CurveRight() {
  return (
    <svg className="absolute bottom-0 -right-3 w-3 h-3 pointer-events-none" viewBox="0 0 12 12">
      <path d="M0 12 L0 0 C0 6.627 5.373 12 12 12 Z" fill="#ffffff" />
    </svg>
  );
}

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
  const isSaving = useAppStore((s) => s.isSaving);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const saveError = useAppStore((s) => s.saveError);

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
    <>
      {/* ── Tab bar — sits in beige background, tabs merge into white content ── */}
      <div data-tab-bar className="flex items-end h-[44px] flex-shrink-0 pl-0 pr-2">
        {/* Tabs area */}
        <div ref={tabsContainerRef} className="flex items-end overflow-x-auto scrollbar-none min-w-0 flex-1">
          {/* Home tab — only visible when there are open entity tabs */}
          {openTabs.length > 0 && (
            <button
              onClick={navigateToProjectHome}
              className={cn(
                "group relative flex items-center justify-center h-[44px] w-[48px] cursor-pointer flex-shrink-0 transition-colors duration-150",
                !currentEntityId
                  ? "bg-white text-[#171717] z-[2]"
                  : "text-[#737373] hover:bg-black/[0.04] hover:text-[#525252]"
              )}
              style={{
                borderRadius: !currentEntityId
                  ? "12px 10px 0 0"
                  : "10px 10px 0 0",
              }}
              title={projectTitle || "Project home"}
            >
              {!currentEntityId && <CurveRight />}
              <svg
                width="14"
                height="14"
                viewBox="0 0 18 18"
                fill={!currentEntityId ? "#171717" : "#b0ada6"}
                className="flex-shrink-0"
              >
                <path d="M9 3.86998L17.25 8.625V6.89998L15.75 6.02998V3.74998H14.25V5.16748L9 2.13749L0.75 6.89998V8.625L2.25 7.7625V15.75H15.75V9.5025L14.25 8.6325V14.25H3.75V6.89998L9 3.86998Z" />
              </svg>
            </button>
          )}

          {openTabs.map((tab, index) => {
            const isActive = tab.id === currentEntityId;
            const tabType = tab.type || "ku";
            const color = ENTITY_COLORS[tabType] || "#95928E";
            const Icon = ENTITY_ICONS[tabType] || FileText;
            const showSpinner = isActive && isBeingUpdated;
            const isAiModified = aiModifiedEntityIds.includes(tab.id);
            const isFirst = false; // Never first — home tab is always first

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "group relative flex items-center gap-2 h-[44px] px-3.5 cursor-pointer flex-shrink-0 min-w-0 max-w-[220px] transition-colors duration-150",
                  isActive
                    ? "bg-white text-[#171717] z-[2]"
                    : "text-[#737373] hover:bg-black/[0.04] hover:text-[#525252]",
                  isAiModified && "ai-tab-highlight"
                )}
                style={{
                  borderRadius: isActive
                    ? isFirst
                      ? "12px 10px 0 0"   // First tab: rounded top-left matching content
                      : "10px 10px 0 0"    // Middle tabs: rounded top corners
                    : "10px 10px 0 0",     // Inactive: same rounding
                }}
              >
                {/* SVG curve connectors — only on active tab */}
                {isActive && !isFirst && <CurveLeft />}
                {isActive && <CurveRight />}

                {/* AI spinner */}
                {showSpinner && (
                  <Loader2 className="w-3 h-3 animate-spin text-[#fa5d19] flex-shrink-0" />
                )}

                {/* Entity type icon */}
                <Icon
                  className="w-[14px] h-[14px] flex-shrink-0"
                  style={{ color: isActive ? color : "#b0ada6" }}
                  strokeWidth={1.75}
                />

                {/* Tab name */}
                <span
                  className="text-[12.5px] truncate"
                  style={{ fontWeight: isActive ? 550 : 440 }}
                >
                  {tab.title}
                </span>

                {/* Close button */}
                <div
                  role="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded-md hover:bg-black/[0.06] active:scale-[0.95] transition-opacity duration-100 ml-0.5",
                    isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                    <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </button>
            );
          })}

        </div>

        {/* Right actions — undo, redo, save status, export, share */}
        <div className="flex items-center gap-0.5 h-[44px] px-1 flex-shrink-0">
          {currentEntityId && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-black/[0.04] active:scale-[0.95] transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <Undo2 className="w-[14px] h-[14px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Undo (⌘Z)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-black/[0.04] active:scale-[0.95] transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <Redo2 className="w-[14px] h-[14px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
              </Tooltip>

              {/* Save status */}
              <div className="flex items-center gap-1 px-1.5">
                {saveError ? (
                  <>
                    <CloudOff className="w-3 h-3 text-red-500" />
                    <span className="text-[11px] text-red-500">Error</span>
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-[#a3a3a3]" />
                    <span className="text-[11px] text-[#a3a3a3]">Saving</span>
                  </>
                ) : lastSavedAt > 0 ? (
                  <>
                    <Cloud className="w-3 h-3 text-[#a3a3a3]" />
                    <span className="text-[11px] text-[#a3a3a3]">Saved</span>
                  </>
                ) : null}
              </div>

              {exportAction}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShareOpen(true)}
                    className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#a3a3a3] hover:text-[#525252] hover:bg-black/[0.04] active:scale-[0.95] transition-colors duration-150 cursor-pointer"
                  >
                    <Share2 className="w-[14px] h-[14px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
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
    </>
  );
}
