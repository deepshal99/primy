"use client";

import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { ProjectHome } from "./ProjectHome";
import { ExportMenu } from "@/components/sheet/ExportMenu";
import { DocExportMenu } from "@/components/doc/DocExportMenu";
import { DeckExport } from "./EntityActions";
import { EditorErrorBoundary } from "./EditorErrorBoundary";
import { ArtifactHistoryButton } from "@/components/snapshots/ArtifactHistoryButton";

const SheetPanel = dynamic(
  () => import("@/components/sheet/SheetPanel").then((m) => ({ default: m.SheetPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const DocPanel = dynamic(
  () => import("@/components/doc/DocPanel").then((m) => ({ default: m.DocPanel })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const DeckBuilder = dynamic(
  () => import("@/components/deck/DeckBuilder").then((m) => ({ default: m.DeckBuilder })),
  { ssr: false, loading: () => <PanelSkeleton /> }
);
const PagePanel = dynamic(
  () => import("@/components/page/PagePanel").then((m) => ({ default: m.PagePanel })),
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

/**
 * WorkspacePanel — the work-pane interior for a project that's open.
 *
 * The tab row is gone (the TopBar breadcrumb's `File ▾` replaces it). This
 * renders inside the floating work-pane card created by AppShell:
 *   - no entity open  → the project home (overview + files grid)
 *   - entity open     → a slim entity toolbar (export + history; pages carry
 *                       their own Preview/HTML/Present toolbar) + the editor.
 *
 * Undo/redo/save/share now live in the TopBar — only export and version
 * history remain here, scoped to the active editor.
 */
export function WorkspacePanel() {
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  // No entity open → the project's home view (overview + files grid).
  if (!currentEntityId) {
    return (
      <div className="h-full overflow-hidden">
        <ProjectHome />
      </div>
    );
  }

  const isTable = currentEntityType === "table";
  const isDeck = currentEntityType === "deck";
  const isPage = currentEntityType === "page";

  const renderPanel = () => {
    if (isDeck) return <EditorErrorBoundary entityType="presentation"><DeckBuilder /></EditorErrorBoundary>;
    if (isTable) return <EditorErrorBoundary entityType="spreadsheet"><SheetPanel /></EditorErrorBoundary>;
    if (isPage) return <EditorErrorBoundary entityType="document"><PagePanel /></EditorErrorBoundary>;
    return <EditorErrorBoundary entityType="document"><DocPanel /></EditorErrorBoundary>;
  };

  // Pages own their toolbar (Preview/HTML/Present) inside PagePanel — no slim
  // toolbar above them. Other entities get a slim export + history toolbar.
  const exportEl = isDeck ? <DeckExport /> : isTable ? <ExportMenu /> : <DocExportMenu />;
  const showToolbar = !isPage;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showToolbar && (
        <div className="flex items-center justify-end gap-0.5 px-2.5 h-[40px] border-b border-[#f0efec] bg-white flex-shrink-0">
          <ArtifactHistoryButton />
          {exportEl}
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {renderPanel()}
      </div>
    </div>
  );
}
