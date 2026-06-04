/**
 * applyTableOps — characterization tests pinning the table op behavior lifted
 * out of finishStreaming (T3 slice 2).
 */
import { describe, expect, test } from "vitest";
import { applyTableOps, type TableApplyView, type TableApplyCtx } from "@/lib/ai/applyTableOps";
import type { ProjectTable } from "@/lib/types";

const tbl = (id: string, cells: any[] = []): ProjectTable => ({
  id,
  projectId: "p1",
  title: `T ${id}`,
  sheets: [{ name: "Sheet1", order: 0, status: 1, celldata: cells, config: {}, row: 50, column: 26 }],
  createdAt: 1,
  updatedAt: 1,
});

const view = (over: Partial<TableApplyView> = {}): TableApplyView => ({
  currentEntityId: null,
  currentEntityType: null,
  sheets: [],
  sheetVersion: 0,
  activeTab: "sheet",
  openTabs: [],
  ...over,
});

const ctx = (over: Partial<TableApplyCtx> = {}): TableApplyCtx => ({
  allowFocusSteal: true,
  stateCurrentEntityId: null,
  baseSheetVersion: 5,
  makeId: () => "new-id",
  now: () => 1000,
  ...over,
});

describe("CREATE", () => {
  test("appends a 1-sheet table, records produced, opens + focuses on focus-steal", () => {
    const r = applyTableOps([], [{ type: "CREATE", title: "Budget", celldata: [{ r: 0, c: 0, v: { v: "A" } }] as any }], view(), ctx());
    expect(r.tables.map((t) => t.id)).toEqual(["new-id"]);
    expect(r.tables[0].sheets).toHaveLength(1);
    expect(r.tables[0].sheets[0].celldata).toHaveLength(1);
    expect(r.produced).toEqual([{ id: "new-id", type: "table", title: "Budget", action: "created" }]);
    expect(r.view.currentEntityId).toBe("new-id");
    expect(r.view.currentEntityType).toBe("table");
    expect(r.view.activeTab).toBe("sheet");
    expect(r.view.sheetVersion).toBe(6);
    expect(r.view.openTabs).toEqual([{ id: "new-id", type: "table", title: "Budget" }]);
  });

  test("no focus theft when not allowed", () => {
    const r = applyTableOps([], [{ type: "CREATE", title: "X", celldata: [] as any }], view(), ctx({ allowFocusSteal: false }));
    expect(r.tables).toHaveLength(1);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.sheetVersion).toBe(0);
  });
});

describe("UPDATE_CELLS", () => {
  test("merges cells by r,c and syncs the grid only for the open table", () => {
    const start = tbl("a", [{ r: 0, c: 0, v: { v: "old" } }]);
    const r = applyTableOps(
      [start],
      [{ type: "UPDATE_CELLS", tableId: "a", sheetIndex: 0, cells: [{ r: 0, c: 0, v: { v: "new" } }, { r: 1, c: 0, v: { v: "added" } }] } as any],
      view(),
      ctx({ stateCurrentEntityId: "a" }),
    );
    // 0,0 overwritten + 1,0 added = 2 cells
    expect(r.tables[0].sheets[0].celldata).toHaveLength(2);
    expect(r.view.sheets[0].celldata).toHaveLength(2); // synced (open table)
    expect(r.view.sheetVersion).toBe(6);
    expect(r.aiModifiedIds).toEqual(["a"]);
  });

  test("does NOT sync the grid when a different table is open", () => {
    const r = applyTableOps(
      [tbl("a")],
      [{ type: "UPDATE_CELLS", tableId: "a", sheetIndex: 0, cells: [{ r: 0, c: 0, v: { v: "x" } }] } as any],
      view(),
      ctx({ stateCurrentEntityId: "b" }),
    );
    expect(r.view.sheets).toEqual([]); // untouched
    expect(r.view.sheetVersion).toBe(0);
    expect(r.aiModifiedIds).toEqual(["a"]); // still recorded
  });

  test("missing table id is a no-op", () => {
    const r = applyTableOps([tbl("a")], [{ type: "UPDATE_CELLS", tableId: "zzz", sheetIndex: 0, cells: [] } as any], view(), ctx());
    expect(r.produced).toEqual([]);
  });
});

describe("SET_TABLE_DATA", () => {
  test("shallow-merges data into the addressed sheet", () => {
    const r = applyTableOps(
      [tbl("a")],
      [{ type: "SET_TABLE_DATA", tableId: "a", sheetIndex: 0, data: { name: "Renamed", celldata: [{ r: 0, c: 0, v: { v: "z" } }] } } as any],
      view(),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(r.tables[0].sheets[0].name).toBe("Renamed");
    expect(r.tables[0].sheets[0].celldata).toHaveLength(1);
    expect(r.view.sheetVersion).toBe(6);
  });
});

describe("DELETE", () => {
  test("removes the table + tab; resets the grid to a blank sheet when it was open", () => {
    const r = applyTableOps(
      [tbl("a"), tbl("b")],
      [{ type: "DELETE", tableId: "a" }],
      view({ currentEntityId: "a", currentEntityType: "table", openTabs: [{ id: "a", type: "table", title: "T a" }] }),
      ctx(),
    );
    expect(r.tables.map((t) => t.id)).toEqual(["b"]);
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.sheets[0].celldata).toEqual([]);
    expect(r.view.sheets[0].config).toBeUndefined(); // DELETE blank sheet omits config (store parity)
    expect(r.view.sheetVersion).toBe(6);
  });
});

describe("purity", () => {
  test("does not mutate the input tables array", () => {
    const input = [tbl("a")];
    applyTableOps(input, [{ type: "CREATE", title: "X", celldata: [] as any }], view(), ctx());
    expect(input).toHaveLength(1);
  });
});
