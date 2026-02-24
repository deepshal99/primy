"use client";

import { Table2, FileText, Undo2, ChevronRight, Home, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

export function TabBar({ actions }: { actions?: React.ReactNode }) {
  const canUndo = useAppStore((s) => s.canUndo);
  const undo = useAppStore((s) => s.undo);
  const undoStack = useAppStore((s) => s.undoStack);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const openTabs = useAppStore((s) => s.openTabs);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const closeTab = useAppStore((s) => s.closeTab);
  const projects = useAppStore((s) => s.projects);

  let projectTitle = "";
  if (currentProjectId) {
    const project = projects.find((p) => p.id === currentProjectId);
    if (project) projectTitle = project.title;
  }

  const isProjectHome = !currentEntityId;

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
      <div className="flex items-center min-w-0 flex-1 overflow-x-auto no-scrollbar">
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
            <div className="flex items-center gap-0.5 px-1">
              {openTabs.map((tab) => {
                const isActive = tab.id === currentEntityId;
                const isKu = tab.type === "ku";

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
                        if (isKu) openKnowledgeUnit(tab.id);
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
                    {isKu ? (
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
                    )}
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
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0 px-3">
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
      </div>
    </div>
  );
}
