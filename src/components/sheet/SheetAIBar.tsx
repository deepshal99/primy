"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Wand2, Loader2, ArrowUp, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import { getWorkbookApi } from "./SheetView";

const QUICK_ACTIONS = [
  { label: "Summarize", prompt: "Summarize each row's content into a concise summary and add it as a new column" },
  { label: "Categorize", prompt: "Add a new column that categorizes each row based on its content" },
  { label: "Translate", prompt: "Translate the text content to Spanish and add as new columns" },
  { label: "Fill gaps", prompt: "Identify missing or empty cells and fill them with reasonable values based on context" },
  { label: "Clean up", prompt: "Clean and standardize the data: fix formatting, trim whitespace, correct obvious typos" },
];

function getSelectedCellsInfo(): { rangeLabel: string; cellValues: string } | null {
  try {
    const api = getWorkbookApi();
    if (!api) return null;

    const workbook = api.getActiveWorkbook?.();
    if (!workbook) return null;
    const sheet = workbook.getActiveSheet?.();
    if (!sheet) return null;
    const selection = sheet.getSelection?.();
    if (!selection) return null;
    const activeRange = selection.getActiveRange?.();
    if (!activeRange) return null;

    const r1 = activeRange.getRow();
    const c1 = activeRange.getColumn();
    const numRows = activeRange.getHeight?.() || 1;
    const numCols = activeRange.getWidth?.() || 1;
    const r2 = r1 + numRows - 1;
    const c2 = c1 + numCols - 1;

    if (r1 === r2 && c1 === c2) return null;

    const rangeLabel = `${colLetter(c1)}${r1 + 1}:${colLetter(c2)}${r2 + 1}`;

    // Read values straight from the LIVE Univer range. The store copy is
    // debounced (up to 800ms stale), and `status === 1` always resolves to
    // sheet 0 (the writer hardcodes status by index), so a selection on any
    // non-first sheet, or one edited within the debounce window, read wrong.
    const values = activeRange.getValues?.();
    if (!Array.isArray(values)) return null;
    const cellValues = values
      .map((row: any[]) =>
        row
          .map((v) => (v && typeof v === "object" ? (v.v ?? v.f ?? "") : (v ?? "")))
          .map((v) => String(v))
          .join("\t")
      )
      .join("\n");
    return { rangeLabel, cellValues };
  } catch {
    return null;
  }
}

function colLetter(c: number): string {
  let result = "";
  let col = c;
  while (col >= 0) {
    result = String.fromCharCode((col % 26) + 65) + result;
    col = Math.floor(col / 26) - 1;
  }
  return result;
}

export function SheetAIBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState<{ rangeLabel: string; cellValues: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sheets = useAppStore((s) => s.sheets);
  const isStreaming = useAppStore((s) => s.isStreaming);

  const hasData = sheets.some((s) => s.celldata && s.celldata.length > 0);

  useEffect(() => {
    if (isOpen) {
      const info = getSelectedCellsInfo();
      setSelectionInfo(info);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const executeAIAction = useCallback(
    async (actionPrompt: string) => {
      if (!actionPrompt.trim() || isStreaming) return;
      setIsLoading(true);

      let fullPrompt: string;
      if (selectionInfo) {
        fullPrompt = `For the selected cells ${selectionInfo.rangeLabel} in the current spreadsheet, the selected data is:\n${selectionInfo.cellValues}\n\nPerform the following action on these cells: ${actionPrompt.trim()}. Use UPDATE_CELLS to modify cells. Keep other data intact.`;
      } else {
        fullPrompt = `For the current spreadsheet data, perform the following action on ALL rows: ${actionPrompt.trim()}. Use UPDATE_CELLS to add/modify cells. Keep existing data intact and add new columns as needed.`;
      }

      window.dispatchEvent(
        new CustomEvent("primy:send-message", {
          detail: { content: fullPrompt },
        })
      );

      setIsLoading(false);
      setIsOpen(false);
      setPrompt("");
      setSelectionInfo(null);
    },
    [isStreaming, selectionInfo]
  );

  if (!hasData) return null;

  return (
    <div className="absolute bottom-4 right-4 z-40">
      <style>{`
        @keyframes slideDownFadeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* Expanded bar */}
      {isOpen && (
        <div
          className="mb-2 w-[300px] rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          style={{
            animation: "slideDownFadeIn 200ms ease-out both",
          }}
        >
          {/* Selection indicator */}
          {selectionInfo && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-cyan-50/50">
              <Grid3X3 className="w-3 h-3 text-cyan-500" strokeWidth={2} />
              <span className="text-[10px] font-medium text-cyan-600">
                Selected: {selectionInfo.rangeLabel}
              </span>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 p-2.5">
            <Wand2 className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={selectionInfo ? "What to do with selected cells?" : "What should AI do with this data?"}
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.trim()) executeAIAction(prompt);
                if (e.key === "Escape") setIsOpen(false);
              }}
            />
            <button
              onClick={() => prompt.trim() && executeAIAction(prompt)}
              disabled={!prompt.trim() || isLoading}
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-30",
                prompt.trim()
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" strokeWidth={2.5} />}
            </button>
          </div>

          {/* Quick action chips */}
          <div className="flex flex-wrap gap-1 px-2.5 pb-2.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => executeAIAction(action.prompt)}
                disabled={isLoading || isStreaming}
                className="px-2 py-1 rounded-md text-[10px] font-medium t-fast disabled:opacity-50 bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAB trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full flex items-center justify-center t-normal hover:scale-110 active:scale-[0.95] bg-amber-500 text-white shadow-md hover:shadow-lg"
        title="AI actions on sheet data"
      >
        <Wand2 className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}
