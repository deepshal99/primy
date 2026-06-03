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

describe("parsePageOperations — fenceless salvage", () => {
  test("recovers a CREATE the model emitted as a bare array with no ```pageops fence", () => {
    // Reproduces the live failure: the page op was printed as raw JSON with no
    // fence, so the fence-only parser dropped it and the user saw no page.
    const unfenced = [
      "Here's a fun, colorful HTML visual page showcasing the stats.",
      "",
      '[{ "type": "CREATE", "title": "IPL 2024 — Insane Stats", "html": "<!doctype html><html><body><h1>Stats</h1><p style=\\"color:red\\">287/3</p></body></html>" }]',
      "",
      "This page is ready to link from your site.",
    ].join("\n");

    const ops = parsePageOperations(unfenced);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("CREATE");
    if (ops[0].type === "CREATE") {
      expect(ops[0].title).toBe("IPL 2024 — Insane Stats");
      expect(ops[0].html).toContain("287/3");
    }
  });

  test("does not double-create when the page IS properly fenced", () => {
    const fenced = '```pageops\n[{"type":"CREATE","title":"T","html":"<!doctype html><html></html>"}]\n```';
    expect(parsePageOperations(fenced)).toHaveLength(1);
  });
});

describe("parsePageOperations — unescaped-HTML-quote recovery", () => {
  // The model frequently forgets to escape inner double-quotes in the HTML body
  // (the design prompt itself asks for `font-feature-settings:"ss01","cv01"`).
  // Strict JSON.parse fails and the old path either dropped the page (blank
  // "This page is empty") or truncated the markup at the first `","` inside the
  // HTML (page created, preview blank). Schema-anchored recovery must keep the
  // FULL body intact.

  test("recovers full body when html carries unescaped quotes + font-feature list", () => {
    const block = [
      "```pageops",
      '[{"type":"CREATE","title":"HydrateX One-Pager","html":"<!doctype html><html><head><style>body{font-feature-settings:"ss01","cv01"}.hero{color:#111}</style></head><body><h1 class="hero">HydrateX</h1><p>Smart water bottle.</p></body></html>","editableFields":[]}]',
      "```",
    ].join("\n");
    const ops = parsePageOperations(block);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("CREATE");
    if (ops[0].type === "CREATE") {
      expect(ops[0].html).toContain("HydrateX</h1>");
      expect(ops[0].html).toContain("</body></html>");
    }
  });

  test("html as the LAST field (no editableFields) with inner quotes", () => {
    const block =
      '```pageops\n[{"type":"CREATE","title":"P","html":"<html><body><div class="x">A</div><p>B</p></body></html>"}]\n```';
    const ops = parsePageOperations(block);
    expect(ops).toHaveLength(1);
    if (ops[0].type === "CREATE") {
      expect(ops[0].html).toContain("<p>B</p>");
      expect(ops[0].html).toContain("</body></html>");
    }
  });

  test('inner `","` inside an embedded <script> does not truncate the body', () => {
    const block =
      '```pageops\n[{"type":"CREATE","title":"P","html":"<html><body><script>var d={"a":"1","b":"2"};</script><h1 class="hero">Headline</h1><footer>End</footer></body></html>","editableFields":[]}]\n```';
    const ops = parsePageOperations(block);
    expect(ops).toHaveLength(1);
    if (ops[0].type === "CREATE") {
      expect(ops[0].html).toContain("Headline");
      expect(ops[0].html).toContain("<footer>End</footer>");
    }
  });

  test("fenceless bare array with unescaped quotes recovers full body", () => {
    const reply = [
      "Here's your page.",
      '[{"type":"CREATE","title":"P","html":"<html><body><h1 style="margin:0">Hi</h1><section>Body</section></body></html>","editableFields":[]}]',
    ].join("\n");
    const ops = parsePageOperations(reply);
    expect(ops).toHaveLength(1);
    if (ops[0].type === "CREATE") {
      expect(ops[0].html).toContain("<section>Body</section>");
    }
  });
});
