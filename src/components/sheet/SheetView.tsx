"use client";

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import "@fortune-sheet/react/dist/index.css";
import { useAppStore } from "@/lib/store";
import { Table2 } from "lucide-react";
import { design } from "@/lib/design";
import { SheetAIBar } from "./SheetAIBar";

const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
);

// Store workbook ref globally so SheetAIBar can access selection
let workbookRef: any = null;
export function getWorkbookApi() {
  return workbookRef;
}

// Debounce timer for saving sheet changes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function SheetView() {
  const sheets = useAppStore((s) => s.sheets);
  const sheetVersion = useAppStore((s) => s.sheetVersion);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const isUpdatingRef = useRef(false);
  const wbRef = useRef<any>(null);

  const handleChange = useCallback((data: any) => {
    if (isUpdatingRef.current) return;
    // Debounce: persist manual edits to store after 300ms of inactivity
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      useAppStore.getState().updateSheetData(data);
    }, 300);
  }, []);

  const handleRef = useCallback((ref: any) => {
    wbRef.current = ref;
    workbookRef = ref;
  }, []);

  const prevVersionRef = useRef(sheetVersion);
  if (sheetVersion !== prevVersionRef.current) {
    isUpdatingRef.current = true;
    prevVersionRef.current = sheetVersion;
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 500);
  }

  const hasData = sheets.some((s) => s.celldata && s.celldata.length > 0);

  return (
    <div className="w-full h-full relative">
      {!hasData && !isStreaming && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: design.colors.accent.goldSubtle }}
            >
              <Table2
                className="w-6 h-6"
                style={{ color: design.colors.accent.gold }}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <p className="text-heading-sm mb-1" style={{ color: design.colors.text.secondary }}>
                Your spreadsheet will appear here
              </p>
              <p className="text-ui-sm max-w-[280px]" style={{ color: design.colors.text.muted, fontWeight: 400 }}>
                Ask the AI to create a tracker, budget, comparison table, or any structured data
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full h-full" key={`sheet-v${sheetVersion}`}>
        <Workbook
          ref={handleRef}
          data={sheets as any}
          onChange={handleChange}
          showToolbar
          showFormulaBar
          showSheetTabs
        />
      </div>

      <SheetAIBar />

      {isStreaming && <StreamingBar />}
    </div>
  );
}

function StreamingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="h-[2px] w-full overflow-hidden" style={{ backgroundColor: design.colors.accent.goldSubtle }}>
        <div
          className="h-full animate-progress-bar"
          style={{ backgroundColor: design.colors.accent.gold }}
        />
      </div>
    </div>
  );
}
