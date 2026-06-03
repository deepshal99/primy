// Detect a "skeleton" table: one the model created with multiple header columns
// but only the first (index-like) column populated in the body, leaving the rest
// blank. Used to auto-trigger a fill pass so the user never sees an empty shell.

import type { CellData } from "@/lib/types";

function nonEmpty(cell: CellData): boolean {
  const v = cell?.v?.v;
  return v != null && String(v).trim() !== "";
}

export function isSkeletonTable(celldata: CellData[] | undefined | null): boolean {
  if (!Array.isArray(celldata) || celldata.length === 0) return false;

  // Header columns = columns with a non-empty value in row 0.
  const headerCols = new Set<number>();
  for (const cell of celldata) {
    if (cell.r === 0 && nonEmpty(cell)) headerCols.add(cell.c);
  }
  // Only judge real multi-column tables; a 1-2 column list isn't a skeleton.
  if (headerCols.size < 3) return false;

  // Body columns / rows that actually carry data (row >= 1).
  const bodyCols = new Set<number>();
  const bodyRows = new Set<number>();
  for (const cell of celldata) {
    if (cell.r >= 1 && nonEmpty(cell)) {
      bodyCols.add(cell.c);
      bodyRows.add(cell.r);
    }
  }
  // Need at least a couple of data rows to make the call.
  if (bodyRows.size < 2) return false;

  // Skeleton: 3+ header columns but at most one column has any body data.
  return bodyCols.size <= 1;
}

/**
 * True when the user's message is about filling in / completing / adding data to
 * a spreadsheet (used together with "a sheet is the active entity" to disable the
 * document-creation tools so the data lands in the open sheet, not a new doc).
 */
export function isFillSheetIntent(text: string): boolean {
  const t = (text || "").toLowerCase();
  const fillVerb = /\b(fill|fill in|fill out|complete|populate|finish|flesh out)\b/.test(t);
  const addData = /\b(add|insert|append|update|put)\b[\s\S]{0,30}\b(column|row|rows|data|values?|rating|score|field|cell|cells)\b/.test(t);
  return fillVerb || addData;
}
