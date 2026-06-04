/**
 * opParseFailures — the prod-safe AI-op failure sink + per-family drop detector.
 */
import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  reportOpParseFailure,
  getOpParseFailureCounts,
  resetOpParseFailureCounts,
  detectDroppedOpFamilies,
  droppedFamiliesLabel,
  OP_FAMILY_LABEL,
} from "@/lib/ai/opParseFailures";

beforeEach(() => {
  resetOpParseFailureCounts();
});

describe("reportOpParseFailure", () => {
  test("counts failures per family and always logs (prod-safe)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    reportOpParseFailure({ family: "deckops", reason: "schema-invalid", sample: "{}" });
    reportOpParseFailure({ family: "deckops", reason: "json-parse-failed", sample: "x" });
    reportOpParseFailure({ family: "pageops", reason: "missing-required-field", sample: "y" });

    const counts = getOpParseFailureCounts();
    expect(counts.deckops).toBe(2);
    expect(counts.pageops).toBe(1);
    expect(counts.sheetops).toBe(0);
    // The sink logs under one greppable prefix so a prod log drain can key on it.
    expect(err).toHaveBeenCalledWith("[primy.op_parse_failure]", expect.stringContaining("deckops"));
    err.mockRestore();
  });

  test("truncates the sample to 300 chars", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    reportOpParseFailure({ family: "pageops", reason: "schema-invalid", sample: "a".repeat(5000) });
    const payload = (err.mock.calls[0][1] as string);
    const parsed = JSON.parse(payload);
    expect(parsed.sample.length).toBe(300);
    err.mockRestore();
  });

  test("never throws even if logging fails", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("log sink down");
    });
    expect(() =>
      reportOpParseFailure({ family: "docops", reason: "schema-invalid", sample: "z" }),
    ).not.toThrow();
    err.mockRestore();
  });
});

describe("detectDroppedOpFamilies", () => {
  const zero = { sheetops: 0, docops: 0, kuops: 0, tableops: 0, deckops: 0, pageops: 0 };

  test("flags a family whose fence is present but produced zero ops", () => {
    const text = "Here is your deck:\n```deckops\n{bad json}\n```";
    expect(detectDroppedOpFamilies(text, zero)).toEqual(["deckops"]);
  });

  test("KEY: flags a dropped deck even when a sheet in the same reply succeeded", () => {
    const text = "```sheetops\n[...]\n```\n```deckops\n{broken}\n```";
    const counts = { ...zero, sheetops: 3 }; // sheet applied, deck dropped
    expect(detectDroppedOpFamilies(text, counts)).toEqual(["deckops"]);
  });

  test("does not flag a family that produced ops", () => {
    const text = "```pageops\n[...]\n```";
    expect(detectDroppedOpFamilies(text, { ...zero, pageops: 1 })).toEqual([]);
  });

  test("does not flag a family with no fence at all (e.g. tool-call path)", () => {
    expect(detectDroppedOpFamilies("just prose, no fences", zero)).toEqual([]);
  });
});

describe("droppedFamiliesLabel", () => {
  test("dedups families that share a noun (kuops + docops = document)", () => {
    expect(droppedFamiliesLabel(["kuops", "docops"])).toBe("document");
    expect(OP_FAMILY_LABEL.kuops).toBe("document");
  });
  test("joins distinct labels readably", () => {
    expect(droppedFamiliesLabel(["deckops", "pageops"])).toBe("deck and page");
    expect(droppedFamiliesLabel(["sheetops", "deckops", "pageops"])).toBe(
      "spreadsheet, deck, and page",
    );
  });
  test("empty in, empty out", () => {
    expect(droppedFamiliesLabel([])).toBe("");
  });
});
