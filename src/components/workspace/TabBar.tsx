"use client";

import { Table2, FileText, Undo2, Redo2, ChevronRight, Home } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

export function TabBar({ actions }: { actions?: React.ReactNode }) {
  const canUndo = useAppStore((s) => s.canUndo);
  const undo = useAppStore((s) => s.undo);
  const undoStack = useAppStore((s) => s.undoStack);
  const canRedo = useAppStore((s) => s.canRedo);
  const redo = useAppStore((s) => s.redo);
  const redoStack = useAppStore((s) => s.redoStack);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const projects = useAppStore((s) => s.projects);

  // Get current entity name for breadcrumb
  let projectTitle = "";
  let entityTitle = "";
  if (currentProjectId) {
    const project = projects.find((p) => p.id === currentProjectId);
    if (project) {
      projectTitle = project.title;
      if (currentEntityId && currentEntityType === "ku") {
        const ku = project.knowledgeUnits.find((k) => k.id === currentEntityId);
        if (ku) entityTitle = ku.title;
      } else if (currentEntityId && currentEntityType === "table") {
        const table = project.tables.find((t) => t.id === currentEntityId);
        if (table) entityTitle = table.title;
      }
    }
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
      className="flex items-center justify-between px-3 border-b"
      style={{
        height: design.layout.headerHeight,
        backgroundColor: design.colors.bg.secondary,
        borderColor: design.colors.border.default,
      }}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Always show breadcrumb: Home → File */}
        <div className="flex items-center gap-1 min-w-0 mr-3">
          {/* Home button */}
          <button
            onClick={navigateToProjectHome}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0"
            style={{
              backgroundColor: isProjectHome ? design.colors.brand.subtle : "transparent",
              color: isProjectHome ? design.colors.brand.primary : design.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              if (!isProjectHome) {
                e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                e.currentTarget.style.color = design.colors.brand.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isProjectHome) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = design.colors.text.muted;
              }
            }}
            title="Project home"
          >
            <Home className="w-4 h-4" strokeWidth={isProjectHome ? 2 : 1.5} />
          </button>

          {entityTitle ? (
            /* Entity breadcrumb: Home > file type icon + name */
            <>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.text.placeholder }} />
              {currentEntityType === "ku" ? (
                <FileText className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.accent.purple }} />
              ) : (
                <Table2 className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.accent.teal }} />
              )}
              <span
                className="text-[14px] font-medium truncate"
                style={{
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                }}
              >
                {entityTitle}
              </span>
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ml-1"
                style={{
                  backgroundColor: currentEntityType === "ku"
                    ? design.colors.accent.purpleSubtle
                    : design.colors.accent.tealSubtle,
                  color: currentEntityType === "ku"
                    ? design.colors.accent.purple
                    : design.colors.accent.teal,
                  letterSpacing: "0.05em",
                }}
              >
                {currentEntityType === "ku" ? "Doc" : "Sheet"}
              </span>
            </>
          ) : (
            /* Project Home — show project name */
            <>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.text.placeholder }} />
              <span
                className="text-[14px] font-medium truncate"
                style={{
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                }}
              >
                {projectTitle || "Home"}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
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
        {canRedo && (
          <button
            onClick={redo}
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
            title={`Redo: ${redoStack[redoStack.length - 1]?.label}`}
          >
            <Redo2 className="w-3.5 h-3.5" strokeWidth={2} />
            Redo
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
