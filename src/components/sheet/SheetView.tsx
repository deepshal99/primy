"use client";

import { useRef, useCallback, useEffect } from "react";
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
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const isUpdatingRef = useRef(false);
  const wbRef = useRef<any>(null);
  const hadDataRef = useRef(false);

  const handleChange = useCallback((data: any) => {
    if (isUpdatingRef.current) return;
    // Guard: don't write sheet data when a doc (KU) is the active entity
    if (useAppStore.getState().currentEntityType !== "table" && useAppStore.getState().currentEntityType !== null) return;
    // Guard: validate data is a non-empty array of sheet objects with celldata
    if (!Array.isArray(data) || data.length === 0) return;
    // Ensure every sheet has celldata array (Fortune Sheet may return undefined/null)
    const sanitized = data.map((s: any) => ({
      ...s,
      celldata: Array.isArray(s.celldata) ? s.celldata : [],
    }));
    // Guard: don't write back if all sheets have empty celldata (likely a transient render glitch)
    const hasAnyData = sanitized.some((s: any) => s.celldata.length > 0);
    const storeSheets = useAppStore.getState().sheets;
    const storeHasData = storeSheets.some((s) => s.celldata && s.celldata.length > 0);
    if (storeHasData && !hasAnyData) return; // Prevent blanking out existing data
    // Debounce: persist manual edits to store after 800ms of inactivity
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      useAppStore.getState().updateSheetData(sanitized);
    }, 800);
  }, []);

  const handleRef = useCallback((ref: any) => {
    wbRef.current = ref;
    workbookRef = ref;
  }, []);

  // When sheetVersion changes (AI ops applied), we force-remount the Workbook
  // via key prop. Block handleChange briefly to prevent the remount's onChange
  // from writing stale data back.
  const prevVersionRef = useRef(sheetVersion);
  useEffect(() => {
    if (sheetVersion !== prevVersionRef.current) {
      isUpdatingRef.current = true;
      prevVersionRef.current = sheetVersion;
      const timer = setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sheetVersion]);

  // Force Fortune Sheet to recalculate layout after mount/remount
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
    return () => clearTimeout(timer);
  }, [sheetVersion, currentEntityId]);

  // Check celldata OR Fortune Sheet's internal 2D `data` array
  const hasData = sheets.some((s) => {
    if (s.celldata && s.celldata.length > 0) return true;
    const d = (s as any).data;
    if (Array.isArray(d)) {
      return d.some((row: any) => Array.isArray(row) && row.some((cell: any) => cell != null));
    }
    return false;
  });

  // Once data appears, latch — Fortune Sheet onChange can temporarily blank celldata
  if (hasData) hadDataRef.current = true;
  // Reset latch when navigating to a different entity
  const entityKey = `${currentEntityId}-${currentEntityType}`;
  const prevEntityRef = useRef(entityKey);
  if (entityKey !== prevEntityRef.current) {
    prevEntityRef.current = entityKey;
    hadDataRef.current = hasData;
  }

  // Never show placeholder for table entities or once data has been seen
  const showPlaceholder = !hadDataRef.current && !isStreaming && currentEntityType !== "table";

  return (
    <div className="w-full h-full relative">
      {showPlaceholder && (
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
      <div className="w-full h-full" key={`${currentEntityId}-${sheetVersion}`}>
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
