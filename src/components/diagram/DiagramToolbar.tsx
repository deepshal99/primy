"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Code2, Eye, Download, Maximize2, Minimize2, ChevronDown, Image, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

interface DiagramToolbarProps {
  showSource: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

function svgToCanvas(svgEl: Element, scale: number = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      // White background for PNG
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to canvas"));
    };
    img.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const exportAs = useCallback(async (format: "svg" | "png") => {
    if (exporting) return;
    setExporting(true);
    setExportMenuOpen(false);

    try {
      const svgEl = document.querySelector(".diagram-render-area svg");
      if (!svgEl) {
        toast.error("No diagram to export");
        return;
      }

      if (format === "svg") {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        downloadBlob(blob, `diagram.svg`);
        toast.success("Exported as SVG");
      } else {
        const canvas = await svgToCanvas(svgEl);
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `diagram.png`);
            toast.success("Exported as PNG");
          }
        }, "image/png");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

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
          {diagramType === "mermaid" ? "Diagram" : "Chart"}
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

        {/* Export dropdown */}
        <div ref={exportMenuRef} className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              color: design.colors.text.secondary,
              backgroundColor: exportMenuOpen ? design.colors.bg.hover : "transparent",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
            onMouseLeave={(e) => { if (!exportMenuOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>

          {exportMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1 border rounded-xl py-1 min-w-[150px] z-50"
              style={{
                backgroundColor: design.colors.bg.elevated,
                borderColor: design.colors.border.default,
                boxShadow: design.shadows.dropdown,
              }}
            >
              <button
                onClick={() => exportAs("svg")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors"
                style={{ color: design.colors.text.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <FileCode2 className="w-3.5 h-3.5" style={{ color: design.colors.text.muted }} />
                Export SVG
              </button>
              <button
                onClick={() => exportAs("png")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors"
                style={{ color: design.colors.text.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Image className="w-3.5 h-3.5" style={{ color: design.colors.text.muted }} />
                Export PNG
              </button>
            </div>
          )}
        </div>

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
