/**
 * refineDeck — the no-renderable-slides early exit. This path must NOT launch a
 * browser or touch any model, so it's safe to run offline (no API keys, no
 * Chromium). The full render→critique→repair loop is integration-only.
 */
import { describe, expect, test } from "vitest";
import { refineDeck } from "@/lib/ai/deck/refineDeck";

describe("refineDeck — nothing to render", () => {
  test("passes every slide through untouched and counts them skipped", async () => {
    const res = await refineDeck([
      { id: "s1", html: "" },
      { id: "s2", html: "   " },
    ]);
    expect(res.summary).toEqual({
      critiqued: 0,
      repaired: 0,
      skipped: 2,
      avgBefore: 0,
      avgAfter: 0,
    });
    expect(res.slides.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(res.slides.every((s) => !s.changed)).toBe(true);
  });

  test("handles an empty deck", async () => {
    const res = await refineDeck([]);
    expect(res.slides).toEqual([]);
    expect(res.summary.skipped).toBe(0);
  });

  test("emits render(total:0) then done progress, nothing in between", async () => {
    const stages: string[] = [];
    await refineDeck([{ id: "s1", html: "" }], { onProgress: (e) => stages.push(e.stage) });
    expect(stages).toEqual(["render", "done"]);
  });
});
