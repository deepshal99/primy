"use client";

import { useCallback } from "react";
import { Download, FileSpreadsheet, Copy, Sheet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { sheetToCSV, sheetToTSV } from "@/lib/sheet/exportCSV";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function getEntityTitle(): string {
  const state = useAppStore.getState();
  if (state.currentEntityId && state.currentProjectId) {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (project) {
      const table = project.tables.find((t) => t.id === state.currentEntityId);
      if (table) return table.title.replace(/[/\\?%*:|"<>]/g, "_") || "sheet";
    }
  }
  return "sheet";
}

export function ExportMenu() {
  const sheets = useAppStore((s) => s.sheets);
  const activeSheet = sheets.find((s) => s.status === 1) || sheets[0];
  const hasData = (activeSheet?.celldata?.length ?? 0) > 0;

  const downloadCSV = useCallback(() => {
    if (!activeSheet) return;
    const csv = sheetToCSV(activeSheet);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getEntityTitle()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV");
  }, [activeSheet]);

  const downloadXLSX = useCallback(async () => {
    if (!activeSheet) return;
    try {
      const XLSX = (await import("xlsx")).default;

      const celldata = activeSheet.celldata || [];
      let maxRow = 0;
      let maxCol = 0;
      for (const c of celldata) {
        if (c.r > maxRow) maxRow = c.r;
        if (c.c > maxCol) maxCol = c.c;
      }

      const cellMap = new Map<string, typeof celldata[0]>();
      for (const cd of celldata) {
        cellMap.set(`${cd.r},${cd.c}`, cd);
      }

      const data: (string | number | undefined)[][] = [];
      for (let r = 0; r <= maxRow; r++) {
        const row: (string | number | undefined)[] = [];
        for (let c = 0; c <= maxCol; c++) {
          const cell = cellMap.get(`${r},${c}`);
          row.push(cell?.v?.v ?? undefined);
        }
        data.push(row);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);

      if (activeSheet.config?.columnlen) {
        ws["!cols"] = [];
        for (const [col, width] of Object.entries(activeSheet.config.columnlen)) {
          const colNum = parseInt(col);
          if (!ws["!cols"]![colNum]) ws["!cols"]![colNum] = {};
          ws["!cols"]![colNum].wpx = width;
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, activeSheet.name || "Sheet1");
      XLSX.writeFile(wb, `${getEntityTitle()}.xlsx`);
      toast.success("Downloaded Excel file");
    } catch {
      toast.error("Excel export failed. Please try again");
    }
  }, [activeSheet]);

  const copyToClipboard = useCallback(async () => {
    if (!activeSheet) return;
    try {
      const tsv = sheetToTSV(activeSheet);
      await navigator.clipboard.writeText(tsv);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }, [activeSheet]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={!hasData}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-lg transition-colors text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Export spreadsheet"
        >
          <Download className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={downloadXLSX} className="transition-transform duration-150 hover:translate-x-0.5">
          <Sheet className="w-4 h-4 text-emerald-600" />
          <span className="text-[13px]">Download Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCSV} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Download CSV</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard} className="transition-transform duration-150 hover:translate-x-0.5">
          <Copy className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Copy to clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
