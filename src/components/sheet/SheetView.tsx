"use client";

import { useRef, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { getStoredTheme, resolveDark } from "@/lib/theme";
import { Upload, ClipboardPaste, Wand2 } from "lucide-react";
import { SheetAIBar } from "./SheetAIBar";
import type { CellData, CellValue, SheetData } from "@/lib/types";
import type { FUniver } from "@univerjs/core/lib/facade";

// Store univerAPI ref globally so SheetAIBar can access selection
let univerApiRef: FUniver | null = null;
export function getWorkbookApi() {
  return univerApiRef;
}

// Debounce timer for saving sheet changes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ── Data conversion helpers ──

/** Convert our flat CellData[] to Univer's nested cellData format */
function toUniverCellData(cells: CellData[]): Record<number, Record<number, any>> {
  const result: Record<number, Record<number, any>> = {};
  for (const cell of cells) {
    if (!result[cell.r]) result[cell.r] = {};
    const uCell: any = {};
    if (cell.v) {
      // Value
      if (cell.v.v !== undefined && cell.v.v !== null) {
        uCell.v = cell.v.v;
      }
      // Formula
      if (cell.v.f) {
        uCell.f = cell.v.f;
      }
      // Cell type
      if (typeof cell.v.v === "number") {
        uCell.t = 2; // Number
      } else if (typeof cell.v.v === "string") {
        uCell.t = 1; // String
      }
      // Styles — inline on the cell
      const s: any = {};
      let hasStyle = false;
      if (cell.v.bl) { s.bl = 1; hasStyle = true; }
      if (cell.v.it) { s.it = 1; hasStyle = true; }
      if (cell.v.fc) { s.cl = { rgb: cell.v.fc }; hasStyle = true; }
      if (cell.v.bg) { s.bg = { rgb: cell.v.bg }; hasStyle = true; }
      if (cell.v.fs) { s.fs = cell.v.fs; hasStyle = true; }
      if (hasStyle) uCell.s = s;
    }
    result[cell.r][cell.c] = uCell;
  }
  return result;
}

/** Convert our SheetData[] to Univer IWorkbookData */
function toUniverWorkbook(sheets: SheetData[]): any {
  const sheetMap: Record<string, any> = {};
  const sheetOrder: string[] = [];

  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const sheetId = `sheet_${i}`;
    sheetOrder.push(sheetId);

    const columnData: Record<number, { w: number }> = {};
    if (s.config?.columnlen) {
      for (const [col, width] of Object.entries(s.config.columnlen)) {
        columnData[parseInt(col)] = { w: width };
      }
    }

    sheetMap[sheetId] = {
      id: sheetId,
      name: s.name || `Sheet${i + 1}`,
      rowCount: Math.max(s.row || 50, 100),
      columnCount: Math.max(s.column || 26, 26),
      cellData: toUniverCellData(s.celldata || []),
      columnData,
      defaultRowHeight: 24,
      defaultColumnWidth: 88,
    };
  }

  return {
    id: "primy-workbook",
    name: "Workbook",
    sheetOrder,
    sheets: sheetMap,
    locale: "EN_US" as any,
    styles: {},
  };
}

/** Convert Univer workbook snapshot back to our CellData[] format */
function fromUniverSheet(sheetSnapshot: any): { celldata: CellData[]; config: any; name: string } {
  const celldata: CellData[] = [];
  const cellDataObj = sheetSnapshot.cellData || {};

  for (const rStr of Object.keys(cellDataObj)) {
    const r = parseInt(rStr);
    const row = cellDataObj[rStr];
    if (!row || typeof row !== "object") continue;
    for (const cStr of Object.keys(row)) {
      const c = parseInt(cStr);
      const uCell = row[cStr];
      if (!uCell || (uCell.v === undefined && uCell.v === null && !uCell.f)) continue;

      const v: CellValue = {};
      if (uCell.v !== undefined && uCell.v !== null) v.v = uCell.v;
      if (uCell.f) v.f = uCell.f;
      // Display string
      if (v.v !== undefined) v.m = String(v.v);
      // Type metadata
      if (typeof v.v === "number") {
        v.ct = { fa: "General", t: "n" };
      } else if (typeof v.v === "string") {
        v.ct = { fa: "General", t: "s" };
      }
      // Extract styles
      const s = uCell.s;
      if (s && typeof s === "object") {
        if (s.bl) v.bl = 1;
        if (s.it) v.it = 1;
        if (s.cl?.rgb) v.fc = s.cl.rgb;
        if (s.bg?.rgb) v.bg = s.bg.rgb;
        if (s.fs) v.fs = s.fs;
      }
      celldata.push({ r, c, v });
    }
  }

  // Extract column widths
  const config: any = {};
  const columnData = sheetSnapshot.columnData;
  if (columnData && typeof columnData === "object") {
    const columnlen: Record<string, number> = {};
    for (const [col, data] of Object.entries(columnData)) {
      if ((data as any)?.w) columnlen[col] = (data as any).w;
    }
    if (Object.keys(columnlen).length > 0) config.columnlen = columnlen;
  }

  return { celldata, config, name: sheetSnapshot.name || "Sheet1" };
}

