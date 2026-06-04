/**
 * opSchemas — the zod gate on AI-emitted operations. Validates that real ops
 * pass (no regression) and that the structurally-broken ones that used to drop
 * silently are now rejected AND reported.
 */
import { describe, expect, test, beforeEach, vi } from "vitest";
import { validateOps } from "@/lib/ai/opSchemas";
import {
  getOpParseFailureCounts,
  resetOpParseFailureCounts,
} from "@/lib/ai/opParseFailures";

beforeEach(() => {
  resetOpParseFailureCounts();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validateOps — accepts every currently-valid op (no regression)", () => {
  test("deckops CREATE + UPDATE", () => {
    const ops = [
      { type: "CREATE", title: "Q3 Review", slides: [{ id: "s1", html: "<section>…</section>", editableFields: [] }] },
      { type: "UPDATE", deckId: "deck_1", slides: [] },
      { type: "RENAME", deckId: "deck_1", title: "New" },
      { type: "DELETE", deckId: "deck_1" },
    ];
    expect(validateOps("deckops", ops)).toHaveLength(4);
    expect(getOpParseFailureCounts().deckops).toBe(0);
  });

  test("pageops CREATE + UPDATE", () => {
    const ops = [
      { type: "CREATE", title: "Landing", html: "<main>hi</main>", editableFields: [] },
      { type: "UPDATE", pageId: "page_1", html: "<main>edited</main>" },
      { type: "RENAME", pageId: "page_1", title: "Home" },
      { type: "DELETE", pageId: "page_1" },
    ];
    expect(validateOps("pageops", ops)).toHaveLength(4);
  });

  test("tableops CREATE with empty celldata (parser coerces to []) is valid", () => {
    expect(validateOps("tableops", [{ type: "CREATE", title: "T", celldata: [] }])).toHaveLength(1);
  });

  test("sheetops + docops + kuops known types pass", () => {
    expect(validateOps("sheetops", [{ type: "UPDATE_CELLS", sheetIndex: 0, cells: [] }])).toHaveLength(1);
    expect(validateOps("docops", [{ type: "SET_CONTENT", markdown: "# Hi" }])).toHaveLength(1);
    expect(validateOps("kuops", [{ type: "CREATE", title: "Note", content: "body" }])).toHaveLength(1);
  });
});

describe("validateOps — rejects + reports the silent-drop bugs", () => {
  test("page CREATE missing html is dropped and reported", () => {
    const out = validateOps("pageops", [{ type: "CREATE", title: "X" }]);
    expect(out).toHaveLength(0);
    expect(getOpParseFailureCounts().pageops).toBe(1);
  });

  test("deck UPDATE missing deckId is dropped and reported", () => {
    const out = validateOps("deckops", [{ type: "UPDATE", slides: [] }]);
    expect(out).toHaveLength(0);
    expect(getOpParseFailureCounts().deckops).toBe(1);
  });

  test("unknown discriminator is dropped and reported", () => {
    expect(validateOps("sheetops", [{ type: "FROBNICATE" }])).toHaveLength(0);
    expect(getOpParseFailureCounts().sheetops).toBe(1);
  });

  test("valid + invalid in one batch: keeps the good, reports the bad", () => {
    const out = validateOps("pageops", [
      { type: "CREATE", title: "ok", html: "<p>x</p>" },
      { type: "UPDATE", html: "<p>no id</p>" }, // missing pageId
    ]);
    expect(out).toHaveLength(1);
    expect(getOpParseFailureCounts().pageops).toBe(1);
  });

  test("keeps the ORIGINAL object (gate, not transform — no field stripping)", () => {
    const op = { type: "CREATE", title: "ok", html: "<p>x</p>", editableFields: [{ id: "a" }], extraField: 42 };
    const out = validateOps<typeof op>("pageops", [op]);
    expect(out[0]).toBe(op); // same reference, nothing stripped
    expect((out[0] as any).extraField).toBe(42);
  });
});
