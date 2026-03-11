"use client";

import { useState, useCallback } from "react";
import { Code2, Eye, Maximize2, Minimize2, Download, Copy, FileCode2, Image, FileDown, FileType } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ═══ Shared button style ═══

function ActionButton({
  icon,
  label,
  onClick,
  active,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`w-[36px] h-[36px] flex items-center justify-center rounded-lg t-fast active:scale-[0.95] cursor-pointer ${
            active
              ? "text-[#ff4a00] bg-[#fff3ee]"
              : "text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9]"
          } ${className || ""}`}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ═══ Diagram helpers ═══

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

// ═══ DiagramExport (for TabBar) ═══

export function DiagramExport() {
  const [exporting, setExporting] = useState(false);

  const exportAs = useCallback(async (format: "svg" | "png" | "clipboard") => {
    if (exporting) return;
    setExporting(true);
    try {
      const svgEl = document.querySelector(".diagram-render-area svg");
      if (!svgEl) {
        toast.error("No diagram to export");
        return;
      }

      if (format === "svg") {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        downloadBlob(blob, "diagram.svg");
        toast.success("Exported as SVG");
      } else if (format === "png") {
        const canvas = await captureDiagramToCanvas();
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, "diagram.png");
            toast.success("Exported as PNG");
          }
        }, "image/png");
      } else {
        const canvas = await captureDiagramToCanvas();
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
              toast.success("Copied to clipboard");
            } catch {
              toast.error("Failed to copy — browser may not support clipboard images");
            }
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] active:scale-[0.95] t-fast cursor-pointer" aria-label="Export diagram">
          <Download className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => exportAs("svg")}>
          <FileCode2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Export SVG</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAs("png")}>
          <Image className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Export PNG</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportAs("clipboard")}>
          <Copy className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Copy to clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ═══ DiagramToolbar (for action bar) ═══

interface DiagramToolbarProps {
  showSource: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function DiagramToolbar({ showSource, onToggleSource, fullscreen, onToggleFullscreen }: DiagramToolbarProps) {
  return (
    <>
      <ActionButton
        icon={showSource ? <Eye className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
        label={showSource ? "Preview" : "Source"}
        onClick={onToggleSource}
        active={showSource}
      />
      <ActionButton
        icon={fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={onToggleFullscreen}
      />
    </>
  );
}

// ═══ DeckExport (for TabBar) ═══

export function DeckExport() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);

  const handleExport = async (format: "pdf" | "pptx") => {
    const { exportDeckToPDF, exportDeckToPPTX } = await import("@/components/deck/deckExport");
    if (format === "pdf") exportDeckToPDF(slides, theme);
    else exportDeckToPPTX(slides, theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] active:scale-[0.95] t-fast cursor-pointer" aria-label="Export presentation">
          <Download className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileDown className="w-4 h-4 text-red-500" />
          <span className="text-[13px]">Export PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pptx")}>
          <FileType className="w-4 h-4 text-blue-500" />
          <span className="text-[13px]">Export PPTX</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

