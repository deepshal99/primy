/**
 * opPlan — pure classification of a parsed operation bundle.
 *
 * First slice of de-godding store.ts: the "what does this turn contain"
 * decision logic, lifted out of the inline computations duplicated in
 * ChatPanel and the store, into one pure, unit-tested place. It does NOT (yet)
 * own the Immer mutation that APPLIES ops — that deeper extraction is tracked
 * separately. This slice is what the failure-surface (T1) and the chat UI both
 * read to decide "did a deliverable silently drop?".
 */

import type {
  SheetOperation,
  DocOperation,
  KuOperation,
  TableOperation,
  DeckOperation,
  PageOperation,
} from "@/lib/types";
import type { OpFamily, OpFamilyCounts } from "./opParseFailures";

export interface OpBundle {
  sheetOps: SheetOperation[];
  docOps: DocOperation[];
  kuOps: KuOperation[];
  tableOps: TableOperation[];
  deckOps: DeckOperation[];
  pageOps: PageOperation[];
}

/** Per-family op counts in the shape detectDroppedOpFamilies expects. */
export function opFamilyCounts(bundle: Partial<OpBundle>): OpFamilyCounts {
  return {
    sheetops: bundle.sheetOps?.length ?? 0,
    docops: bundle.docOps?.length ?? 0,
    kuops: bundle.kuOps?.length ?? 0,
    tableops: bundle.tableOps?.length ?? 0,
    deckops: bundle.deckOps?.length ?? 0,
    pageops: bundle.pageOps?.length ?? 0,
  };
}

/** True when any family produced at least one op. */
export function hasAnyOps(bundle: Partial<OpBundle>): boolean {
  const c = opFamilyCounts(bundle);
  return (
    c.sheetops + c.docops + c.kuops + c.tableops + c.deckops + c.pageops > 0
  );
}

/** Families that produced at least one op (stable order). */
export function presentFamilies(bundle: Partial<OpBundle>): OpFamily[] {
  const c = opFamilyCounts(bundle);
  return (Object.keys(c) as OpFamily[]).filter((f) => c[f] > 0);
}
