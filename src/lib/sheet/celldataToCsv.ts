import type { CellData } from "@/lib/types";

/**
 * Serialize a sparse Univer/Fortune `celldata[]` array to CSV in a SINGLE pass.
 *
 * Replaces the per-cell `celldata.find(...)` scan that several call sites
 * (chat context, contextRelevance.tableToCsv, mentioned-table context) each
 * reimplemented — that pattern is O(rows × cols × cells), i.e. quadratic in a
 * dense sheet and re-run on every chat turn. Here we index every cell once into
 * a `${r}:${c}` Map, then read by key: O(cells).
 *
 * Options:
 *   - maxRows: cap the number of rows emitted (rows beyond are dropped).
 *   - preferFormula: emit the cell formula (`v.f`) when present, else its value.
 */
export function celldataToCsv(
  celldata: CellData[] | undefined | null,
  opts: { maxRows?: number; preferFormula?: boolean } = {}
): string {
  if (!celldata?.length) return "";
  const { maxRows = Infinity, preferFormula = false } = opts;

  const byKey = new Map<string, CellData["v"]>();
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c > maxCol) maxCol = cell.c;
    byKey.set(`${cell.r}:${cell.c}`, cell.v);
  }

  const rowCap = Math.min(maxRow, maxRows);
  const rows: string[] = [];
  for (let r = 0; r <= rowCap; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const v = byKey.get(`${r}:${c}`);
      const raw = preferFormula && v?.f ? v.f : (v?.v ?? "");
      const str = String(raw);
      cells.push(str.includes(",") ? `"${str}"` : str);
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}
