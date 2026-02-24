"use client";

import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { SheetPanel } from "@/components/sheet/SheetPanel";
import { DocPanel } from "@/components/doc/DocPanel";
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
  const isTable = currentEntityType === "table";

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: design.colors.bg.primary }}>
      <TabBar
        actions={isTable ? <ExportMenu /> : <DocExportMenu />}
      />
      <div className="flex-1 overflow-hidden relative">
        {/* Keep both mounted to preserve state, toggle visibility */}
        <div className={`h-full ${isTable ? "" : "hidden"}`}>
          <SheetPanel />
        </div>
        <div className={`h-full ${!isTable ? "" : "hidden"}`}>
          <DocPanel />
        </div>
      </div>
    </div>
  );
}
