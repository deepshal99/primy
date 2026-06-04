/**
 * applyPageOps — characterization tests pinning the exact behavior lifted out of
 * finishStreaming, so the extraction (and any future change) is verifiable.
 */
import { describe, expect, test } from "vitest";
import { applyPageOps, type PageApplyView, type PageApplyCtx } from "@/lib/ai/applyPageOps";
import type { ProjectPage, PageEditableField } from "@/lib/types";

const page = (id: string, over: Partial<ProjectPage> = {}): ProjectPage => ({
  id,
  projectId: "p1",
  title: `Page ${id}`,
  html: `<html>${id}</html>`,
  editableFields: [],
  sourceKuId: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const view = (over: Partial<PageApplyView> = {}): PageApplyView => ({
  currentEntityId: null,
  currentEntityType: null,
  pageHtml: "",
  pageEditableFields: [],
  pageVersion: 0,
  activeTab: "doc",
  openTabs: [],
  ...over,
});

const ctx = (over: Partial<PageApplyCtx> = {}): PageApplyCtx => ({
  allowFocusSteal: true,
  stateCurrentEntityId: null,
  basePageVersion: 5,
  makeId: () => "new-id",
  now: () => 1000,
  ...over,
});

const field = (id: string): PageEditableField => ({
  id,
  selector: `#${id}`,
  type: "text",
  currentValue: `val ${id}`,
});

describe("CREATE", () => {
  test("appends a page + records produced; opens & focuses it when focus-steal allowed", () => {
    const fields = [field("f1")];
    const r = applyPageOps(
      [page("a")],
      [{ type: "CREATE", title: "Fresh", html: "<h1>fresh</h1>", editableFields: fields, sourceKuId: "ku9" }],
      view(),
      ctx(),
    );
    expect(r.pages.map((p) => p.id)).toEqual(["a", "new-id"]);
    const created = r.pages[1];
    expect(created.title).toBe("Fresh");
    expect(created.html).toBe("<h1>fresh</h1>");
    expect(created.editableFields).toEqual(fields);
    expect(created.sourceKuId).toBe("ku9");
    expect(created.createdAt).toBe(1000);
    expect(created.updatedAt).toBe(1000);

    expect(r.produced).toEqual([{ id: "new-id", type: "page", title: "Fresh", action: "created" }]);
    expect(r.view.currentEntityId).toBe("new-id");
    expect(r.view.currentEntityType).toBe("page");
    expect(r.view.pageHtml).toBe("<h1>fresh</h1>");
    expect(r.view.pageEditableFields).toEqual(fields);
    expect(r.view.pageVersion).toBe(6); // basePageVersion + 1
    expect(r.view.openTabs).toEqual([{ id: "new-id", type: "page", title: "Fresh" }]);
  });

  test("CREATE never touches activeTab (page block omits it, unlike KU/table)", () => {
    const r = applyPageOps([], [{ type: "CREATE", title: "X", html: "y" }], view({ activeTab: "sheet" }), ctx());
    expect(r.view.activeTab).toBe("sheet"); // untouched
  });

  test("defaults editableFields to [] and sourceKuId to null when omitted", () => {
    const r = applyPageOps([], [{ type: "CREATE", title: "X", html: "y" }], view(), ctx());
    expect(r.pages[0].editableFields).toEqual([]);
    expect(r.pages[0].sourceKuId).toBeNull();
    expect(r.view.pageEditableFields).toEqual([]);
  });

  test("does NOT steal focus when not allowed (still creates + records produced)", () => {
    const r = applyPageOps([], [{ type: "CREATE", title: "Bg", html: "x" }], view(), ctx({ allowFocusSteal: false }));
    expect(r.pages).toHaveLength(1);
    expect(r.produced).toHaveLength(1);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.pageVersion).toBe(0); // unchanged
    expect(r.view.pageHtml).toBe(""); // unchanged
  });
});

describe("UPDATE", () => {
  test("syncs the page view ONLY when the edited page is the originally-open one", () => {
    const open = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "<b>new</b>" }],
      view(),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(open.pages[0].html).toBe("<b>new</b>");
    expect(open.view.pageHtml).toBe("<b>new</b>");
    expect(open.view.pageVersion).toBe(6);
    expect(open.produced).toEqual([{ id: "a", type: "page", title: "Page a", action: "updated" }]);
    expect(open.aiModifiedIds).toEqual(["a"]);

    const other = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "<b>new</b>" }],
      view(),
      ctx({ stateCurrentEntityId: "b" }),
    );
    expect(other.pages[0].html).toBe("<b>new</b>"); // page still edited
    expect(other.view.pageHtml).toBe(""); // view not synced
    expect(other.view.pageVersion).toBe(0);
    expect(other.aiModifiedIds).toEqual(["a"]); // still recorded as modified
  });

  test("editableFields synced into the view only when present on the op AND page is open", () => {
    const fields = [field("g1")];
    const withFields = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "h", editableFields: fields }],
      view({ pageEditableFields: [field("old")] }),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(withFields.pages[0].editableFields).toEqual(fields);
    expect(withFields.view.pageEditableFields).toEqual(fields);

    // present on op but page NOT open -> view fields untouched, page still updated
    const closed = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "h", editableFields: fields }],
      view({ pageEditableFields: [field("old")] }),
      ctx({ stateCurrentEntityId: "z" }),
    );
    expect(closed.pages[0].editableFields).toEqual(fields);
    expect(closed.view.pageEditableFields).toEqual([field("old")]);

    // omitted on op + page open -> view fields untouched, page fields preserved
    const omitted = applyPageOps(
      [page("a", { editableFields: [field("keep")] })],
      [{ type: "UPDATE", pageId: "a", html: "h" }],
      view({ pageEditableFields: [field("old")] }),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(omitted.pages[0].editableFields).toEqual([field("keep")]);
    expect(omitted.view.pageEditableFields).toEqual([field("old")]);
  });

  test("opens the page's tab on focus-steal even when it is not the open editor", () => {
    const r = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "h" }],
      view(),
      ctx({ allowFocusSteal: true, stateCurrentEntityId: "other" }),
    );
    expect(r.view.openTabs).toEqual([{ id: "a", type: "page", title: "Page a" }]);
  });

  test("does NOT open a tab when focus-steal is disallowed", () => {
    const r = applyPageOps(
      [page("a")],
      [{ type: "UPDATE", pageId: "a", html: "h" }],
      view(),
      ctx({ allowFocusSteal: false, stateCurrentEntityId: "a" }),
    );
    expect(r.view.openTabs).toEqual([]);
  });

  test("a missing target id is a no-op", () => {
    const r = applyPageOps([page("a")], [{ type: "UPDATE", pageId: "zzz", html: "x" }], view(), ctx());
    expect(r.pages[0].html).toBe("<html>a</html>");
    expect(r.produced).toEqual([]);
    expect(r.aiModifiedIds).toEqual([]);
  });
});

