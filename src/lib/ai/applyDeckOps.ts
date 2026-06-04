/**
 * applyDeckOps — pure application of deck (`deckops`) operations.
 *
 * T3 slice 3 (see applyKuOps / applyTableOps for the pattern). Lifts the deck op
 * switch out of `finishStreaming` verbatim so it is unit-testable. Threads the
 * project's deck array AND the deck editor flat-fields (current entity, deck
 * slides/theme/style, deckVersion, deckPhase, pending-polish id, active tab,
 * open tabs).
 *
 * Behaviour is intentionally identical to the prior inline code:
 *  - CREATE: append a deck (style validated via validateThemeConfig). On
 *    focus-steal: open + view it, set phase to "viewing", bump the version, and
 *    queue a background polish pass ONLY when the deck has at least one HTML
 *    slide (`slides.some(isHtmlSlide)`). Slides that carry an `imageQuery` (and
 *    no backgroundImage, non-HTML) are surfaced in `bgImageFetches` so the
 *    caller can run the (impure) Unsplash background fetch — the reducer itself
 *    stays pure and performs no I/O.
 *  - UPDATE: replace slides (+ optional theme/style); sync the live deck buffer
 *    only when the edited deck is the one currently open (`stateCurrentEntityId`,
 *    i.e. the ORIGINAL open id); open its tab on focus-steal.
 *  - RENAME: rename + sync the tab title.
 *  - DELETE: remove the deck + its tab; clear the live deck buffer if it was the
 *    open one (checked against the EVOLVING `view.currentEntityId`, matching the
 *    original's `newCurrentEntityId`).
 *
 * Deck-version bumps always go to `baseDeckVersion + 1` (matching the original's
 * `state.deckVersion + 1` every time, not a running counter). Note CREATE does
 * NOT touch `activeTab` (the original deck path never set it); it sets
 * `deckPhase = "viewing"` instead.
 */

import { nanoid } from "nanoid";
import { validateThemeConfig } from "@/lib/ai/parseAIResponse";
import {
  isHtmlSlide,
  type ProjectDeck,
  type DeckOperation,
  type DeckSlide,
  type HtmlDeckSlide,
  type DeckTheme,
  type DeckPhase,
  type ProducedEntity,
  type EntityType,
  type WorkspaceTab,
} from "@/lib/types";

export type OpenTab = { id: string; type: EntityType; title: string };

/** The deck editor flat-fields deck ops can touch. */
export interface DeckApplyView {
  currentEntityId: string | null;
  currentEntityType: EntityType | null;
  deckSlides: (DeckSlide | HtmlDeckSlide)[];
  deckTheme: DeckTheme;
  deckVersion: number;
  deckPhase: DeckPhase;
  deckStyle: ProjectDeck["style"];
  pendingDeckPolishId: string | null;
  activeTab: WorkspaceTab;
  openTabs: OpenTab[];
}

export interface DeckApplyCtx {
  /** Whether this turn is allowed to steal focus / open tabs (active project only). */
  allowFocusSteal: boolean;
  /** The ORIGINAL open entity id (UPDATE syncs the live deck only for it). */
  stateCurrentEntityId: string | null;
  /** state.deckVersion — every bump is baseDeckVersion + 1, matching the original. */
  baseDeckVersion: number;
  /** id factory (injectable for deterministic tests). */
  makeId?: () => string;
  /** clock (injectable for deterministic tests). */
  now?: () => number;
}

/**
 * A freshly-created deck that has non-HTML slides carrying an `imageQuery` (and
 * no backgroundImage yet). The reducer is pure, so the actual Unsplash fetch +
 * live-store merge is left to the caller; this just hands back the deck id and
 * the slides that need a background image (verbatim filter from the original).
 */
export interface DeckBgImageFetch {
  deckId: string;
  slides: (DeckSlide | HtmlDeckSlide)[];
}

export interface DeckApplyResult {
  decks: ProjectDeck[];
  view: DeckApplyView;
  produced: ProducedEntity[];
  aiModifiedIds: string[];
  /** Background-image fetch requests produced by CREATE (impure; caller runs). */
  bgImageFetches: DeckBgImageFetch[];
}

