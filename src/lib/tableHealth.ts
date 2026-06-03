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
