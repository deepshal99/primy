"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Wand2, Loader2, ArrowUp, Grid3X3 } from "lucide-react";
import { design } from "@/lib/design";
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

    const selection = api.getSelection?.();
    if (!selection || selection.length === 0) return null;

    const sel = selection[0];
    const [r1, r2] = sel.row;
    const [c1, c2] = sel.column;

    // Skip if it's just a single cell (not a meaningful selection)
    if (r1 === r2 && c1 === c2) return null;

    const rangeLabel = `${colLetter(c1)}${r1 + 1}:${colLetter(c2)}${r2 + 1}`;

    // Get cell values from the store directly
    const sheets = useAppStore.getState().sheets;
    const activeSheet = sheets.find((s: any) => s.status === 1) || sheets[0];
    if (!activeSheet?.celldata) return null;

    const rows: string[][] = [];
    for (let r = r1; r <= r2; r++) {
      const row: string[] = [];
      for (let c = c1; c <= c2; c++) {
        const cell = activeSheet.celldata.find((cd) => cd.r === r && cd.c === c);
        row.push(cell?.v?.v?.toString() || cell?.v?.f || "");
      }
      rows.push(row);
    }

    const cellValues = rows.map((row) => row.join("\t")).join("\n");
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
      // Read selection when opening
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
        new CustomEvent("drafta:send-message", {
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
      {/* Expanded bar */}
      {isOpen && (
        <div
          className="mb-2 w-[300px] rounded-xl border animate-scale-in overflow-hidden"
          style={{
            backgroundColor: design.colors.bg.elevated,
            borderColor: design.colors.border.default,
            boxShadow: design.shadows.xl,
          }}
        >
          {/* Selection indicator */}
          {selectionInfo && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 border-b"
              style={{
                backgroundColor: design.colors.accent.tealSubtle,
                borderColor: design.colors.border.light,
              }}
            >
              <Grid3X3 className="w-3 h-3" style={{ color: design.colors.accent.teal }} strokeWidth={2} />
              <span className="text-[10px] font-medium" style={{ color: design.colors.accent.teal }}>
                Selected: {selectionInfo.rangeLabel}
              </span>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 p-2.5">
            <Wand2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.accent.gold }} strokeWidth={2} />
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={selectionInfo ? "What to do with selected cells?" : "What should AI do with this data?"}
              className="flex-1 text-[12px] bg-transparent outline-none"
              style={{ color: design.colors.text.primary }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.trim()) executeAIAction(prompt);
                if (e.key === "Escape") setIsOpen(false);
              }}
            />
            <button
              onClick={() => prompt.trim() && executeAIAction(prompt)}
              disabled={!prompt.trim() || isLoading}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-30"
              style={{
                backgroundColor: prompt.trim() ? design.colors.brand.primary : design.colors.bg.secondary,
                color: prompt.trim() ? design.colors.brand.text : design.colors.text.muted,
              }}
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
                className="px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-150 disabled:opacity-50"
                style={{
                  backgroundColor: design.colors.bg.secondary,
                  color: design.colors.text.secondary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = design.colors.accent.goldSubtle;
                  e.currentTarget.style.color = design.colors.accent.gold;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = design.colors.bg.secondary;
                  e.currentTarget.style.color = design.colors.text.secondary;
                }}
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
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: design.colors.accent.gold,
          color: "#ffffff",
          boxShadow: "0 2px 8px rgba(229, 149, 62, 0.25)",
        }}
        title="AI actions on sheet data"
      >
        <Wand2 className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}
