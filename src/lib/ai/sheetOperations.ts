import { produce } from "immer";
import { SheetData, SheetOperation, CellData } from "@/lib/types";

/** Safe max that doesn't blow the stack on large arrays */
function safeMax(arr: number[], fallback: number): number {
  if (arr.length === 0) return fallback;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
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
    switch (op.type) {
      case "SET_SHEET_DATA": {
        if (op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        sheet.celldata = op.data.celldata || [];
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
          celldata: op.celldata,
          config: {},
          row: 50,
          column: 26,
        });
        break;
      }

      case "UPDATE_CELLS": {
        if (op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.cells || !Array.isArray(op.cells)) break;
        for (const cell of op.cells) {
          if (cell.r == null || cell.c == null) continue;
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
        if (op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!op.range) break;
        const { r1, c1, r2, c2 } = op.range;

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
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
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
        if (op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        if (!sheet.config) sheet.config = {};
        if (!sheet.config.columnlen) sheet.config.columnlen = {};
        for (const [col, width] of Object.entries(op.widths)) {
          sheet.config.columnlen[col] = width;
        }
        break;
      }

      case "DELETE_ROWS": {
        if (op.sheetIndex >= draft.length) break;
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
        if (op.sheetIndex >= draft.length) break;
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
        if (op.sheetIndex >= draft.length) break;
        const sheet = draft[op.sheetIndex];
        sortSheet(sheet, op.column, op.ascending);
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