export function SheetView() {
  const sheets = useAppStore((s) => s.sheets);
  const sheetVersion = useAppStore((s) => s.sheetVersion);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<{ univer: any; univerAPI: FUniver } | null>(null);
  const isUpdatingRef = useRef(false);
  const hadDataRef = useRef(false);

  // Track entity key to detect navigation
  const entityKey = `${currentEntityId}-${currentEntityType}`;
  const prevEntityRef = useRef(entityKey);

  // Keep the Univer grid theme in sync with the app's light/dark toggle.
  useEffect(() => {
    const sync = () => {
      try { univerRef.current?.univerAPI.toggleDarkMode(resolveDark(getStoredTheme())); } catch { /* noop */ }
    };
    window.addEventListener("primy:themechange", sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      window.removeEventListener("primy:themechange", sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  // Create/destroy Univer instance
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    const initUniver = async () => {
      // Dynamic imports to avoid SSR issues
      const { createUniver, LocaleType, mergeLocales, defaultTheme } = await import("@univerjs/presets");
      const { UniverSheetsCorePreset } = await import("@univerjs/preset-sheets-core");
      const UniverPresetSheetsCoreEnUS = (await import("@univerjs/preset-sheets-core/locales/en-US")).default;
      const { UniverSheetsDrawingPreset } = await import("@univerjs/preset-sheets-drawing");
      const UniverPresetSheetsDrawingEnUS = (await import("@univerjs/preset-sheets-drawing/locales/en-US")).default;

      // CSS is imported via side-effect in the preset
      // @ts-ignore - CSS module import
      await import("@univerjs/preset-sheets-core/lib/index.css");
      // @ts-ignore - CSS module import
      await import("@univerjs/preset-sheets-drawing/lib/index.css");

      if (disposed) return;

      const currentSheets = useAppStore.getState().sheets;
      const workbookData = toUniverWorkbook(currentSheets);

      // Warm the Univer neutral ramp to match the app (Strut ink/near-white),
      // so the grid feels native in both light and dark instead of a cool grey.
      const warmTheme = {
        ...defaultTheme,
        white: "#FFFDFB",
        black: "#161513",
        gray: {
          50: "#FCFBF8",
          100: "#F7F7F4",
          200: "#F1F0ED",
          300: "#E2E0DA",
          400: "#B9B6AE",
          500: "#857F76",
          600: "#706E68",
          700: "#3B3A37",
          800: "#221F1A",
          900: "#161513",
        },
      };

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        theme: warmTheme,
        darkMode: resolveDark(getStoredTheme()),
        locales: {
          [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS, UniverPresetSheetsDrawingEnUS),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current!,
          }),
          UniverSheetsDrawingPreset(),
        ],
      });

      if (disposed) {
        univerAPI.dispose();
        return;
      }

      univerAPI.createWorkbook(workbookData);
      univerRef.current = { univer, univerAPI };
      univerApiRef = univerAPI;

      // Match the grid to the app theme (Univer renders its own canvas theme).
      try { univerAPI.toggleDarkMode(resolveDark(getStoredTheme())); } catch { /* older Univer */ }

      // Apply any pending sheet images from AI operations
      const pendingImages = useAppStore.getState().pendingSheetImages;
      if (pendingImages.length > 0) {
        const workbook = univerAPI.getActiveWorkbook();
        if (workbook) {
          for (const img of pendingImages) {
            try {
              const sheetOrder = (workbook as any).getSnapshot?.()?.sheetOrder;
              const sheetId = sheetOrder?.[img.sheetIndex] || `sheet_${img.sheetIndex}`;
              const sheet = workbook.getSheetBySheetId(sheetId);
              if (sheet) {
                const builder = (sheet as any).newOverGridImage()
                  .setSource(img.url, (univerAPI as any).Enum?.ImageSourceType?.URL ?? 1)
                  .setColumn(img.column)
                  .setRow(img.row);
                if (img.width) builder.setWidth(img.width);
                if (img.height) builder.setHeight(img.height);
                const builtImage = await builder.buildAsync();
                (sheet as any).insertImages([builtImage]);
              }
            } catch (err) {
              console.error("[Primy] Failed to insert sheet image:", err);
            }
          }
        }
        useAppStore.getState().clearPendingSheetImages();
      }

      // Listen for cell edits to sync back to store
      univerAPI.addEvent((univerAPI as any).Event.SheetEditEnded, () => {
        if (isUpdatingRef.current) return;
        if (useAppStore.getState().currentEntityType !== "table" && useAppStore.getState().currentEntityType !== null) return;

        syncUniverToStore(univerAPI);
      });
    };

    initUniver();

    return () => {
      disposed = true;
      // Clear any pending save timer to prevent stale writes
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (univerRef.current) {
        try {
          univerRef.current.univerAPI.dispose();
        } catch {
          // Ignore disposal errors
        }
        univerRef.current = null;
        univerApiRef = null;
      }
    };
  // Remount when sheetVersion or entity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetVersion, currentEntityId]);

  // Block syncing briefly after sheetVersion changes (AI ops applied)
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

  // Debounced sync from Univer to our store
  const syncUniverToStore = useCallback((api: FUniver) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const workbook = api.getActiveWorkbook();
        if (!workbook) return;

        const snapshot = (workbook as any).getSnapshot?.() || (workbook as any).save?.();
        if (!snapshot?.sheets) return;

        const storeSheets = useAppStore.getState().sheets;
        const sheetOrder = snapshot.sheetOrder || Object.keys(snapshot.sheets);
        const newSheets: SheetData[] = sheetOrder.map((sheetId: string, i: number) => {
          const sheetSnap = snapshot.sheets[sheetId];
          if (!sheetSnap) return storeSheets[i] || { name: `Sheet${i + 1}`, order: i, status: i === 0 ? 1 : 0, celldata: [], config: {} };
          const { celldata, config, name } = fromUniverSheet(sheetSnap);
          return {
            name,
            order: i,
            status: i === 0 ? 1 : 0, // First sheet is active
            celldata,
            config,
            row: sheetSnap.rowCount || 50,
            column: sheetSnap.columnCount || 26,
          };
        });

        // Guard: don't write back if all sheets have empty celldata
        const hasAnyData = newSheets.some((s) => s.celldata.length > 0);
        const storeHasData = storeSheets.some((s) => s.celldata && s.celldata.length > 0);
        if (storeHasData && !hasAnyData) return;

        useAppStore.getState().updateSheetData(newSheets);
      } catch (err) {
        console.error("[Primy] Failed to sync Univer to store:", err);
      }
    }, 800);
  }, []);

  // Check if sheets have data
  const hasData = sheets.some((s) => {
    if (s.celldata && s.celldata.length > 0) return true;
    return false;
  });

  if (hasData) hadDataRef.current = true;
  if (entityKey !== prevEntityRef.current) {
    prevEntityRef.current = entityKey;
    hadDataRef.current = hasData;
  }

  const showPlaceholder = !hadDataRef.current && !isStreaming && currentEntityType !== "table";

  return (
    <div className="w-full h-full relative bg-background">
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-4 text-center px-8 animate-fade-in">
            {/* Mini grid illustration */}
            <div
              className="relative w-[60px] h-[44px] rounded-[8px] overflow-hidden border border-[rgba(46,158,71,0.22)] bg-white"
              style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}
              aria-hidden
            >
              {/* Header row */}
              <div className="flex h-[10px] border-b border-[rgba(46,158,71,0.18)]">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-1 border-r last:border-r-0 border-[rgba(46,158,71,0.12)] bg-[#e8f7ea]"
                  />
                ))}
              </div>
              {/* Body rows */}
              {[0, 1, 2].map((r) => (
                <div
                  key={r}
                  className="flex h-[11px] border-b last:border-b-0 border-[rgba(46,158,71,0.10)]"
                >
                  {[0, 1, 2, 3].map((c) => (
                    <div
                      key={c}
                      className="flex-1 border-r last:border-r-0 border-[rgba(46,158,71,0.08)]"
                      style={{
                        background: c === 0 ? "rgba(46,158,71,0.06)" : "transparent",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[14px] font-medium mb-1 text-foreground font-heading tracking-[-0.01em]">
                Start typing or paste data
              </p>
              <p className="text-[12px] text-muted-foreground mb-3 max-w-[300px] leading-relaxed">
                Click a cell to begin, or ask AI in chat to build a sheet for you.
              </p>
              <div className="flex items-center justify-center gap-3 text-[11px] text-[#a3a3a3]">
                <span className="flex items-center gap-1">
                  <Upload className="w-3 h-3" strokeWidth={1.75} />
                  Import
                </span>
                <span className="text-[#d4d4d4]">·</span>
                <span className="flex items-center gap-1">
                  <ClipboardPaste className="w-3 h-3" strokeWidth={1.75} />
                  Paste
                </span>
                <span className="text-[#d4d4d4]">·</span>
                <span className="flex items-center gap-1">
                  <Wand2 className="w-3 h-3" strokeWidth={1.75} />
                  Ask AI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        key={`${currentEntityId}-${sheetVersion}`}
      />

      <SheetAIBar />

      {isStreaming && <StreamingBar />}
    </div>
  );
}

function StreamingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="h-[2px] w-full overflow-hidden bg-emerald-100">
        <div className="h-full animate-progress-bar bg-emerald-500" />
      </div>
    </div>
  );
}
