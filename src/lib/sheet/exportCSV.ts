import Papa from "papaparse";
import { SheetData, CellData } from "@/lib/types";

/** Safe max that doesn't blow the stack on large arrays */
function safeMax(arr: number[], fallback: number): number {
  if (arr.length === 0) return fallback;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

export function sheetToCSV(sheet: SheetData): string {
  if (!sheet.celldata || sheet.celldata.length === 0) return "";

  const maxRow = safeMax(sheet.celldata.map((c) => c.r), 0);
  const maxCol = safeMax(sheet.celldata.map((c) => c.c), 0);

  const grid: (string | number)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    grid[r] = new Array(maxCol + 1).fill("");
  }

  for (const cell of sheet.celldata) {
    if (cell.r <= maxRow) grid[cell.r][cell.c] = cell.v?.v ?? "";
  }

  return Papa.unparse(grid);
}

export function sheetToTSV(sheet: SheetData): string {
  if (!sheet.celldata || sheet.celldata.length === 0) return "";

  const maxRow = safeMax(sheet.celldata.map((c) => c.r), 0);
  const maxCol = safeMax(sheet.celldata.map((c) => c.c), 0);

  // Build a lookup map for O(1) cell access instead of O(n) per cell
  const cellMap = new Map<string, CellData>();
  for (const cd of sheet.celldata) {
    cellMap.set(`${cd.r},${cd.c}`, cd);
  }

  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = cellMap.get(`${r},${c}`);
      row.push(String(cell?.v?.v ?? ""));
    }
    lines.push(row.join("\t"));
  }

  return lines.join("\n");
}
