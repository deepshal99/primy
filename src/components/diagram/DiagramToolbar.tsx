"use client";

import { useState, useCallback } from "react";
import { Code2, Eye, Download, Maximize2, Minimize2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

interface DiagramToolbarProps {
  showSource: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function DiagramToolbar({
  showSource,
  onToggleSource,
  fullscreen,
  onToggleFullscreen,
}: DiagramToolbarProps) {
  const diagramType = useAppStore((s) => s.diagramType);
  const diagramSource = useAppStore((s) => s.diagramSource);
  const [exporting, setExporting] = useState(false);

  const exportDiagram = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      if (diagramType === "mermaid") {
        // Export SVG from the rendered mermaid output
        const svgEl = document.querySelector(".diagram-render-area svg");
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const blob = new Blob([svgData], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "diagram.svg";
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        // For charts, export the source JSON
        const blob = new Blob([diagramSource], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "chart-config.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  }, [diagramType, diagramSource, exporting]);

  return (
    <div
      className="flex items-center justify-between px-4 border-b flex-shrink-0"
      style={{
        height: "40px",
        borderColor: design.colors.border.default,
        backgroundColor: design.colors.bg.elevated,
      }}
    >
      {/* Left: type label */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: design.colors.text.muted }}
        >
          {diagramType === "mermaid" ? "Mermaid Diagram" : "Data Chart"}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={showSource ? <Eye className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
          label={showSource ? "Preview" : "Source"}
          onClick={onToggleSource}
          active={showSource}
        />
        <ToolbarButton
          icon={<Download className="w-3.5 h-3.5" />}
          label="Export"
          onClick={exportDiagram}
        />
        <ToolbarButton
          icon={fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          label={fullscreen ? "Exit" : "Fullscreen"}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
      style={{
        color: active ? design.colors.brand.primary : design.colors.text.secondary,
        backgroundColor: active ? design.colors.brand.subtle : "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = design.colors.bg.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = active ? design.colors.brand.subtle : "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}
