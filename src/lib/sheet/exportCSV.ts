import Papa from "papaparse";
import { SheetData } from "@/lib/types";

export function sheetToCSV(sheet: SheetData): string {
  if (sheet.celldata.length === 0) return "";

  const maxRow = Math.max(...sheet.celldata.map((c) => c.r));
  const maxCol = Math.max(...sheet.celldata.map((c) => c.c));

  const grid: (string | number)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    grid[r] = new Array(maxCol + 1).fill("");
  }

  for (const cell of sheet.celldata) {
    grid[cell.r][cell.c] = cell.v?.v ?? "";
  }

  return Papa.unparse(grid);
}

export function sheetToTSV(sheet: SheetData): string {
  if (sheet.celldata.length === 0) return "";

  const maxRow = Math.max(...sheet.celldata.map((c) => c.r));
  const maxCol = Math.max(...sheet.celldata.map((c) => c.c));

  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.celldata.find((cd) => cd.r === r && cd.c === c);
      row.push(String(cell?.v?.v ?? ""));
    }
    lines.push(row.join("\t"));
  }

  return lines.join("\n");
}
