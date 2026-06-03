import { describe, it, expect } from "vitest";
import { resolveStreamDisposition, isActivelyEditing } from "@/lib/streamDisposition";

describe("isActivelyEditing", () => {
  it("true when an entity is open and input was recent", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 1000, now: 5000, thresholdMs: 8000 })).toBe(true);
  });
  it("false when no entity open", () => {
    expect(isActivelyEditing({ currentEntityId: null, lastInteractionAt: 1000, now: 2000, thresholdMs: 8000 })).toBe(false);
  });
  it("false when last input is stale", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 1000, now: 20000, thresholdMs: 8000 })).toBe(false);
  });
  it("false when never interacted", () => {
    expect(isActivelyEditing({ currentEntityId: "e1", lastInteractionAt: 0, now: 5000, thresholdMs: 8000 })).toBe(false);
  });
});

describe("resolveStreamDisposition", () => {
  it("background when stream project differs from active", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "B", editingDifferentEntity: false }).mode).toBe("background");
  });
  it("foreground-open when same project and not editing elsewhere", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "A", editingDifferentEntity: false }).mode).toBe("foreground-open");
  });
  it("foreground-quiet when same project but actively editing", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "A", editingDifferentEntity: true }).mode).toBe("foreground-quiet");
  });
  it("treats null streamProjectId as foreground (legacy/no-project send)", () => {
    expect(resolveStreamDisposition({ streamProjectId: null, currentProjectId: "A", editingDifferentEntity: false }).mode).toBe("foreground-open");
  });
  it("background takes precedence even if editing", () => {
    expect(resolveStreamDisposition({ streamProjectId: "A", currentProjectId: "B", editingDifferentEntity: true }).mode).toBe("background");
  });
});
