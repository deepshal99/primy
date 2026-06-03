import { describe, it, expect } from "vitest";
import { isSkeletonTable } from "@/lib/tableHealth";
import type { CellData } from "@/lib/types";

const h = (c: number, label: string): CellData => ({ r: 0, c, v: { v: label } });
const cell = (r: number, c: number, v: string | number): CellData => ({ r, c, v: { v } });

describe("isSkeletonTable", () => {
  it("flags a 5-column table with only the Rank column filled", () => {
    const data: CellData[] = [
      h(0, "Rank"), h(1, "Show"), h(2, "Network"), h(3, "Genre"), h(4, "Date"),
      ...Array.from({ length: 10 }, (_, i) => cell(i + 1, 0, i + 1)),
    ];
    expect(isSkeletonTable(data)).toBe(true);
  });

  it("passes a fully-populated table", () => {
    const rows: CellData[] = [];
    for (let r = 1; r <= 3; r++) {
      rows.push(cell(r, 0, r), cell(r, 1, "Show " + r), cell(r, 2, "Net"), cell(r, 3, "Genre"), cell(r, 4, "2026"));
    }
    const data: CellData[] = [h(0, "Rank"), h(1, "Show"), h(2, "Network"), h(3, "Genre"), h(4, "Date"), ...rows];
    expect(isSkeletonTable(data)).toBe(false);
  });

  it("does not flag a narrow 2-column table", () => {
    const data: CellData[] = [
      h(0, "Item"), h(1, "Done"),
      cell(1, 0, "Task A"), cell(2, 0, "Task B"),
    ];
    expect(isSkeletonTable(data)).toBe(false);
  });

  it("does not flag a partially-sparse but multi-column body", () => {
    const data: CellData[] = [
      h(0, "Rank"), h(1, "Show"), h(2, "Network"), h(3, "Genre"),
      cell(1, 0, 1), cell(1, 1, "A"),
      cell(2, 0, 2), cell(2, 1, "B"),
    ];
    expect(isSkeletonTable(data)).toBe(false); // 2 body columns filled
  });

  it("returns false on empty/missing data", () => {
    expect(isSkeletonTable([])).toBe(false);
    expect(isSkeletonTable(undefined)).toBe(false);
    expect(isSkeletonTable(null)).toBe(false);
  });

  it("needs at least 2 data rows to judge", () => {
    const data: CellData[] = [
      h(0, "Rank"), h(1, "Show"), h(2, "Network"),
      cell(1, 0, 1),
    ];
    expect(isSkeletonTable(data)).toBe(false);
  });
});
