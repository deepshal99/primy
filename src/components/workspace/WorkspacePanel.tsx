"use client";

import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";

// Lazy-load heavy editor panels — they pull in Fortune Sheet, Tiptap, Mermaid, Recharts
const SheetPanel = dynamic(
  () => import("@/components/sheet/SheetPanel").then((m) => ({ default: m.SheetPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const DocPanel = dynamic(
  () => import("@/components/doc/DocPanel").then((m) => ({ default: m.DocPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const DiagramPanel = dynamic(
  () => import("@/components/diagram/DiagramPanel").then((m) => ({ default: m.DiagramPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

function PanelSkeleton() {
  return (
    <div className="h-full flex items-center justify-center" style={{ backgroundColor: design.colors.bg.primary }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin-slow"
          style={{ borderColor: design.colors.border.default, borderTopColor: "transparent" }}
        />
        <span className="text-[12px]" style={{ color: design.colors.text.muted }}>Loading editor...</span>
      </div>
    </div>
  );
}

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
