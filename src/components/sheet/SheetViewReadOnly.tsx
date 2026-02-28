"use client";

import { useEffect, useRef } from "react";
import { SheetData, CellData } from "@/lib/types";

/** Convert our flat CellData[] to Univer's nested cellData format */
function toUniverCellData(cells: CellData[]): Record<number, Record<number, any>> {
  const result: Record<number, Record<number, any>> = {};
  for (const cell of cells) {
    if (!result[cell.r]) result[cell.r] = {};
    const uCell: any = {};
    if (cell.v) {
      if (cell.v.v !== undefined && cell.v.v !== null) uCell.v = cell.v.v;
      if (cell.v.f) uCell.f = cell.v.f;
      if (typeof cell.v.v === "number") uCell.t = 2;
      else if (typeof cell.v.v === "string") uCell.t = 1;
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
    id: "drafta-readonly-workbook",
    name: "Workbook",
    sheetOrder,
    sheets: sheetMap,
    locale: "EN_US" as any,
    styles: {},
  };
}

interface SheetViewReadOnlyProps {
  sheets: SheetData[];
}

export function SheetViewReadOnly({ sheets }: SheetViewReadOnlyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);

  const normalizedSheets = sheets.map((s, i) => ({
    ...s,
    celldata: Array.isArray(s.celldata) ? s.celldata : [],
    order: s.order ?? i,
    status: i === 0 ? 1 : 0,
    row: s.row || 50,
    column: s.column || 26,
    config: s.config || {},
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const init = async () => {
      const { createUniver, LocaleType, mergeLocales } = await import("@univerjs/presets");
      const { UniverSheetsCorePreset } = await import("@univerjs/preset-sheets-core");
      const UniverPresetSheetsCoreEnUS = (await import("@univerjs/preset-sheets-core/locales/en-US")).default;
      // @ts-ignore - CSS module import
      await import("@univerjs/preset-sheets-core/lib/index.css");

      if (disposed) return;

      const workbookData = toUniverWorkbook(normalizedSheets);

      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current!,
            header: false,
            toolbar: false,
            formulaBar: false,
            footer: normalizedSheets.length > 1 ? undefined : false as const,
          }),
        ],
      });

      if (disposed) {
        univerAPI.dispose();
        return;
      }

      univerAPI.createWorkbook(workbookData);
      univerRef.current = univerAPI;
    };

    init();

    return () => {
      disposed = true;
      if (univerRef.current) {
        try { univerRef.current.dispose(); } catch {}
        univerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
