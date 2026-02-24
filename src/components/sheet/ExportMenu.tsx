"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, FileSpreadsheet, Copy, ChevronDown, Check, Sheet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { sheetToCSV, sheetToTSV } from "@/lib/sheet/exportCSV";
import { toast } from "sonner";

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sheets = useAppStore((s) => s.sheets);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeSheet = sheets.find((s) => s.status === 1) || sheets[0];
  const hasData = (activeSheet?.celldata?.length ?? 0) > 0;

  const downloadCSV = useCallback(() => {
    if (!activeSheet) return;
    const csv = sheetToCSV(activeSheet);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSheet.name || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
    toast.success("Downloaded CSV");
  }, [activeSheet]);

  const downloadXLSX = useCallback(async () => {
    if (!activeSheet) return;
    const XLSX = (await import("xlsx")).default;

    // Convert celldata to 2D array
    const maxRow = Math.max(...activeSheet.celldata.map((c) => c.r), 0);
    const maxCol = Math.max(...activeSheet.celldata.map((c) => c.c), 0);
    const data: (string | number | undefined)[][] = [];

    for (let r = 0; r <= maxRow; r++) {
      const row: (string | number | undefined)[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = activeSheet.celldata.find((cd) => cd.r === r && cd.c === c);
        row.push(cell?.v?.v ?? undefined);
      }
      data.push(row);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Apply column widths if available
    if (activeSheet.config?.columnlen) {
      ws["!cols"] = [];
      for (const [col, width] of Object.entries(activeSheet.config.columnlen)) {
        const colNum = parseInt(col);
        if (!ws["!cols"]![colNum]) ws["!cols"]![colNum] = {};
        ws["!cols"]![colNum].wpx = width;
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, activeSheet.name || "Sheet1");
    XLSX.writeFile(wb, `${activeSheet.name || "sheet"}.xlsx`);
    setOpen(false);
    toast.success("Downloaded Excel file");
  }, [activeSheet]);

  const copyToClipboard = useCallback(async () => {
    if (!activeSheet) return;
    const tsv = sheetToTSV(activeSheet);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setOpen(false);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [activeSheet]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!hasData}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
          hasData
            ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
        }`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {copied ? "Copied!" : "Export"}
        {!copied && <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
          <button
            onClick={downloadXLSX}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Sheet className="w-4 h-4 text-emerald-600" />
            Download Excel
          </button>
          <div className="mx-3 border-t border-[var(--color-border)]" />
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--color-text-muted)]" />
            Download CSV
          </button>
          <div className="mx-3 border-t border-[var(--color-border)]" />
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
