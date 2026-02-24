"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { SheetPanel } from "@/components/sheet/SheetPanel";
import { DocPanel } from "@/components/doc/DocPanel";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";

export function WorkspacePanel() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);

  // Show Project Home when project is active but no entity is open
  const showProjectHome = !!currentProjectId && !currentEntityId;

  // Keyboard shortcuts: Ctrl/Cmd+1 for Sheet, Ctrl/Cmd+2 for Doc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "1") {
        e.preventDefault();
        setActiveTab("sheet");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "2") {
        e.preventDefault();
        setActiveTab("doc");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveTab]);

  if (showProjectHome) {
    return (
      <div className="flex flex-col h-full" style={{ backgroundColor: design.colors.bg.primary }}>
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <ProjectHome />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      <TabBar
        actions={activeTab === "sheet" ? <ExportMenu /> : <DocExportMenu />}
      />
      <div className="flex-1 overflow-hidden relative">
        {/* Keep both mounted to preserve state, toggle visibility */}
        <div className={`h-full ${activeTab === "sheet" ? "" : "hidden"}`}>
          <SheetPanel />
        </div>
        <div className={`h-full ${activeTab === "doc" ? "" : "hidden"}`}>
          <DocPanel />
        </div>
      </div>
    </div>
  );
}
