import type { SheetOperation, DocOperation, KuOperation, TableOperation } from "@/lib/types";
import { applyOperations } from "@/lib/ai/sheetOperations";
import { applyDocOps } from "@/lib/ai/docOperations";
import { createEmptySheet } from "@/lib/sheet/defaultData";

export interface OpSet {
  sheetOps?: SheetOperation[];
  docOps?: DocOperation[];
  kuOps?: KuOperation[];
  tableOps?: TableOperation[];
}

/**
 * Guard against the #1 cause of "the AI did nothing": the model emits EDIT
 * ops (`sheetops`/`docops`) to *create* something when no matching entity is
 * open. Edit-ops target the active entity's buffer — with nothing open they
 * mutate an ephemeral buffer that is never persisted, so a success toast fires
 * but no file is created.
 *
 * This promotes such orphan ops into CREATE ops on a real entity:
 *   - orphan `sheetops` (no open table) → `tableops` CREATE
 *   - orphan `docops`   (no open doc)   → `kuops`   CREATE
 *
 * When the correct CREATE op was used, or a matching entity is open, the ops
 * pass through unchanged.
 */
export function promoteOrphanOps(
  ops: OpSet,
  ctx: { hasOpenTable: boolean; hasOpenDoc: boolean }
): OpSet {
  let sheetOps = ops.sheetOps;
  let docOps = ops.docOps;
  let kuOps = ops.kuOps;
  let tableOps = ops.tableOps;

  // Orphan sheet edit → new spreadsheet entity.
  if (sheetOps && sheetOps.length > 0 && !ctx.hasOpenTable) {
    const dataOps = sheetOps.filter((o) => o.type !== "INSERT_IMAGE");
    const built = applyOperations(createEmptySheet(), dataOps);
    const celldata = built[0]?.celldata ?? [];
    if (celldata.length > 0) {
      let title = "Untitled Spreadsheet";
      for (const o of sheetOps) {
        if (o.type === "SET_SHEET_DATA" && o.data?.name) {
          title = o.data.name;
          break;
        }
        if (o.type === "ADD_SHEET" && o.name) {
          title = o.name;
          break;
        }
      }
      tableOps = [...(tableOps ?? []), { type: "CREATE", title, celldata }];
      sheetOps = undefined;
    }
  }

  // Orphan doc edit → new document entity.
  if (docOps && docOps.length > 0 && !ctx.hasOpenDoc) {
    const content = applyDocOps("", docOps);
    if (content.trim().length > 0) {
      kuOps = [...(kuOps ?? []), { type: "CREATE", title: "Untitled Document", content }];
      docOps = undefined;
    }
  }

  return { sheetOps, docOps, kuOps, tableOps };
}
