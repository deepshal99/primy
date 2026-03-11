"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Code2, Eye, Download, Maximize2, Minimize2, ChevronDown, Image, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

interface DiagramToolbarProps {
  showSource: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

async function captureDiagramToCanvas(scale: number = 2): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  const svgEl = document.querySelector(".diagram-render-area svg") as SVGSVGElement | null;
  if (!svgEl) throw new Error("No diagram SVG found");

  // Get the SVG's natural dimensions from viewBox
  const vb = svgEl.getAttribute("viewBox");
  const parts = vb?.split(/[\s,]+/).map(Number);
  let w: number, h: number;
  if (parts && parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
    w = parts[2];
    h = parts[3];
  } else {
    const bbox = svgEl.getBBox();
    w = bbox.width || svgEl.clientWidth || 800;
    h = bbox.height || svgEl.clientHeight || 600;
  }

  // Clone SVG into an offscreen container at full native size
  const offscreen = document.createElement("div");
  offscreen.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px;background:#fff;overflow:visible;z-index:-1;`;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;
  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  try {
    return await html2canvas(offscreen, {
      scale,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false,
      width: w,
      height: h,
    });
  } finally {
    document.body.removeChild(offscreen);
  }
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
        const canvas = await captureDiagramToCanvas();
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
    <div className="flex items-center justify-between px-4 border-b border-[#e8e7e4] flex-shrink-0 h-10 bg-white">
      {/* Left: type label */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#95928E]">
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
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium t-colors text-[#6b6b80] hover:bg-[#efeee9] ${exportMenuOpen ? "bg-[#efeee9]" : ""}`}
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>

          {exportMenuOpen && (
            <div className="absolute top-full right-0 mt-1 border border-[#e8e8ed] rounded-xl py-1 min-w-[150px] z-50 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => exportAs("svg")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left t-colors text-[#1a1a2e] hover:bg-[#efeee9]"
              >
                <FileCode2 className="w-3.5 h-3.5 text-[#95928E]" />
                Export SVG
              </button>
              <button
                onClick={() => exportAs("png")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left t-colors text-[#1a1a2e] hover:bg-[#efeee9]"
              >
                <Image className="w-3.5 h-3.5 text-[#95928E]" />
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
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium t-colors active:scale-95 ${
        active
          ? "text-[#ff4a00] bg-[rgba(255,74,0,0.06)]"
          : "text-[#6b6b80] hover:bg-[#efeee9]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