describe("RENAME", () => {
  test("renames the page and syncs its open-tab title", () => {
    const r = applyPageOps(
      [page("a")],
      [{ type: "RENAME", pageId: "a", title: "Renamed" }],
      view({ openTabs: [{ id: "a", type: "page", title: "Page a" }] }),
      ctx(),
    );
    expect(r.pages[0].title).toBe("Renamed");
    expect(r.view.openTabs).toEqual([{ id: "a", type: "page", title: "Renamed" }]);
  });

  test("missing target id is a no-op", () => {
    const r = applyPageOps([page("a")], [{ type: "RENAME", pageId: "zzz", title: "X" }], view(), ctx());
    expect(r.pages[0].title).toBe("Page a");
  });
});

describe("DELETE", () => {
  test("removes the page + its tab; clears the editor when it was the open one", () => {
    const r = applyPageOps(
      [page("a"), page("b")],
      [{ type: "DELETE", pageId: "a" }],
      view({
        currentEntityId: "a",
        currentEntityType: "page",
        pageHtml: "<html>a</html>",
        pageEditableFields: [field("x")],
        openTabs: [{ id: "a", type: "page", title: "Page a" }],
      }),
      ctx(),
    );
    expect(r.pages.map((p) => p.id)).toEqual(["b"]);
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.currentEntityType).toBeNull();
    expect(r.view.pageHtml).toBe("");
    expect(r.view.pageEditableFields).toEqual([]);
    expect(r.view.pageVersion).toBe(6);
  });

  test("DELETE clears against the EVOLVING view id (set by a prior CREATE focus-steal)", () => {
    // CREATE focus-steals to "new-id", then DELETE of "new-id" clears the editor.
    const r = applyPageOps(
      [],
      [
        { type: "CREATE", title: "Fresh", html: "<h1>f</h1>" },
        { type: "DELETE", pageId: "new-id" },
      ],
      view(),
      ctx(),
    );
    expect(r.pages).toEqual([]);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.pageHtml).toBe("");
    expect(r.view.openTabs).toEqual([]);
  });

  test("deleting a non-open page leaves the editor intact", () => {
    const r = applyPageOps(
      [page("a"), page("b")],
      [{ type: "DELETE", pageId: "b" }],
      view({ currentEntityId: "a", pageHtml: "<html>a</html>" }),
      ctx(),
    );
    expect(r.pages.map((p) => p.id)).toEqual(["a"]);
    expect(r.view.currentEntityId).toBe("a");
    expect(r.view.pageHtml).toBe("<html>a</html>");
  });
});

describe("purity", () => {
  test("does not mutate the input arrays/objects", () => {
    const input = [page("a")];
    const tabs = [{ id: "a", type: "page" as const, title: "Page a" }];
    const v = view({ openTabs: tabs });
    applyPageOps(input, [{ type: "CREATE", title: "X", html: "y" }], v, ctx());
    expect(input).toHaveLength(1); // original untouched
    expect(tabs).toHaveLength(1);
    expect(v.openTabs).toHaveLength(1);
    expect(v.currentEntityId).toBeNull(); // passed view untouched
  });
});
