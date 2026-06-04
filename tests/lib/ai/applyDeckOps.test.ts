/**
 * applyDeckOps — characterization tests pinning the exact behavior lifted out of
 * finishStreaming, so the extraction (and any future change) is verifiable.
 */
import { describe, expect, test } from "vitest";
import { applyDeckOps, type DeckApplyView, type DeckApplyCtx } from "@/lib/ai/applyDeckOps";
import type { ProjectDeck, DeckSlide, HtmlDeckSlide } from "@/lib/types";

// A structured (non-HTML) slide.
const slide = (id: string, over: Partial<DeckSlide> = {}): DeckSlide => ({
  id,
  layout: "title",
  title: `Slide ${id}`,
  ...over,
});

// An HTML slide (isHtmlSlide → true: has `html`, no `layout`).
const htmlSlide = (id: string, over: Partial<HtmlDeckSlide> = {}): HtmlDeckSlide => ({
  id,
  html: `<section>${id}</section>`,
  editableFields: [],
  ...over,
});

const deck = (id: string, over: Partial<ProjectDeck> = {}): ProjectDeck => ({
  id,
  projectId: "p1",
  title: `Deck ${id}`,
  theme: "pitch",
  style: null,
  slides: [slide(`${id}-s1`)],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const view = (over: Partial<DeckApplyView> = {}): DeckApplyView => ({
  currentEntityId: null,
  currentEntityType: null,
  deckSlides: [],
  deckTheme: "pitch",
  deckVersion: 0,
  deckPhase: "idle",
  deckStyle: null,
  pendingDeckPolishId: null,
  activeTab: "doc",
  openTabs: [],
  ...over,
});

const ctx = (over: Partial<DeckApplyCtx> = {}): DeckApplyCtx => ({
  allowFocusSteal: true,
  stateCurrentEntityId: null,
  baseDeckVersion: 5,
  makeId: () => "new-id",
  now: () => 1000,
  ...over,
});

describe("CREATE", () => {
  test("appends a deck + records produced; opens, views & sets phase when focus-steal allowed", () => {
    const r = applyDeckOps(
      [deck("a")],
      [{ type: "CREATE", title: "Fresh", slides: [slide("x")] }],
      view(),
      ctx(),
    );
    expect(r.decks.map((d) => d.id)).toEqual(["a", "new-id"]);
    expect(r.produced).toEqual([{ id: "new-id", type: "deck", title: "Fresh", action: "created" }]);
    expect(r.view.currentEntityId).toBe("new-id");
    expect(r.view.currentEntityType).toBe("deck");
    expect(r.view.deckSlides).toEqual([slide("x")]);
    expect(r.view.deckTheme).toBe("pitch");
    expect(r.view.deckVersion).toBe(6); // baseDeckVersion + 1
    expect(r.view.deckPhase).toBe("viewing");
    expect(r.view.openTabs).toEqual([{ id: "new-id", type: "deck", title: "Fresh" }]);
    // structured-only slides (no imageQuery) → no polish, no bg fetch
    expect(r.view.pendingDeckPolishId).toBeNull();
    expect(r.bgImageFetches).toEqual([]);
  });

  test("defaults theme to 'pitch' when op.theme is absent and honors a provided theme", () => {
    const r = applyDeckOps([], [{ type: "CREATE", title: "T", theme: "mono", slides: [] }], view(), ctx());
    expect(r.decks[0].theme).toBe("mono");
    expect(r.view.deckTheme).toBe("mono");
  });

  test("does NOT steal focus when not allowed (still creates + records produced, no polish queued)", () => {
    const r = applyDeckOps(
      [],
      [{ type: "CREATE", title: "Bg", slides: [htmlSlide("h")] }],
      view(),
      ctx({ allowFocusSteal: false }),
    );
    expect(r.decks).toHaveLength(1);
    expect(r.produced).toHaveLength(1);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.deckVersion).toBe(0); // unchanged
    expect(r.view.deckPhase).toBe("idle"); // unchanged
    expect(r.view.pendingDeckPolishId).toBeNull(); // polish is inside the focus-steal gate
  });

  test("queues pendingDeckPolishId ONLY for decks with at least one HTML slide (focus-steal on)", () => {
    const html = applyDeckOps([], [{ type: "CREATE", title: "H", slides: [htmlSlide("h")] }], view(), ctx());
    expect(html.view.pendingDeckPolishId).toBe("new-id");

    const mixed = applyDeckOps([], [{ type: "CREATE", title: "M", slides: [slide("s"), htmlSlide("h")] }], view(), ctx());
    expect(mixed.view.pendingDeckPolishId).toBe("new-id");

    const structured = applyDeckOps([], [{ type: "CREATE", title: "S", slides: [slide("s")] }], view(), ctx());
    expect(structured.view.pendingDeckPolishId).toBeNull();
  });

  test("validates op.style via validateThemeConfig (invalid → null style)", () => {
    const r = applyDeckOps(
      [],
      [{ type: "CREATE", title: "Styled", slides: [], style: { not: "a-theme" } as never }],
      view(),
      ctx(),
    );
    expect(r.decks[0].style).toBeNull();
    expect(r.view.deckStyle).toBeNull();
  });

  test("surfaces bgImageFetches for non-HTML slides with imageQuery and no backgroundImage", () => {
    const needs = slide("needs", { imageQuery: "mountains" });
    const hasImg = slide("has", { imageQuery: "ocean", backgroundImage: "http://x" });
    const html = htmlSlide("h", { imageQuery: "ignored" }); // HTML slides excluded
    const r = applyDeckOps(
      [],
      [{ type: "CREATE", title: "Q", slides: [needs, hasImg, html] }],
      view(),
      ctx(),
    );
    expect(r.bgImageFetches).toEqual([{ deckId: "new-id", slides: [needs] }]);
  });
});

describe("UPDATE", () => {
  test("syncs the live deck buffer ONLY when the edited deck is the open one", () => {
    const open = applyDeckOps(
      [deck("a")],
      [{ type: "UPDATE", deckId: "a", slides: [slide("new")] }],
      view(),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(open.decks[0].slides).toEqual([slide("new")]);
    expect(open.view.deckSlides).toEqual([slide("new")]);
    expect(open.view.deckVersion).toBe(6);
    expect(open.aiModifiedIds).toEqual(["a"]);
    expect(open.produced).toEqual([{ id: "a", type: "deck", title: "Deck a", action: "updated" }]);

    const other = applyDeckOps(
      [deck("a")],
      [{ type: "UPDATE", deckId: "a", slides: [slide("new")] }],
      view(),
      ctx({ stateCurrentEntityId: "b" }),
    );
    expect(other.decks[0].slides).toEqual([slide("new")]); // persisted regardless
    expect(other.view.deckSlides).toEqual([]); // live buffer NOT synced
    expect(other.view.deckVersion).toBe(0);
    expect(other.aiModifiedIds).toEqual(["a"]); // still recorded as modified
  });

  test("applies optional theme/style to the deck and (when open) the live buffer", () => {
    const r = applyDeckOps(
      [deck("a")],
      [{ type: "UPDATE", deckId: "a", slides: [slide("s")], theme: "bold" }],
      view(),
      ctx({ stateCurrentEntityId: "a" }),
    );
    expect(r.decks[0].theme).toBe("bold");
    expect(r.view.deckTheme).toBe("bold");
  });

  test("auto-opens a tab for the updated deck on focus-steal", () => {
    const r = applyDeckOps(
      [deck("a")],
      [{ type: "UPDATE", deckId: "a", slides: [] }],
      view(),
      ctx(),
    );
    expect(r.view.openTabs).toEqual([{ id: "a", type: "deck", title: "Deck a" }]);
  });

  test("a missing target id is a no-op", () => {
    const r = applyDeckOps([deck("a")], [{ type: "UPDATE", deckId: "zzz", slides: [slide("x")] }], view(), ctx());
    expect(r.decks[0].slides).toEqual([slide("a-s1")]);
    expect(r.produced).toEqual([]);
    expect(r.aiModifiedIds).toEqual([]);
  });
});

describe("RENAME", () => {
  test("renames the deck and syncs its open-tab title", () => {
    const r = applyDeckOps(
      [deck("a")],
      [{ type: "RENAME", deckId: "a", title: "Renamed" }],
      view({ openTabs: [{ id: "a", type: "deck", title: "Deck a" }] }),
      ctx(),
    );
    expect(r.decks[0].title).toBe("Renamed");
    expect(r.view.openTabs).toEqual([{ id: "a", type: "deck", title: "Renamed" }]);
  });
});

describe("DELETE", () => {
  test("removes the deck + its tab; clears the live buffer when it was the open one", () => {
    const r = applyDeckOps(
      [deck("a"), deck("b")],
      [{ type: "DELETE", deckId: "a" }],
      view({
        currentEntityId: "a",
        currentEntityType: "deck",
        deckSlides: [slide("a-s1")],
        openTabs: [{ id: "a", type: "deck", title: "Deck a" }],
      }),
      ctx(),
    );
    expect(r.decks.map((d) => d.id)).toEqual(["b"]);
    expect(r.view.openTabs).toEqual([]);
    expect(r.view.currentEntityId).toBeNull();
    expect(r.view.currentEntityType).toBeNull();
    expect(r.view.deckSlides).toEqual([]);
    expect(r.view.deckVersion).toBe(6);
  });

  test("deleting a non-open deck leaves the live buffer intact (checks EVOLVING view id)", () => {
    const r = applyDeckOps(
      [deck("a"), deck("b")],
      [{ type: "DELETE", deckId: "b" }],
      view({ currentEntityId: "a", deckSlides: [slide("a-s1")] }),
      ctx(),
    );
    expect(r.decks.map((d) => d.id)).toEqual(["a"]);
    expect(r.view.currentEntityId).toBe("a");
    expect(r.view.deckSlides).toEqual([slide("a-s1")]);
    expect(r.view.deckVersion).toBe(0);
  });
});

describe("purity", () => {
  test("does not mutate the input arrays / view", () => {
    const input = [deck("a")];
    const tabs = [{ id: "a", type: "deck" as const, title: "Deck a" }];
    const v = view({ openTabs: tabs });
    applyDeckOps(input, [{ type: "CREATE", title: "X", slides: [] }], v, ctx());
    expect(input).toHaveLength(1); // original untouched
    expect(tabs).toHaveLength(1);
    expect(v.openTabs).toBe(tabs); // the original tabs array reference is not reassigned
  });
});
