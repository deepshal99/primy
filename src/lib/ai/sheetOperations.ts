import { produce } from "immer";
import { SheetData, SheetOperation, CellData, CellValue } from "@/lib/types";

/** Safe max that doesn't blow the stack on large arrays */
function safeMax(arr: number[], fallback: number): number {
  if (arr.length === 0) return fallback;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

/**
 * Normalize a cell value for Fortune Sheet compatibility.
 * - Formula cells get `ct` metadata so the engine evaluates them
 * - Number cells get `ct` with type "n" and `m` display string
 * - Ensures `m` (display/monitor) field is populated
 */
function normalizeCell(cell: CellData): CellData {
  if (!cell.v) return { ...cell, v: {} };
  const v = { ...cell.v };

  // Detect formula strings mistakenly placed in v.v instead of v.f
  if (typeof v.v === "string" && v.v.startsWith("=") && !v.f) {
    v.f = v.v;
    v.v = 0;
    v.m = "0";
    if (!v.ct) v.ct = { fa: "General", t: "n" };
  }

  // Formula cells: ensure ct metadata exists so Fortune Sheet evaluates them
  if (v.f) {
    if (!v.ct) {
      v.ct = { fa: "General", t: "n" };
    }
    // If no computed value yet, set a placeholder — Fortune Sheet will recalculate
    if (v.v === undefined && v.m === undefined) {
      v.v = 0;
      v.m = "0";
    }
  }

  // Number values: ensure m (display string) and ct are set
  if (typeof v.v === "number" && !v.f) {
    if (!v.m) v.m = String(v.v);
    if (!v.ct) v.ct = { fa: "General", t: "n" };
  }

  // String values: ensure m is set
  if (typeof v.v === "string" && !v.f) {
    if (!v.m) v.m = v.v;
    if (!v.ct) v.ct = { fa: "General", t: "s" };
  }

  return { ...cell, v };
}

/** Normalize all cells in an array */
export function normalizeCells(cells: CellData[]): CellData[] {
  return cells.map(normalizeCell);
}

export function applyOperations(
  sheets: SheetData[],
  operations: SheetOperation[]
): SheetData[] {
  let result = sheets;
  for (const op of operations) {
    try {
      result = applyOperation(result, op);
    } catch (err) {
      console.error("[Drafta] Failed to apply operation:", op.type, err);
      // Continue with remaining operations instead of crashing
    }
  }
  return result;
}

function applyOperation(
  sheets: SheetData[],
  op: SheetOperation
): SheetData[] {
  return produce(sheets, (draft) => {
    // Ensure all sheets have celldata array
    for (const s of draft) {
      if (!s.celldata) s.celldata = [];
    }

    switch (op.type) {
      case "SET_SHEET_DATA": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        sheet.celldata = normalizeCells(op.data.celldata || []);
        if (op.data.name) sheet.name = op.data.name;
        if (op.data.config) {
          sheet.config = { ...sheet.config, ...op.data.config };
        }
        const maxRow = safeMax(sheet.celldata.map((c) => c.r), 0);
        const maxCol = safeMax(sheet.celldata.map((c) => c.c), 0);
        sheet.row = Math.max(sheet.row || 50, maxRow + 10);
        sheet.column = Math.max(sheet.column || 26, maxCol + 5);
        break;
      }

      case "ADD_SHEET": {
        draft.push({
          name: op.name,
          order: draft.length,
          status: 0,
          celldata: normalizeCells(op.celldata || []),
          config: {},
          row: 50,
          column: 26,
        });
        break;
      }

      case "UPDATE_CELLS": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.cells || !Array.isArray(op.cells)) break;
        const normalized = normalizeCells(op.cells);
        for (const cell of normalized) {
          if (cell.r == null || cell.c == null || cell.r < 0 || cell.c < 0) continue;
          const idx = sheet.celldata.findIndex(
            (c) => c.r === cell.r && c.c === cell.c
          );
          if (idx >= 0) {
            sheet.celldata[idx] = cell;
          } else {
            sheet.celldata.push(cell);
          }
        }
        break;
      }

      case "FORMAT_CELLS": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.range) break;
        const { r1, c1, r2, c2 } = op.range;
        if (r1 < 0 || c1 < 0 || r2 < r1 || c2 < c1) break;

        // Cap range to prevent excessive cell creation (max 500 cells)
        const cappedR2 = Math.min(r2, r1 + 499);
        const cappedC2 = Math.min(c2, c1 + Math.floor(500 / (cappedR2 - r1 + 1)) - 1);

        // Apply format to existing cells in range (guard against missing cell.v)
        for (const cell of sheet.celldata) {
          if (
            cell.r >= r1 &&
            cell.r <= r2 &&
            cell.c >= c1 &&
            cell.c <= c2
          ) {
            if (!cell.v) cell.v = {};
            Object.assign(cell.v, op.format);
          }
        }

        // Create cells for positions in range that don't exist yet
        for (let r = r1; r <= cappedR2; r++) {
          for (let c = c1; c <= cappedC2; c++) {
            const exists = sheet.celldata.some(
              (cell) => cell.r === r && cell.c === c
            );
            if (!exists) {
              sheet.celldata.push({
                r,
                c,
                v: { ...op.format },
              });
            }
          }
        }
        break;
      }

      case "SET_COLUMN_WIDTHS": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!sheet.config) sheet.config = {};
        if (!sheet.config.columnlen) sheet.config.columnlen = {};
        for (const [col, width] of Object.entries(op.widths)) {
          sheet.config.columnlen[col] = width;
        }
        break;
      }

      case "DELETE_ROWS": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.rows || !Array.isArray(op.rows)) break;
        const rowsToDelete = new Set(op.rows);
        sheet.celldata = sheet.celldata.filter(
          (cell) => !rowsToDelete.has(cell.r)
        );
        // Shift rows down
        const sortedRows = [...op.rows].sort((a, b) => a - b);
        for (const cell of sheet.celldata) {
          let shift = 0;
          for (const row of sortedRows) {
            if (cell.r > row) shift++;
          }
          cell.r -= shift;
        }
        break;
      }

      case "DELETE_COLUMNS": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.columns || !Array.isArray(op.columns)) break;
        const colsToDelete = new Set(op.columns);
        sheet.celldata = sheet.celldata.filter(
          (cell) => !colsToDelete.has(cell.c)
        );
        const sortedCols = [...op.columns].sort((a, b) => a - b);
        for (const cell of sheet.celldata) {
          let shift = 0;
          for (const col of sortedCols) {
            if (cell.c > col) shift++;
          }
          cell.c -= shift;
        }
        break;
      }

      case "SORT": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        sortSheet(sheet, op.column, op.ascending);
        break;
      }

      case "SET_DROPDOWN": {
        if (op.sheetIndex < 0 || op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!sheet.dataVerification) sheet.dataVerification = {};
        if (!op.options || !Array.isArray(op.options) || op.options.length === 0) break;
        if (op.rowStart < 0 || op.rowEnd < op.rowStart || op.column < 0) break;
        const optionStr = op.options.join(",");
        // Cap to prevent excessive loop (max 1000 rows)
        const cappedEnd = Math.min(op.rowEnd, op.rowStart + 999);
        for (let r = op.rowStart; r <= cappedEnd; r++) {
          const key = `${r}_${op.column}`;
          sheet.dataVerification[key] = {
            type: "dropdown",
            type2: "",
            value1: optionStr,
            value2: "",
            remote: false,
            prohibitInput: false,
            hintShow: false,
            hintValue: "",
          };
        }
        break;
      }
    }
  });
}

