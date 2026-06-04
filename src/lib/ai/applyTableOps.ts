/**
 * applyTableOps — pure application of spreadsheet (`tableops`) operations.
 *
 * T3 slice 2 (see applyKuOps for the pattern). Lifts the table op switch out of
 * `finishStreaming` verbatim so it is unit-testable. Threads the project's table
 * array AND the sheet editor flat-fields (current entity, sheets, sheetVersion,
 * active tab, open tabs).
 *
 * Behaviour is identical to the prior inline code:
 *  - CREATE: append a 1-sheet table (cells normalized); open + focus on focus-steal.
 *  - UPDATE_CELLS: merge cells into the addressed sheet (by `${r},${c}` key); sync
 *    the grid only when the edited table is the open one; open its tab on focus-steal.
 *  - SET_TABLE_DATA: shallow-merge `op.data` into the addressed sheet; same sync rules.
 *  - DELETE: remove the table + its tab; reset the grid to a blank sheet if it was open.
 *
 * Sheet-version bumps always go to `baseSheetVersion + 1` (matching the original's
 * `state.sheetVersion + 1` every time). The DELETE blank sheet intentionally omits
 * `config` exactly like the original.
 */

import { nanoid } from "nanoid";
import { normalizeCells } from "@/lib/ai/sheetOperations";
import type {
  ProjectTable,
  TableOperation,
  SheetData,
  ProducedEntity,
  EntityType,
  WorkspaceTab,
} from "@/lib/types";

export type OpenTab = { id: string; type: EntityType; title: string };

/** The sheet editor flat-fields table ops can touch. */
export interface TableApplyView {
  currentEntityId: string | null;
  currentEntityType: EntityType | null;
  sheets: SheetData[];
  sheetVersion: number;
  activeTab: WorkspaceTab;
  openTabs: OpenTab[];
}

export interface TableApplyCtx {
  allowFocusSteal: boolean;
  /** The ORIGINAL open entity id (UPDATE/SET sync the grid only for it). */
  stateCurrentEntityId: string | null;
  /** state.sheetVersion — every bump is baseSheetVersion + 1, matching the original. */
  baseSheetVersion: number;
  makeId?: () => string;
  now?: () => number;
}

export interface TableApplyResult {
  tables: ProjectTable[];
  view: TableApplyView;
  produced: ProducedEntity[];
  aiModifiedIds: string[];
}

export function applyTableOps(
  tables: ProjectTable[],
  ops: TableOperation[],
  view: TableApplyView,
  ctx: TableApplyCtx,
): TableApplyResult {
  const id = ctx.makeId ?? nanoid;
  const now = ctx.now ?? Date.now;
  const projectId = tables[0]?.projectId ?? "";

  const next = [...tables];
  const v: TableApplyView = { ...view, openTabs: [...view.openTabs] };
  const produced: ProducedEntity[] = [];
  const aiModifiedIds: string[] = [];

  for (const op of ops) {
    switch (op.type) {
      case "CREATE": {
        const newTable: ProjectTable = {
          id: id(),
          projectId,
          title: op.title,
          sheets: [
            {
              name: "Sheet1",
              order: 0,
              status: 1,
              celldata: normalizeCells(op.celldata || []),
              config: op.config || {},
              row: 50,
              column: 26,
            },
          ],
          createdAt: now(),
          updatedAt: now(),
        };
        next.push(newTable);
        produced.push({ id: newTable.id, type: "table", title: newTable.title, action: "created" });
        if (ctx.allowFocusSteal) {
          v.currentEntityId = newTable.id;
          v.currentEntityType = "table";
          v.sheets = newTable.sheets;
          v.sheetVersion = ctx.baseSheetVersion + 1;
          v.activeTab = "sheet";
          if (!v.openTabs.some((t) => t.id === newTable.id)) {
            v.openTabs = [...v.openTabs, { id: newTable.id, type: "table", title: newTable.title }];
          }
        }
        break;
      }
      case "UPDATE_CELLS": {
        const idx = next.findIndex((t) => t.id === op.tableId);
        if (idx >= 0) {
          const table = { ...next[idx] };
          table.sheets = [...table.sheets];
          const si = op.sheetIndex || 0;
          if (table.sheets[si]) {
            const sheet = { ...table.sheets[si] };
            const cellMap = new Map((sheet.celldata || []).map((c) => [`${c.r},${c.c}`, c]));
            for (const cell of normalizeCells(op.cells || [])) {
              cellMap.set(`${cell.r},${cell.c}`, cell);
            }
            sheet.celldata = Array.from(cellMap.values());
            table.sheets[si] = sheet;
          }
          table.updatedAt = now();
          next[idx] = table;
          if (ctx.stateCurrentEntityId === op.tableId) {
            v.sheets = table.sheets;
            v.sheetVersion = ctx.baseSheetVersion + 1;
          }
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.tableId)) {
            v.openTabs = [...v.openTabs, { id: table.id, type: "table", title: table.title }];
          }
          produced.push({ id: op.tableId, type: "table", title: table.title, action: "updated" });
          aiModifiedIds.push(op.tableId);
        }
        break;
      }
      case "SET_TABLE_DATA": {
        const idx = next.findIndex((t) => t.id === op.tableId);
        if (idx >= 0) {
          const table = { ...next[idx] };
          table.sheets = [...table.sheets];
          const si = op.sheetIndex || 0;
          if (table.sheets[si]) {
            table.sheets[si] = { ...table.sheets[si], ...op.data };
          }
          table.updatedAt = now();
          next[idx] = table;
          if (ctx.stateCurrentEntityId === op.tableId) {
            v.sheets = table.sheets;
            v.sheetVersion = ctx.baseSheetVersion + 1;
          }
          if (ctx.allowFocusSteal && !v.openTabs.some((t) => t.id === op.tableId)) {
            v.openTabs = [...v.openTabs, { id: table.id, type: "table", title: table.title }];
          }
          produced.push({ id: op.tableId, type: "table", title: table.title, action: "updated" });
          aiModifiedIds.push(op.tableId);
        }
        break;
      }
      case "DELETE": {
        const filtered = next.filter((t) => t.id !== op.tableId);
        next.length = 0;
        next.push(...filtered);
        v.openTabs = v.openTabs.filter((t) => t.id !== op.tableId);
        if (v.currentEntityId === op.tableId) {
          v.currentEntityId = null;
          v.currentEntityType = null;
          v.sheets = [{ name: "Sheet1", order: 0, status: 1, celldata: [], row: 50, column: 26 }];
          v.sheetVersion = ctx.baseSheetVersion + 1;
        }
        break;
      }
    }
  }

  return { tables: next, view: v, produced, aiModifiedIds };
}
