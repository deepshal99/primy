"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";
import { DiagramExport, DiagramToolbar, DeckExport } from "./EntityActions";

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
const DeckPanel = dynamic(
  () => import("@/components/deck/DeckPanel").then((m) => ({ default: m.DeckPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

function PanelSkeleton() {
  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-[44px] h-[44px] rounded-xl bg-[#fafaf8] border border-[#e8e7e4] flex flex-col items-start justify-center gap-[4px] px-2.5">
          <div className="content-loader-line bg-[#ff4a00]/50" style={{ width: "80%" }} />
          <div className="content-loader-line bg-[#ff4a00]/35" style={{ width: "60%" }} />
          <div className="content-loader-line bg-[#ff4a00]/25" style={{ width: "85%" }} />
          <div className="content-loader-line bg-[#ff4a00]/15" style={{ width: "45%" }} />
        </div>
        <span className="text-[12px] text-muted-foreground">Loading editor...</span>
      </div>
    </div>
  );
}

export function WorkspacePanel() {
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  // Diagram state lifted from DiagramPanel
  const [diagramShowSource, setDiagramShowSource] = useState(false);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);

  if (!currentEntityId) {
    return (
      <div className="flex flex-col h-full bg-background">
        <ProjectHome />
      </div>
    );
  }

  const isDiagram = currentEntityType === "diagram";
  const isTable = currentEntityType === "table";
  const isDeck = currentEntityType === "deck";

  const renderPanel = () => {
    if (isDeck) return <DeckPanel />;
    if (isDiagram) return <DiagramPanel showSource={diagramShowSource} fullscreen={diagramFullscreen} />;
    if (isTable) return <SheetPanel />;
    return <DocPanel />;
  };

  const renderExportAction = () => {
    if (isDeck) return <DeckExport />;
    if (isDiagram) return <DiagramExport />;
    if (isTable) return <ExportMenu />;
    return <DocExportMenu />;
  };

  const renderToolbarActions = () => {
    if (isDiagram) {
      return (
        <DiagramToolbar
          showSource={diagramShowSource}
          onToggleSource={() => setDiagramShowSource((v) => !v)}
          fullscreen={diagramFullscreen}
          onToggleFullscreen={() => setDiagramFullscreen((v) => !v)}
        />
      );
    }
    return null;
  };

  const toolbarActions = renderToolbarActions();

  return (
    <div className="flex flex-col h-full bg-background">
      <TabBar exportAction={renderExportAction()} />
      {toolbarActions && (
        <div className="flex items-center gap-1 px-3 h-[40px] border-b border-[#e8e7e4] bg-[#fafaf9] flex-shrink-0">
          {toolbarActions}
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {renderPanel()}
      </div>
    </div>
  );
}
