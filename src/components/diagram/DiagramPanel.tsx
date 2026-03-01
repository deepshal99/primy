"use client";

import { useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { DiagramView } from "./DiagramView";
import { cn } from "@/lib/cn";

interface DiagramPanelProps {
  showSource: boolean;
  fullscreen: boolean;
}

export function DiagramPanel({ showSource, fullscreen }: DiagramPanelProps) {
  const diagramSource = useAppStore((s) => s.diagramSource);
  const diagramType = useAppStore((s) => s.diagramType);
  const updateDiagramSource = useAppStore((s) => s.updateDiagramSource);

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateDiagramSource(e.target.value);
    },
    [updateDiagramSource]
  );

  return (
    <div className={cn("flex flex-col h-full bg-background", fullscreen && "fixed inset-0 z-50")}>
      <div className="flex-1 overflow-hidden flex">
        {/* Diagram render area */}
        <div className={cn(
          "flex-1 overflow-auto diagram-render-area",
          showSource && diagramType !== "excalidraw" && "border-r border-border"
        )}>
          <DiagramView />
        </div>

        {/* Source editor panel (not for excalidraw) */}
        {showSource && diagramType !== "excalidraw" && (
          <div className="w-[400px] flex-shrink-0 flex flex-col bg-card">
            <div className="px-3 py-2 border-b border-border flex items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source Editor
              </span>
            </div>
            <textarea
              value={diagramSource}
              onChange={handleSourceChange}
              className="flex-1 w-full p-4 resize-none outline-none font-mono text-[13px] leading-relaxed bg-card text-foreground border-none"
              spellCheck={false}
              placeholder="Enter diagram source..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
