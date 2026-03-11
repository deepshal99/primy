"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { TabBar } from "./TabBar";
import { ProjectHome } from "./ProjectHome";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";
import { DiagramExport, DiagramToolbar, DeckExport } from "./EntityActions";
import { EditorErrorBoundary } from "./EditorErrorBoundary";

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
const DeckBuilder = dynamic(
  () => import("@/components/deck/DeckBuilder").then((m) => ({ default: m.DeckBuilder })),
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
  const openTabs = useAppStore((s) => s.openTabs);

  // Diagram state lifted from DiagramPanel
  const [diagramShowSource, setDiagramShowSource] = useState(false);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);

  // Home tab is always first; entity tabs follow. First tab active = home or first entity tab
  const isHomeActive = !currentEntityId;
  const isFirstTabActive = isHomeActive || openTabs.findIndex((t) => t.id === currentEntityId) === 0;

  if (!currentEntityId) {
    // No open tabs: clean white card, no tab bar
    if (openTabs.length === 0) {
      return (
        <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.03)]">
          <ProjectHome />
        </div>
      );
    }
    // Has open tabs: show tab bar with home tab active
    return (
      <div className="flex flex-col h-full">
        <TabBar exportAction={null} />
        <div
          className="flex-1 overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.03)]"
          style={{ borderRadius: "0 12px 12px 12px" }}
        >
          <ProjectHome />
        </div>
      </div>
    );
  }

  const isDiagram = currentEntityType === "diagram";
  const isTable = currentEntityType === "table";
  const isDeck = currentEntityType === "deck";

  const renderPanel = () => {
    if (isDeck) return <EditorErrorBoundary entityType="presentation"><DeckBuilder /></EditorErrorBoundary>;
    if (isDiagram) return <EditorErrorBoundary entityType="diagram"><DiagramPanel showSource={diagramShowSource} fullscreen={diagramFullscreen} /></EditorErrorBoundary>;
    if (isTable) return <EditorErrorBoundary entityType="spreadsheet"><SheetPanel /></EditorErrorBoundary>;
    return <EditorErrorBoundary entityType="document"><DocPanel /></EditorErrorBoundary>;
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

  // Content area border-radius: when home (first tab) is active, top-left is flush (0)
  const contentRadius = isHomeActive
    ? "0 12px 12px 12px"
    : "12px";

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — sits in the beige background area */}
      <TabBar exportAction={renderExportAction()} />

      {/* Content — white card that merges with active tab */}
      <div
        className="flex-1 flex flex-col overflow-hidden bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.03)]"
        style={{ borderRadius: contentRadius }}
      >
        {toolbarActions && (
          <div className="flex items-center gap-1 px-3 h-[40px] border-b border-[#f0efec] bg-white flex-shrink-0">
            {toolbarActions}
          </div>
        )}
        <div className="flex-1 overflow-hidden relative">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}
