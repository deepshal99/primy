"use client";

import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { SheetPanel } from "@/components/sheet/SheetPanel";
import { DocPanel } from "@/components/doc/DocPanel";
import { DiagramPanel } from "@/components/diagram/DiagramPanel";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";

export function WorkspacePanel() {
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  // No entity open → show Project Home
  if (!currentEntityId) {
    return (
      <div className="flex flex-col h-full" style={{ backgroundColor: design.colors.bg.primary }}>
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <ProjectHome />
        </div>
      </div>
    );
  }

  // Entity open — show the correct panel based on entity type
  const isDiagram = currentEntityType === "diagram";
  const isTable = currentEntityType === "table";

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      <TabBar
        actions={isDiagram ? undefined : isTable ? <ExportMenu /> : <DocExportMenu />}
      />
      <div className="flex-1 overflow-hidden relative">
        {isDiagram ? <DiagramPanel /> : isTable ? <SheetPanel /> : <DocPanel />}
      </div>
    </div>
  );
}
