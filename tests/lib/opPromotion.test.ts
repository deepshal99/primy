/**
 * promoteOrphanOps — the root-cause fix for "the AI did nothing".
 *
 * The model sometimes emits edit-ops (sheetops/docops) to *create* with no
 * matching entity open. Those must be promoted to CREATE ops so a real entity
 * is made instead of silently mutating an unpersisted buffer.
 */
import { describe, expect, test } from "vitest";
import { promoteOrphanOps } from "@/lib/ai/opPromotion";
import type { SheetOperation, DocOperation } from "@/lib/types";

const sheetCreate: SheetOperation = {
  type: "SET_SHEET_DATA",
  sheetIndex: 0,
  data: {
    name: "Content Calendar",
    celldata: [
      { r: 0, c: 0, v: { v: "Date" } },
      { r: 0, c: 1, v: { v: "Channel" } },
      { r: 1, c: 0, v: { v: "Mon" } },
    ],
  },
};

const docCreate: DocOperation = { type: "SET_CONTENT", markdown: "# Brief\n\nHello." };

describe("promoteOrphanOps", () => {
  test("orphan sheetops (no open table) → tableops CREATE", () => {
    const out = promoteOrphanOps(
      { sheetOps: [sheetCreate] },
      { hasOpenTable: false, hasOpenDoc: false }
    );
    expect(out.sheetOps).toBeUndefined();
    expect(out.tableOps).toHaveLength(1);
    expect(out.tableOps![0].type).toBe("CREATE");
    if (out.tableOps![0].type === "CREATE") {
      expect(out.tableOps![0].title).toBe("Content Calendar");
      expect(out.tableOps![0].celldata.length).toBe(3);
    }
  });

  test("sheetops with a table OPEN passes through untouched (real edit)", () => {
    const out = promoteOrphanOps(
      { sheetOps: [sheetCreate] },
      { hasOpenTable: true, hasOpenDoc: false }
    );
    expect(out.sheetOps).toHaveLength(1);
    expect(out.tableOps).toBeUndefined();
  });

  test("orphan docops (no open doc) → kuops CREATE", () => {
    const out = promoteOrphanOps(
      { docOps: [docCreate] },
      { hasOpenTable: false, hasOpenDoc: false }
    );
    expect(out.docOps).toBeUndefined();
    expect(out.kuOps).toHaveLength(1);
    expect(out.kuOps![0].type).toBe("CREATE");
    if (out.kuOps![0].type === "CREATE") {
      expect(out.kuOps![0].content).toContain("Brief");
    }
  });

  test("docops with a doc OPEN passes through untouched (real edit)", () => {
    const out = promoteOrphanOps(
      { docOps: [docCreate] },
      { hasOpenTable: false, hasOpenDoc: true }
    );
    expect(out.docOps).toHaveLength(1);
    expect(out.kuOps).toBeUndefined();
  });

  test("correct CREATE ops are left untouched", () => {
    const out = promoteOrphanOps(
      { tableOps: [{ type: "CREATE", title: "T", celldata: [] }] },
      { hasOpenTable: false, hasOpenDoc: false }
    );
    expect(out.tableOps).toHaveLength(1);
    expect(out.sheetOps).toBeUndefined();
  });
});
