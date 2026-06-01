import type {
  KuOperation,
  TableOperation,
  DocOperation,
  PageOperation,
  DeckOperation,
  CellData,
} from "@/lib/types";

/**
 * Applies Layer B tool calls (see `primyTools.ts`) to the existing store
 * operation arrays. Each tool maps 1:1 onto an operation the store already
 * knows how to apply + auto-open, so nothing downstream changes — only the
 * transport (schema-validated tool call vs. regex-parsed fenced block).
 */
export interface CollectedToolOps {
  ku: KuOperation[];
  table: TableOperation[];
  doc: DocOperation[];
  page: PageOperation[];
}

export function emptyToolOps(): CollectedToolOps {
  return { ku: [], table: [], doc: [], page: [] };
}

export function hasToolOps(ops: CollectedToolOps): boolean {
  return ops.ku.length > 0 || ops.table.length > 0 || ops.doc.length > 0 || ops.page.length > 0;
}

/** Indicator kind for the live "Writing document…" pill, or null for no pill. */
export function toolIndicatorKind(toolName: string): "doc" | "sheet" | "page" | null {
  switch (toolName) {
    case "create_document":
    case "edit_document":
    case "append_to_document":
      return "doc";
    case "create_spreadsheet":
      return "sheet";
    case "create_page":
      return "page";
    default:
      return null;
  }
}

/**
 * One-line confirmation built from the ops that were applied — used when the
 * model returns a tool call (or a terse fenced block) with NO prose, so the
 * chat never shows an empty assistant bubble after an action. Markdown-bold the
 * entity title to match the assistant's normal confirmation style.
 */
export function summarizeOps(ops: {
  sheetOps?: { type: string }[];
  docOps?: { type: string }[];
  kuOps?: KuOperation[];
  tableOps?: TableOperation[];
  deckOps?: DeckOperation[];
  pageOps?: PageOperation[];
}): string {
  const parts: string[] = [];
  for (const op of ops.kuOps || []) {
    if (op.type === "CREATE") parts.push(`Created **${op.title}**.`);
    else if (op.type === "RENAME") parts.push("Renamed the document.");
    else if (op.type === "DELETE") parts.push("Deleted the document.");
    else parts.push("Updated the document.");
  }
  for (const op of ops.tableOps || []) {
    if (op.type === "CREATE") parts.push(`Created the **${op.title}** spreadsheet.`);
    else if (op.type === "DELETE") parts.push("Deleted the spreadsheet.");
    else parts.push("Updated the spreadsheet.");
  }
  for (const op of ops.pageOps || []) {
    if (op.type === "CREATE") parts.push(`Created the **${op.title}** page.`);
    else if (op.type === "RENAME") parts.push("Renamed the page.");
    else if (op.type === "DELETE") parts.push("Deleted the page.");
    else parts.push("Updated the page.");
  }
  for (const op of ops.deckOps || []) {
    if (op.type === "CREATE") parts.push(`Created the **${op.title}** deck.`);
    else if (op.type === "RENAME") parts.push("Renamed the deck.");
    else if (op.type === "DELETE") parts.push("Deleted the deck.");
    else parts.push("Updated the deck.");
  }
  if ((ops.docOps || []).length) parts.push("Updated the document.");
  if ((ops.sheetOps || []).length) parts.push("Updated the spreadsheet.");
  // De-dupe identical lines and keep it short.
  return [...new Set(parts)].slice(0, 3).join(" ");
}

/** Build Univer/Fortune sparse celldata from plain headers + rows. */
function buildCelldata(headers: string[], rows: string[][]): CellData[] {
  const cells: CellData[] = [];
  headers.forEach((h, c) => {
    const s = String(h ?? "");
    cells.push({ r: 0, c, v: { v: s, m: s, bl: 1 } });
  });
  rows.forEach((row, ri) => {
    (Array.isArray(row) ? row : []).forEach((val, c) => {
      if (val === "" || val === null || val === undefined) return;
      const s = String(val);
      const asNum = s.trim() !== "" && !Number.isNaN(Number(s)) ? Number(s) : null;
      cells.push({ r: ri + 1, c, v: asNum !== null ? { v: asNum, m: s } : { v: s, m: s } });
    });
  });
  return cells;
}

/**
 * Map one tool call to store operations, mutating `into`. Returns true if a
 * valid op was produced. Defensive: bad/partial input is ignored (returns
 * false) rather than throwing, so one malformed call never breaks the batch.
 */
export function applyToolCall(
  toolName: string,
  input: unknown,
  into: CollectedToolOps,
): boolean {
  if (!input || typeof input !== "object") return false;
  const data = input as Record<string, unknown>;
  try {
    switch (toolName) {
      case "create_document": {
        if (!data.title || typeof data.content !== "string") return false;
        into.ku.push({ type: "CREATE", title: String(data.title), content: data.content });
        return true;
      }
      case "edit_document": {
        if (typeof data.content !== "string") return false;
        into.doc.push({ type: "SET_CONTENT", markdown: data.content });
        return true;
      }
      case "append_to_document": {
        if (typeof data.content !== "string") return false;
        into.doc.push({ type: "APPEND_CONTENT", markdown: data.content });
        return true;
      }
      case "create_spreadsheet": {
        if (!data.title || !Array.isArray(data.headers)) return false;
        const headers = (data.headers as unknown[]).map((h) => String(h ?? ""));
        const rows = Array.isArray(data.rows)
          ? (data.rows as unknown[]).map((r) =>
              (Array.isArray(r) ? r : []).map((c) => (c === null || c === undefined ? "" : String(c))),
            )
          : [];
        into.table.push({ type: "CREATE", title: String(data.title), celldata: buildCelldata(headers, rows) });
        return true;
      }
      case "create_page": {
        if (!data.title || typeof data.html !== "string") return false;
        into.page.push({ type: "CREATE", title: String(data.title), html: data.html });
        return true;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
