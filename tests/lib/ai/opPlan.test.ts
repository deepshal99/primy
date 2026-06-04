/**
 * opPlan — pure classification of a parsed op bundle (the first store-decode slice).
 */
import { describe, expect, test } from "vitest";
import { opFamilyCounts, hasAnyOps, presentFamilies } from "@/lib/ai/opPlan";

const empty = { sheetOps: [], docOps: [], kuOps: [], tableOps: [], deckOps: [], pageOps: [] };

describe("opFamilyCounts", () => {
  test("maps bundle arrays to per-family counts", () => {
    const counts = opFamilyCounts({ ...empty, deckOps: [{}, {}] as any, pageOps: [{}] as any });
    expect(counts).toEqual({ sheetops: 0, docops: 0, kuops: 0, tableops: 0, deckops: 2, pageops: 1 });
  });

  test("tolerates a partial/undefined bundle", () => {
    expect(opFamilyCounts({}).deckops).toBe(0);
  });
});

describe("hasAnyOps", () => {
  test("false for an empty bundle", () => {
    expect(hasAnyOps(empty)).toBe(false);
  });
  test("true when any family has ops", () => {
    expect(hasAnyOps({ ...empty, sheetOps: [{}] as any })).toBe(true);
  });
});

describe("presentFamilies", () => {
  test("lists only families that produced ops, in stable order", () => {
    expect(presentFamilies({ ...empty, sheetOps: [{}] as any, deckOps: [{}] as any })).toEqual([
      "sheetops",
      "deckops",
    ]);
  });
});