function sortSheet(
  sheet: SheetData,
  column: number,
  ascending: boolean
): void {
  if (!sheet.celldata || sheet.celldata.length === 0) return;
  // Separate header (row 0) from data
  const headers = sheet.celldata.filter((c) => c.r === 0);
  const data = sheet.celldata.filter((c) => c.r > 0);

  // Group cells by row
  const rowMap = new Map<number, CellData[]>();
  for (const cell of data) {
    if (!rowMap.has(cell.r)) rowMap.set(cell.r, []);
    rowMap.get(cell.r)!.push(cell);
  }

  // Sort rows by the value in the target column
  const sortedRows = [...rowMap.entries()].sort(([, cellsA], [, cellsB]) => {
    const valA = cellsA.find((c) => c.c === column)?.v?.v ?? "";
    const valB = cellsB.find((c) => c.c === column)?.v?.v ?? "";

    const numA = typeof valA === "number" ? valA : parseFloat(String(valA));
    const numB = typeof valB === "number" ? valB : parseFloat(String(valB));

    if (!isNaN(numA) && !isNaN(numB)) {
      return ascending ? numA - numB : numB - numA;
    }

    const strA = String(valA);
    const strB = String(valB);
    return ascending
      ? strA.localeCompare(strB)
      : strB.localeCompare(strA);
  });

  // Reassign row indices
  const newCelldata: CellData[] = [...headers];
  sortedRows.forEach(([, cells], newRowIdx) => {
    for (const cell of cells) {
      newCelldata.push({ ...cell, r: newRowIdx + 1 });
    }
  });

  sheet.celldata = newCelldata;
}