export function applyDeckOps(
  decks: ProjectDeck[],
  ops: DeckOperation[],
  view: DeckApplyView,
  ctx: DeckApplyCtx,
): DeckApplyResult {
  const id = ctx.makeId ?? nanoid;
  const now = ctx.now ?? Date.now;
  const projectId = decks[0]?.projectId ?? "";

  const next = [...decks];
  const v: DeckApplyView = { ...view, openTabs: [...view.openTabs] };
  const produced: ProducedEntity[] = [];
  const aiModifiedIds: string[] = [];
  const bgImageFetches: DeckBgImageFetch[] = [];

  for (const op of ops) {
    switch (op.type) {
      case "CREATE": {
        const validatedStyle = op.style ? validateThemeConfig(op.style) : null;
        const newDeck: ProjectDeck = {
          id: id(),
          projectId,
          title: op.title,
          theme: op.theme || "pitch",
          style: validatedStyle,
          slides: op.slides || [],
          createdAt: now(),
          updatedAt: now(),
        };
        next.push(newDeck);
        produced.push({ id: newDeck.id, type: "deck", title: newDeck.title, action: "created" });
        // Open + view the new deck only when we may steal focus. The polish pass
        // reads the live deck buffer, so it too is gated — we never polish a deck
        // that isn't loaded on screen.
        if (ctx.allowFocusSteal) {
          v.currentEntityId = newDeck.id;
          v.currentEntityType = "deck";
          v.deckSlides = newDeck.slides;
          v.deckTheme = newDeck.theme;
          v.deckStyle = validatedStyle;
          v.deckVersion = ctx.baseDeckVersion + 1;
          // Transition to viewing phase after generation
          v.deckPhase = "viewing";
          // Queue a background polish pass for freshly-generated HTML decks.
          if (newDeck.slides.some((s) => isHtmlSlide(s))) {
            v.pendingDeckPolishId = newDeck.id;
          }
          if (!v.openTabs.some((t) => t.id === newDeck.id)) {
            v.openTabs = [...v.openTabs, { id: newDeck.id, type: "deck" as const, title: newDeck.title }];
          }
        }
        // Auto-fetch background images for slides with imageQuery (impure; the
        // caller runs the actual Unsplash fetch + live-store merge).
        const slidesWithQuery = newDeck.slides.filter((s) => !isHtmlSlide(s) && s.imageQuery && !s.backgroundImage);
        if (slidesWithQuery.length > 0) {
          bgImageFetches.push({ deckId: newDeck.id, slides: slidesWithQuery });
        }
        break;
      }
      case "UPDATE": {
        const idx = next.findIndex((d) => d.id === op.deckId);
        if (idx >= 0) {
          const updatedStyle = op.style ? validateThemeConfig(op.style) : undefined;
          next[idx] = {
            ...next[idx],
            slides: op.slides,
            ...(op.theme ? { theme: op.theme } : {}),
            ...(updatedStyle ? { style: updatedStyle } : {}),
            updatedAt: now(),
          };
          if (ctx.stateCurrentEntityId === op.deckId) {
            v.deckSlides = op.slides;
            if (op.theme) v.deckTheme = op.theme;
            if (updatedStyle) v.deckStyle = updatedStyle;
            v.deckVersion = ctx.baseDeckVersion + 1;
          }
          // Auto-open tab for updated deck (only when we may steal focus)
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.deckId)) {
            const entity = next[idx];
            v.openTabs = [...v.openTabs, { id: entity.id, type: "deck" as const, title: entity.title }];
          }
          produced.push({ id: op.deckId, type: "deck", title: next[idx].title, action: "updated" });
          aiModifiedIds.push(op.deckId);
        }
        break;
      }
      case "DELETE": {
        const filtered = next.filter((d) => d.id !== op.deckId);
        next.length = 0;
        next.push(...filtered);
        v.openTabs = v.openTabs.filter((t) => t.id !== op.deckId);
        if (v.currentEntityId === op.deckId) {
          v.currentEntityId = null;
          v.currentEntityType = null;
          v.deckSlides = [];
          v.deckVersion = ctx.baseDeckVersion + 1;
        }
        break;
      }
      case "RENAME": {
        const idx = next.findIndex((d) => d.id === op.deckId);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            title: op.title,
            updatedAt: now(),
          };
          v.openTabs = v.openTabs.map((t) => (t.id === op.deckId ? { ...t, title: op.title } : t));
        }
        break;
      }
    }
  }

  return { decks: next, view: v, produced, aiModifiedIds, bgImageFetches };
}
