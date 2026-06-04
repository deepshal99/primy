/**
 * applyKuOps — characterization tests pinning the exact behavior lifted out of
 * finishStreaming, so the extraction (and any future change) is verifiable.
 */
import { describe, expect, test } from "vitest";
import { applyKuOps, type KuApplyView, type KuApplyCtx } from "@/lib/ai/applyKuOps";
import type { KnowledgeUnit } from "@/lib/types";

const ku = (id: string, over: Partial<KnowledgeUnit> = {}): KnowledgeUnit => ({
  id,
  projectId: "p1",
  title: `KU ${id}`,
  content: `content ${id}`,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const view = (over: Partial<KuApplyView> = {}): KuApplyView => ({
  currentEntityId: null,
  currentEntityType: null,
  docContent: "",
  docVersion: 0,
  activeTab: "doc",
  openTabs: [],
  ...over,
});

const ctx = (over: Partial<KuApplyCtx> = {}): KuApplyCtx => ({
  allowFocusSteal: true,
  stateCurrentEntityId: null,
  baseDocVersion: 5,
  makeId: () => "new-id",
  now: () => 1000,
  ...over,
});

describe("CREATE", () => {
  test("appends a KU + records produced; opens & focuses it when focus-steal allowed", () => {
    const r = applyKuOps([ku("a")], [{ type: "CREATE", title: "Fresh", content: "body" }], view(), ctx());
    expect(r.knowledgeUnits.map((k) => k.id)).toEqual(["a", "new-id"]);
    expect(r.produced).toEqual([{ id: "new-id", type: "ku", title: "Fresh", action: "created" }]);
    expect(r.view.currentEntityId).toBe("new-id");
    expect(r.view.currentEntityType).toBe("ku");
    expect(r.view.docContent).toBe("body");
    expect(r.view.docVersion).toBe(6); // baseDocVersion + 1
    expect(r.view.activeTab).toBe("doc");
    expect(r.view.openTabs).toEqual([{ id: "new-id", type: "ku", title: "Fresh" }]);
  });

  test("does NOT steal focus when not allowed (still creates + records produced)", () => {
    const r = applyKuOps([], [{ type: "CREATE", title: "Bg", content: "x" }], view(), ctx({ allowFocusSteal: false }));
    expect(r.knowledgeUnits).toHaveLength(1);
    expect(r.produced).toHaveLength(1);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.docVersion).toBe(0); // unchanged
  });
});

describe("UPDATE", () => {
  test("syncs the doc view ONLY when the edited KU is the open one", () => {
    const open = applyKuOps([ku("a")], [{ type: "UPDATE", kuId: "a", content: "new" }], view(), ctx({ stateCurrentEntityId: "a" }));
    expect(open.view.docContent).toBe("new");
    expect(open.view.docVersion).toBe(6);
    expect(open.aiModifiedIds).toEqual(["a"]);

    const other = applyKuOps([ku("a")], [{ type: "UPDATE", kuId: "a", content: "new" }], view(), ctx({ stateCurrentEntityId: "b" }));
    expect(other.view.docContent).toBe(""); // not synced
    expect(other.view.docVersion).toBe(0);
    expect(other.aiModifiedIds).toEqual(["a"]); // still recorded as modified
  });

  test("a missing target id is a no-op", () => {
    const r = applyKuOps([ku("a")], [{ type: "UPDATE", kuId: "zzz", content: "x" }], view(), ctx());
    expect(r.knowledgeUnits[0].content).toBe("content a");
    expect(r.produced).toEqual([]);
  });
});

describe("APPEND", () => {
  test("concatenates with a blank line and syncs doc only for the open KU; records produced", () => {
    const r = applyKuOps([ku("a", { content: "one" })], [{ type: "APPEND", kuId: "a", content: "two" }], view(), ctx({ stateCurrentEntityId: "a" }));
    expect(r.knowledgeUnits[0].content).toBe("one\n\ntwo");
    expect(r.view.docContent).toBe("one\n\ntwo");
    // APPEND records produced + aiModifiedIds exactly like UPDATE (store parity)
    expect(r.produced).toEqual([{ id: "a", type: "ku", title: "KU a", action: "updated" }]);
    expect(r.aiModifiedIds).toEqual(["a"]);
  });
});

describe("RENAME", () => {
  test("renames the KU and syncs its open-tab title", () => {
    const r = applyKuOps(
      [ku("a")],
      [{ type: "RENAME", kuId: "a", title: "Renamed" }],
      view({ openTabs: [{ id: "a", type: "ku", title: "KU a" }] }),
      ctx(),
    );
    expect(r.knowledgeUnits[0].title).toBe("Renamed");
    expect(r.view.openTabs).toEqual([{ id: "a", type: "ku", title: "Renamed" }]);
  });
});

describe("DELETE", () => {
  test("removes the KU + its tab; clears the editor when it was the open one", () => {
    const r = applyKuOps(
      [ku("a"), ku("b")],
      [{ type: "DELETE", kuId: "a" }],
      view({ currentEntityId: "a", currentEntityType: "ku", docContent: "content a", openTabs: [{ id: "a", type: "ku", title: "KU a" }] }),
      ctx(),
    );
    expect(r.knowledgeUnits.map((k) => k.id)).toEqual(["b"]);
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.docContent).toBe("");
    expect(r.view.docVersion).toBe(6);
  });

  test("deleting a non-open KU leaves the editor intact", () => {
    const r = applyKuOps(
      [ku("a"), ku("b")],
      [{ type: "DELETE", kuId: "b" }],
      view({ currentEntityId: "a", docContent: "content a" }),
      ctx(),
    );
    expect(r.knowledgeUnits.map((k) => k.id)).toEqual(["a"]);
    expect(r.view.currentEntityId).toBe("a");
    expect(r.view.docContent).toBe("content a");
  });
});

describe("purity", () => {
  test("does not mutate the input arrays", () => {
    const input = [ku("a")];
    const tabs = [{ id: "a", type: "ku" as const, title: "KU a" }];
    const v = view({ openTabs: tabs });
    applyKuOps(input, [{ type: "CREATE", title: "X", content: "y" }], v, ctx());
    expect(input).toHaveLength(1); // original untouched
    expect(tabs).toHaveLength(1);
  });
});
