"use client";

import { Download, FileDown, FileType } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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

