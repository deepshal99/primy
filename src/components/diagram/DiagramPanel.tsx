"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { DiagramView } from "./DiagramView";
import { DiagramToolbar } from "./DiagramToolbar";

export function DiagramPanel() {
  const [showSource, setShowSource] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
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
    <div className={`flex flex-col h-full ${fullscreen ? "fixed inset-0 z-50" : ""}`} style={{ backgroundColor: design.colors.bg.primary }}>
      <DiagramToolbar
        showSource={showSource}
        onToggleSource={() => setShowSource(!showSource)}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen(!fullscreen)}
      />
      <div className="flex-1 overflow-hidden flex">
        {/* Diagram render area */}
        <div className={`flex-1 overflow-auto diagram-render-area ${showSource && diagramType !== "excalidraw" ? "border-r" : ""}`} style={{ borderColor: design.colors.border.default }}>
          <DiagramView />
        </div>

        {/* Source editor panel (not for excalidraw — it has its own UI) */}
        {showSource && diagramType !== "excalidraw" && (
          <div className="w-[400px] flex-shrink-0 flex flex-col" style={{ backgroundColor: design.colors.bg.elevated }}>
            <div
              className="px-3 py-2 border-b flex items-center"
              style={{ borderColor: design.colors.border.default }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: design.colors.text.muted }}
              >
                Source Editor
              </span>
            </div>
            <textarea
              value={diagramSource}
              onChange={handleSourceChange}
              className="flex-1 w-full p-4 resize-none outline-none font-mono text-[13px] leading-relaxed"
              style={{
                backgroundColor: design.colors.bg.elevated,
                color: design.colors.text.primary,
                border: "none",
              }}
              spellCheck={false}
              placeholder="Enter diagram source..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
