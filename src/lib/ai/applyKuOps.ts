/**
 * applyKuOps — pure application of knowledge-unit (`kuops`) operations.
 *
 * FIRST real slice of de-godding `store.ts` `finishStreaming` (T3). The KU block
 * was ~100 lines inlined in that 600-line function, threading the project's KU
 * array AND the flat editor fields (current entity, doc content/version, active
 * tab, open tabs) through a switch. Lifted here VERBATIM so it can be unit-tested
 * in isolation; `finishStreaming` now calls it and reads the result back.
 *
 * Behaviour is intentionally identical to the prior inline code:
 *  - CREATE: append a KU; if focus-steal is allowed, open + focus it.
 *  - UPDATE/APPEND: edit content; bump the doc view only if the edited KU is the
 *    one currently open (`stateCurrentEntityId`); open its tab on focus-steal.
 *  - RENAME: rename + sync the tab title.
 *  - DELETE: remove the KU + its tab; clear the editor if it was the open one
 *    (checked against the EVOLVING `view.currentEntityId`, not the original).
 *
 * Doc-version bumps always go to `baseDocVersion + 1` (matching the original,
 * which used `state.docVersion + 1` every time, not a running counter).
 */

import { nanoid } from "nanoid";
import type {
  KnowledgeUnit,
  KuOperation,
  ProducedEntity,
  EntityType,
  WorkspaceTab,
} from "@/lib/types";

export type OpenTab = { id: string; type: EntityType; title: string };

/** The flat editor fields KU ops can touch (threaded through finishStreaming). */
export interface KuApplyView {
  currentEntityId: string | null;
  currentEntityType: EntityType | null;
  docContent: string;
  docVersion: number;
  activeTab: WorkspaceTab;
  openTabs: OpenTab[];
}

export interface KuApplyCtx {
  /** Whether this turn is allowed to steal focus / open tabs (active project only). */
  allowFocusSteal: boolean;
  /** The ORIGINAL open entity id (UPDATE/APPEND sync the doc only for it). */
  stateCurrentEntityId: string | null;
  /** state.docVersion — every bump is baseDocVersion + 1, matching the original. */
  baseDocVersion: number;
  /** id factory (injectable for deterministic tests). */
  makeId?: () => string;
  /** clock (injectable for deterministic tests). */
  now?: () => number;
}

export interface KuApplyResult {
  knowledgeUnits: KnowledgeUnit[];
  view: KuApplyView;
  produced: ProducedEntity[];
  aiModifiedIds: string[];
}

export function applyKuOps(
  knowledgeUnits: KnowledgeUnit[],
  ops: KuOperation[],
  view: KuApplyView,
  ctx: KuApplyCtx,
): KuApplyResult {
  const id = ctx.makeId ?? nanoid;
  const now = ctx.now ?? Date.now;
  const projectId = knowledgeUnits[0]?.projectId ?? "";

  const kus = [...knowledgeUnits];
  const v: KuApplyView = { ...view, openTabs: [...view.openTabs] };
  const produced: ProducedEntity[] = [];
  const aiModifiedIds: string[] = [];

  for (const op of ops) {
    switch (op.type) {
      case "CREATE": {
        const newKu: KnowledgeUnit = {
          id: id(),
          projectId,
          title: op.title,
          content: op.content,
          createdAt: now(),
          updatedAt: now(),
        };
        kus.push(newKu);
        produced.push({ id: newKu.id, type: "ku", title: newKu.title, action: "created" });
        if (ctx.allowFocusSteal) {
          v.currentEntityId = newKu.id;
          v.currentEntityType = "ku";
          v.docContent = newKu.content;
          v.docVersion = ctx.baseDocVersion + 1;
          v.activeTab = "doc";
          if (!v.openTabs.some((t) => t.id === newKu.id)) {
            v.openTabs = [...v.openTabs, { id: newKu.id, type: "ku", title: newKu.title }];
          }
        }
        break;
      }
      case "UPDATE": {
        const idx = kus.findIndex((k) => k.id === op.kuId);
        if (idx >= 0) {
          kus[idx] = { ...kus[idx], content: op.content, updatedAt: now() };
          if (ctx.stateCurrentEntityId === op.kuId) {
            v.docContent = op.content;
            v.docVersion = ctx.baseDocVersion + 1;
          }
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.kuId)) {
            const entity = kus[idx];
            v.openTabs = [...v.openTabs, { id: entity.id, type: "ku", title: entity.title }];
          }
          produced.push({ id: op.kuId, type: "ku", title: kus[idx].title, action: "updated" });
          aiModifiedIds.push(op.kuId);
        }
        break;
      }
      case "APPEND": {
        const idx = kus.findIndex((k) => k.id === op.kuId);
        if (idx >= 0) {
          const existing = kus[idx];
          kus[idx] = { ...existing, content: existing.content + "\n\n" + op.content, updatedAt: now() };
          if (ctx.stateCurrentEntityId === op.kuId) {
            v.docContent = kus[idx].content;
            v.docVersion = ctx.baseDocVersion + 1;
          }
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.kuId)) {
            const entity = kus[idx];
            v.openTabs = [...v.openTabs, { id: entity.id, type: "ku", title: entity.title }];
          }
          produced.push({ id: op.kuId, type: "ku", title: kus[idx].title, action: "updated" });
          aiModifiedIds.push(op.kuId);
        }
        break;
      }
      case "RENAME": {
        const idx = kus.findIndex((k) => k.id === op.kuId);
        if (idx >= 0) {
          kus[idx] = { ...kus[idx], title: op.title, updatedAt: now() };
          v.openTabs = v.openTabs.map((t) => (t.id === op.kuId ? { ...t, title: op.title } : t));
        }
        break;
      }
      case "DELETE": {
        const next = kus.filter((k) => k.id !== op.kuId);
        kus.length = 0;
        kus.push(...next);
        v.openTabs = v.openTabs.filter((t) => t.id !== op.kuId);
        if (v.currentEntityId === op.kuId) {
          v.currentEntityId = null;
          v.currentEntityType = null;
          v.docContent = "";
          v.docVersion = ctx.baseDocVersion + 1;
        }
        break;
      }
    }
  }

  return { knowledgeUnits: kus, view: v, produced, aiModifiedIds };
}
