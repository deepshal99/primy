"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Table2, FileText, GitBranch, Presentation, Undo2, ChevronRight, ChevronLeft, Home, X, Loader2, Check, Share2, MoreVertical, MessageSquareText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { ShareModal } from "@/components/settings/ShareModal";
import { CustomInstructionsModal } from "@/components/workspace/CustomInstructionsModal";

export function TabBar({ actions }: { actions?: React.ReactNode }) {
  const canUndo = useAppStore((s) => s.canUndo);
  const undo = useAppStore((s) => s.undo);
  const undoStack = useAppStore((s) => s.undoStack);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const openTabs = useAppStore((s) => s.openTabs);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDiagram = useAppStore((s) => s.openDiagram);
  const openDeck = useAppStore((s) => s.openDeck);
  const closeTab = useAppStore((s) => s.closeTab);
  const projects = useAppStore((s) => s.projects);
  const isSaving = useAppStore((s) => s.isSaving);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);

  // Save indicator state
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (lastSavedAt > 0 && !isSaving) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastSavedAt, isSaving]);

  // Tab overflow detection
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = tabsContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkOverflow);
      const ro = new ResizeObserver(checkOverflow);
      ro.observe(el);
      return () => { el.removeEventListener("scroll", checkOverflow); ro.disconnect(); };
    }
  }, [checkOverflow, openTabs.length]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = tabsContainerRef.current;
    if (el) el.scrollBy({ left: dir === "left" ? -150 : 150, behavior: "smooth" });
  };

  let projectTitle = "";
  if (currentProjectId) {
    const project = projects.find((p) => p.id === currentProjectId);
    if (project) projectTitle = project.title;
  }

  // Share modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  // 3-dot menu + custom instructions
  const [dotMenuOpen, setDotMenuOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const dotMenuRef = useRef<HTMLDivElement>(null);
  const projectMemory = useAppStore((s) => s.projectMemory);
  const hasCustomInstructions = !!projectMemory.customInstructions;

  useEffect(() => {
    if (!dotMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (dotMenuRef.current && !dotMenuRef.current.contains(e.target as Node)) setDotMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dotMenuOpen]);

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

  const isProjectHome = !currentEntityId;

  const activeTab = openTabs.find((t) => t.id === currentEntityId);

  const navigateToProjectHome = () => {
    useAppStore.getState().saveCurrentEntity();
    useAppStore.setState({
      currentEntityId: null,
      currentEntityType: null,
    });
  };

  return (
    <div
      className="flex items-center border-b"
      style={{
        height: design.layout.headerHeight,
        backgroundColor: design.colors.bg.secondary,
        borderColor: design.colors.border.default,
      }}
    >
      {/* Left: Home + Tabs */}
      <div className="flex items-center min-w-0 flex-1">
        {/* Home button */}
        <button
          onClick={navigateToProjectHome}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors flex-shrink-0 mx-1.5"
          style={{
            backgroundColor: isProjectHome && openTabs.length === 0 ? design.colors.brand.subtle : "transparent",
            color: isProjectHome && openTabs.length === 0 ? design.colors.brand.primary : design.colors.text.muted,
          }}
          onMouseEnter={(e) => {
            if (!(isProjectHome && openTabs.length === 0)) {
              e.currentTarget.style.backgroundColor = design.colors.bg.hover;
              e.currentTarget.style.color = design.colors.brand.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(isProjectHome && openTabs.length === 0)) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = design.colors.text.muted;
            }
          }}
          title={projectTitle || "Project home"}
        >
          <Home className="w-4 h-4" strokeWidth={isProjectHome ? 2 : 1.5} />
        </button>

        {/* File tabs */}
        {openTabs.length > 0 && (
          <>
            <div
              className="w-px h-5 flex-shrink-0"
              style={{ backgroundColor: design.colors.border.default }}
            />
            {/* Scroll left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollTabs("left")}
                className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded transition-colors"
                style={{ color: design.colors.text.muted }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <div ref={tabsContainerRef} className="flex items-center gap-0.5 px-1 overflow-x-auto no-scrollbar min-w-0">
              {openTabs.map((tab) => {
                const isActive = tab.id === currentEntityId;
                const isKu = tab.type === "ku";
                const isDiagram = tab.type === "diagram";
                const isDeck = tab.type === "deck";

                const tabIcon = isDeck ? (
                  <Presentation
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isActive ? design.colors.accent.blue : design.colors.text.muted }}
                    strokeWidth={1.8}
                  />
                ) : isDiagram ? (
                  <GitBranch
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isActive ? design.colors.accent.gold : design.colors.text.muted }}
                    strokeWidth={1.8}
                  />
                ) : isKu ? (
                  <FileText
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isActive ? design.colors.accent.purple : design.colors.text.muted }}
                    strokeWidth={1.8}
                  />
                ) : (
                  <Table2
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: isActive ? design.colors.accent.teal : design.colors.text.muted }}
                    strokeWidth={1.8}
                  />
                );

                return (
                  <div
                    key={tab.id}
                    className="group flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg transition-all duration-150 cursor-pointer max-w-[180px] flex-shrink-0"
                    style={{
                      backgroundColor: isActive ? design.colors.bg.elevated : "transparent",
                      boxShadow: isActive ? design.shadows.sm : "none",
                    }}
                    onClick={() => {
                      if (!isActive) {
                        if (isDeck) openDeck(tab.id);
                        else if (isDiagram) openDiagram(tab.id);
                        else if (isKu) openKnowledgeUnit(tab.id);
                        else openTable(tab.id);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {tabIcon}
                    <span
                      className="text-[12px] truncate"
                      style={{
                        color: isActive ? design.colors.text.primary : design.colors.text.secondary,
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {tab.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-0.5"
                      style={{ color: design.colors.text.muted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = design.colors.bg.tertiary;
                        e.currentTarget.style.color = design.colors.text.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = design.colors.text.muted;
                      }}
                    >
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Scroll right arrow */}
            {canScrollRight && (
              <button
                onClick={() => scrollTabs("right")}
                className="flex items-center justify-center w-6 h-6 flex-shrink-0 rounded transition-colors"
                style={{ color: design.colors.text.muted }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Right: save indicator + actions */}
      <div className="flex items-center gap-2 flex-shrink-0 px-3">
        {/* Save indicator */}
        {(isSaving || showSaved) && (
          <div className="flex items-center gap-1 text-[11px] animate-fade-in" style={{ color: design.colors.text.muted }}>
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3" style={{ color: design.colors.status.success }} />
                <span>Saved</span>
              </>
            )}
          </div>
        )}
        {/* Share button for active file */}
        {currentEntityId && activeTab && (
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ui-sm transition-colors duration-150"
            style={{
              color: shareToken ? design.colors.brand.primary : design.colors.text.secondary,
              backgroundColor: shareToken ? design.colors.brand.subtle : design.colors.bg.elevated,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = design.colors.brand.subtle;
              e.currentTarget.style.color = design.colors.brand.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = shareToken ? design.colors.brand.subtle : design.colors.bg.elevated;
              e.currentTarget.style.color = shareToken ? design.colors.brand.primary : design.colors.text.secondary;
            }}
            title="Share this file"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
            Share
          </button>
        )}
        {canUndo && (
          <button
            onClick={undo}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ui-sm transition-colors duration-150"
            style={{
              color: design.colors.text.secondary,
              backgroundColor: design.colors.bg.elevated,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = design.colors.brand.subtle;
              e.currentTarget.style.color = design.colors.brand.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = design.colors.bg.elevated;
              e.currentTarget.style.color = design.colors.text.secondary;
            }}
            title={`Undo: ${undoStack[undoStack.length - 1]?.label}`}
          >
            <Undo2 className="w-3.5 h-3.5" strokeWidth={2} />
            Undo
          </button>
        )}
        {actions}

        {/* 3-dot menu */}
        <div ref={dotMenuRef} className="relative">
          <button
            onClick={() => setDotMenuOpen(!dotMenuOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{
              backgroundColor: dotMenuOpen ? design.colors.bg.tertiary : "transparent",
              color: design.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              if (!dotMenuOpen) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              if (!dotMenuOpen) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {dotMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1 border rounded-xl py-1 min-w-[200px] z-50 animate-scale-in"
              style={{
                backgroundColor: design.colors.bg.elevated,
                borderColor: design.colors.border.default,
                boxShadow: design.shadows.dropdown,
              }}
            >
              <button
                onClick={() => {
                  setInstructionsOpen(true);
                  setDotMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors"
                style={{ color: design.colors.text.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <MessageSquareText className="w-4 h-4" style={{ color: design.colors.text.muted }} />
                Add Context
                {hasCustomInstructions && (
                  <span
                    className="w-1.5 h-1.5 rounded-full ml-auto"
                    style={{ backgroundColor: design.colors.brand.primary }}
                  />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Instructions Modal */}
      <CustomInstructionsModal open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />

      {/* Share modal for active file */}
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
            // Update the store's project data to reflect the new share token
            const state = useAppStore.getState();
            const project = state.projects.find((p) => p.id === state.currentProjectId);
            if (project) {
              if (currentEntityType === "ku") {
                const ku = project.knowledgeUnits?.find((k) => k.id === currentEntityId);
                if (ku) ku.shareToken = token;
              } else if (currentEntityType === "table") {
                const table = project.tables?.find((t) => t.id === currentEntityId);
                if (table) table.shareToken = token;
              } else if (currentEntityType === "diagram") {
                const diagram = (project.diagrams || []).find((d) => d.id === currentEntityId);
                if (diagram) diagram.shareToken = token;
              } else if (currentEntityType === "deck") {
                const deck = (project.decks || []).find((d) => d.id === currentEntityId);
                if (deck) deck.shareToken = token;
              }
              useAppStore.setState({ projects: [...state.projects] });
            }
          }}
        />
      )}
    </div>
  );
}
