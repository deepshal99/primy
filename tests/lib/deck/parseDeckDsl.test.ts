/**
 * parseDeckDslOperations — the flag-gated DSL → deck CREATE bridge.
 */
import { describe, expect, test } from "vitest";
import { parseDeckDslOperations } from "@/lib/ai/parseAIResponse";
import { deckThemes } from "@/components/deck/deckThemes";

describe("parseDeckDslOperations", () => {
  test("turns a deckdsl block into a deck CREATE with themed HTML slides", () => {
    const text = [
      "Here is your deck:",
      "```deckdsl",
      '<deck theme="linear" title="Acme Q3">',
      "  <slide layout=\"title\"><h1>A repeatable engine</h1></slide>",
      "  <slide layout=\"stats\"><h2>Numbers</h2><stat value=\"3x\" label=\"growth\"/></slide>",
      "</deck>",
      "```",
    ].join("\n");

    const ops = parseDeckDslOperations(text);
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.type).toBe("CREATE");
    if (op.type === "CREATE") {
      expect(op.title).toBe("Acme Q3");
      expect(op.slides).toHaveLength(2);
      expect(op.style).toEqual(deckThemes.linear); // theme attr resolved
      // each slide is a self-contained themed HTML doc
      expect((op.slides[0] as any).html).toContain("960px");
      expect((op.slides[0] as any).html).toContain(`--accent:${deckThemes.linear.accent}`);
    }
  });

  test("unknown/absent theme falls back to pitch", () => {
    const ops = parseDeckDslOperations('```deckdsl\n<deck title="X"><slide layout="title"><h1>Hi</h1></slide></deck>\n```');
    expect(ops[0].type).toBe("CREATE");
    if (ops[0].type === "CREATE") expect(ops[0].style).toEqual(deckThemes.pitch);
  });

  test("no deckdsl block → no ops", () => {
    expect(parseDeckDslOperations("just prose")).toEqual([]);
    expect(parseDeckDslOperations("```deckops\n[{...}]\n```")).toEqual([]);
  });
});
