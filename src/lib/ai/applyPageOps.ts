/**
 * applyPageOps — pure application of HTML-page (`pageops`) operations.
 *
 * T3 slice 3 (see applyKuOps / applyTableOps for the pattern). Lifts the page op
 * switch out of `finishStreaming` VERBATIM so it is unit-testable in isolation.
 * Threads the project's page array AND the page editor flat-fields (current
 * entity, page html, editable fields, pageVersion, active tab, open tabs).
 *
 * Behaviour is intentionally identical to the prior inline code:
 *  - CREATE: append a page; if focus-steal is allowed, open + focus it (set html,
 *    editableFields, bump pageVersion, open tab). Unlike KU/table CREATE, the page
 *    block does NOT touch activeTab — preserved here exactly.
 *  - UPDATE: edit html (+ editableFields when present); sync the page view only if
 *    the edited page is the one originally open (`stateCurrentEntityId`); open its
 *    tab on focus-steal; record produced + aiModifiedIds.
 *  - RENAME: rename + sync the tab title.
 *  - DELETE: remove the page + its tab; clear the editor if it was the open one
 *    (checked against the EVOLVING `view.currentEntityId`, not the original).
 *
 * pageVersion bumps always go to `basePageVersion + 1` (matching the original,
 * which used `state.pageVersion + 1` every time, not a running counter).
 */

import { nanoid } from "nanoid";
import type {
  PageOperation,
  ProjectPage,
  PageEditableField,
  ProducedEntity,
  EntityType,
  WorkspaceTab,
} from "@/lib/types";

export type OpenTab = { id: string; type: EntityType; title: string };

/** The flat page editor fields page ops can touch (threaded through finishStreaming). */
export interface PageApplyView {
  currentEntityId: string | null;
  currentEntityType: EntityType | null;
  pageHtml: string;
  pageEditableFields: PageEditableField[];
  pageVersion: number;
  activeTab: WorkspaceTab;
  openTabs: OpenTab[];
}

export interface PageApplyCtx {
  /** Whether this turn is allowed to steal focus / open tabs (active project only). */
  allowFocusSteal: boolean;
  /** The ORIGINAL open entity id (UPDATE syncs the page view only for it). */
  stateCurrentEntityId: string | null;
  /** state.pageVersion — every bump is basePageVersion + 1, matching the original. */
  basePageVersion: number;
  /** id factory (injectable for deterministic tests). */
  makeId?: () => string;
  /** clock (injectable for deterministic tests). */
  now?: () => number;
}

export interface PageApplyResult {
  pages: ProjectPage[];
  view: PageApplyView;
  produced: ProducedEntity[];
  aiModifiedIds: string[];
}

export function applyPageOps(
  pages: ProjectPage[],
  ops: PageOperation[],
  view: PageApplyView,
  ctx: PageApplyCtx,
): PageApplyResult {
  const id = ctx.makeId ?? nanoid;
  const now = ctx.now ?? Date.now;
  const projectId = pages[0]?.projectId ?? "";

  const next = [...pages];
  const v: PageApplyView = { ...view, openTabs: [...view.openTabs] };
  const produced: ProducedEntity[] = [];
  const aiModifiedIds: string[] = [];

  for (const op of ops) {
    switch (op.type) {
      case "CREATE": {
        const newPage: ProjectPage = {
          id: id(),
          projectId,
          title: op.title,
          html: op.html,
          editableFields: op.editableFields || [],
          sourceKuId: op.sourceKuId || null,
          createdAt: now(),
          updatedAt: now(),
        };
        next.push(newPage);
        produced.push({ id: newPage.id, type: "page", title: newPage.title, action: "created" });
        if (ctx.allowFocusSteal) {
          v.currentEntityId = newPage.id;
          v.currentEntityType = "page";
          v.pageHtml = newPage.html;
          v.pageEditableFields = newPage.editableFields || [];
          v.pageVersion = ctx.basePageVersion + 1;
          if (!v.openTabs.some((t) => t.id === newPage.id)) {
            v.openTabs = [...v.openTabs, { id: newPage.id, type: "page" as const, title: newPage.title }];
          }
        }
        break;
      }
      case "UPDATE": {
        const idx = next.findIndex((pg) => pg.id === op.pageId);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            html: op.html,
            ...(op.editableFields ? { editableFields: op.editableFields } : {}),
            updatedAt: now(),
          };
          if (ctx.stateCurrentEntityId === op.pageId) {
            v.pageHtml = op.html;
            if (op.editableFields) v.pageEditableFields = op.editableFields;
            v.pageVersion = ctx.basePageVersion + 1;
          }
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.pageId)) {
            const entity = next[idx];
            v.openTabs = [...v.openTabs, { id: entity.id, type: "page" as const, title: entity.title }];
          }
          produced.push({ id: op.pageId, type: "page", title: next[idx].title, action: "updated" });
          aiModifiedIds.push(op.pageId);
        }
        break;
      }
      case "RENAME": {
        const idx = next.findIndex((pg) => pg.id === op.pageId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], title: op.title, updatedAt: now() };
          v.openTabs = v.openTabs.map((t) => (t.id === op.pageId ? { ...t, title: op.title } : t));
        }
        break;
      }
      case "DELETE": {
        const filtered = next.filter((pg) => pg.id !== op.pageId);
        next.length = 0;
        next.push(...filtered);
        v.openTabs = v.openTabs.filter((t) => t.id !== op.pageId);
        if (v.currentEntityId === op.pageId) {
          v.currentEntityId = null;
          v.currentEntityType = null;
          v.pageHtml = "";
          v.pageEditableFields = [];
          v.pageVersion = ctx.basePageVersion + 1;
        }
        break;
      }
    }
  }

  return { pages: next, view: v, produced, aiModifiedIds };
}
