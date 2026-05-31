/**
 * parseAIResponse — truncation recovery for operation blocks.
 *
 * When the model hits its output-token cap mid-stream, the fenced JSON is cut
 * off and previously failed to parse entirely (dropping the whole sheet). The
 * repair step should salvage the complete prefix.
 */
import { describe, expect, test } from "vitest";
import {
  parseTableOperations,
  parsePageOperations,
} from "@/lib/ai/parseAIResponse";

describe("parseTableOperations — truncation salvage", () => {
  test("recovers a tableops CREATE truncated mid-celldata", () => {
    // Note the cut-off: closing ]}] of celldata/object/array are missing,
    // mirroring the real "Raw tail: ...\"v\": {\"v\": \"Yes\"}}" failure.
    const truncated = [
      '```tableops',
      '[{"type":"CREATE","title":"Subjects","celldata":[',
      '{"r":0,"c":0,"v":{"v":"Segment"}},',
      '{"r":0,"c":1,"v":{"v":"Subject"}},',
      '{"r":1,"c":0,"v":{"v":"Working Professionals"}},',
      '{"r":30,"c":3,"v":{"v":"Yes"}}',
    ].join("\n");

    const ops = parseTableOperations(truncated);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("CREATE");
    if (ops[0].type === "CREATE") {
      // All four complete cells survived the repair.
      expect(ops[0].celldata.length).toBe(4);
      expect(ops[0].title).toBe("Subjects");
    }
  });

  test("still parses a well-formed tableops block unchanged", () => {
    const ok = '```tableops\n[{"type":"CREATE","title":"T","celldata":[{"r":0,"c":0,"v":{"v":"A"}}]}]\n```';
    const ops = parseTableOperations(ok);
    expect(ops).toHaveLength(1);
    expect(ops[0].type === "CREATE" && ops[0].celldata.length).toBe(1);
  });
});

describe("parsePageOperations — truncation salvage", () => {
  test("drops a CREATE whose html was cut off (no html string)", () => {
    // A page truncated before html closes is not salvageable into valid html,
    // but the parser must not throw — it returns no ops rather than crashing.
    const truncated = '```pageops\n[{"type":"CREATE","title":"Visual","html":"<!doctype html><html><body><h1>Hi';
    expect(() => parsePageOperations(truncated)).not.toThrow();
  });
});
