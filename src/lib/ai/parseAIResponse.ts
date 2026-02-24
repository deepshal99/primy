import { SheetOperation, DocOperation, KuOperation, TableOperation } from "@/lib/types";

/**
 * Extract content between ```tag and ``` fences.
 * Uses indexOf for the closing fence to avoid regex issues with nested JSON.
 */
function extractFencedBlocks(fullText: string, tag: string): string[] {
  const blocks: string[] = [];
  // Match opening fence with or without trailing newline
  const openPattern = new RegExp("```" + tag + "\\s*\\n?", "g");
  let openMatch: RegExpExecArray | null;

  while ((openMatch = openPattern.exec(fullText)) !== null) {
    const startIdx = openMatch.index + openMatch[0].length;
    // Find the closing ``` — must be just ``` (not ```sometag)
    // Track nested code fences (e.g. ```python inside kuops content)
    let closeIdx = -1;
    let searchFrom = startIdx;
    let nestingDepth = 0;
    while (searchFrom < fullText.length) {
      const candidate = fullText.indexOf("```", searchFrom);
      if (candidate === -1) break;
      const prevChar = candidate > 0 ? fullText[candidate - 1] : "\n";
      const nextChar = candidate + 3 < fullText.length ? fullText[candidate + 3] : "\n";
      const isAtLineStart = prevChar === "\n" || prevChar === "\r";

      if (isAtLineStart && /[a-zA-Z]/.test(nextChar)) {
        // This is a nested opening fence (e.g. ```python)
        nestingDepth++;
        searchFrom = candidate + 3;
        continue;
      }

      if (isAtLineStart && !/[a-zA-Z]/.test(nextChar)) {
        if (nestingDepth > 0) {
          // This closes a nested fence, not our outer one
          nestingDepth--;
          searchFrom = candidate + 3;
          continue;
        }
        closeIdx = candidate;
        break;
      }

      searchFrom = candidate + 3;
    }

    if (closeIdx === -1) {
      // No closing fence — try to extract whatever we have
      const remaining = fullText.slice(startIdx).trim();
      if (remaining) blocks.push(remaining);
    } else {
      blocks.push(fullText.slice(startIdx, closeIdx).trim());
    }
  }

  return blocks;
}

/**
 * Try to parse JSON, handling common AI output quirks.
 */
function robustJsonParse(jsonStr: string): any {
  // First try direct parse
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Strip trailing commas before } or ]
    // Note: do NOT strip // comments — it breaks URLs inside string values
    const cleaned = jsonStr
      .replace(/,\s*([}\]])/g, "$1")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: try to extract the JSON object/array from surrounding text
      const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

function parseOpsFromBlock<T>(block: string): T[] {
  const parsed = robustJsonParse(block);
  if (!parsed) return [];

  if (parsed.operations && Array.isArray(parsed.operations)) {
    return parsed.operations as T[];
  } else if (parsed.type) {
    return [parsed as T];
  } else if (Array.isArray(parsed)) {
    return parsed.filter((item: any) => item?.type) as T[];
  }
  return [];
}

export function parseSheetOperations(fullText: string): SheetOperation[] {
  const blocks = extractFencedBlocks(fullText, "sheetops");
  const operations: SheetOperation[] = [];

  for (const block of blocks) {
    const ops = parseOpsFromBlock<SheetOperation>(block);
    if (ops.length > 0) {
      operations.push(...ops);
    } else {
      if (process.env.NODE_ENV !== "production") console.warn("[Drafta] Failed to parse sheetops block:", block.slice(0, 200));
    }
  }

  return operations;
}

export function parseDocOperations(fullText: string): DocOperation[] {
  const blocks = extractFencedBlocks(fullText, "docops");
  const operations: DocOperation[] = [];

  for (const block of blocks) {
    const ops = parseOpsFromBlock<DocOperation>(block);
    if (ops.length > 0) {
      operations.push(...ops);
    } else {
      if (process.env.NODE_ENV !== "production") console.warn("[Drafta] Failed to parse docops block:", block.slice(0, 200));
    }
  }

  return operations;
}

// ── KU Operations Parser ──

export function parseKuOperations(fullText: string): KuOperation[] {
  const blocks = extractFencedBlocks(fullText, "kuops");
  const operations: KuOperation[] = [];

  for (const block of blocks) {
    // Try JSON parse first
    const ops = parseOpsFromBlock<KuOperation>(block);
    if (ops.length > 0) {
      operations.push(...ops);
      continue;
    }

    // Parse CREATE title="Title"\n---\ncontent format
    const createMatch = block.match(/^CREATE\s+title\s*=\s*"([^"]+)"\s*\n---\n([\s\S]*)$/);
    if (createMatch) {
      operations.push({
        type: "CREATE",
        title: createMatch[1],
        content: createMatch[2].trim(),
      });
      continue;
    }

    // Parse as line-based commands
    const lines = block.split("\n");
    let found = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const renameMatch = trimmed.match(/^RENAME\s+(\S+)\s+title\s*=\s*"([^"]+)"$/);
      if (renameMatch) {
        operations.push({ type: "RENAME", kuId: renameMatch[1], title: renameMatch[2] });
        found = true;
      }
    }

    if (!found) {
      if (process.env.NODE_ENV !== "production") console.warn("[Drafta] Failed to parse kuops block:", block.slice(0, 200));
    }
  }

  return operations;
}

// ── Table Operations Parser ──

export function parseTableOperations(fullText: string): TableOperation[] {
  const blocks = extractFencedBlocks(fullText, "tableops");
  const operations: TableOperation[] = [];

  for (const block of blocks) {
    const ops = parseOpsFromBlock<TableOperation>(block);
    if (ops.length > 0) {
      for (const op of ops) {
        if (op.type === "CREATE" && (!op.celldata || !Array.isArray(op.celldata) || op.celldata.length === 0)) {
          if (process.env.NODE_ENV !== "production") console.warn("[Drafta] tableops CREATE has empty/missing celldata, skipping:", JSON.stringify(op).slice(0, 200));
          continue;
        }
        operations.push(op);
      }
    } else {
      if (process.env.NODE_ENV !== "production") console.warn("[Drafta] Failed to parse tableops block:", block.slice(0, 200));
    }
  }

  return operations;
}

export function extractDisplayText(fullText: string): string {
  // Use the same extraction approach — find fenced blocks and remove them
  let result = fullText;
  for (const tag of ["sheetops", "docops", "kuops", "tableops"]) {
    const openPattern = new RegExp("```" + tag + "\\s*\\n?", "g");
    let openMatch: RegExpExecArray | null;
    const ranges: [number, number][] = [];

    while ((openMatch = openPattern.exec(result)) !== null) {
      const start = openMatch.index;
      const contentStart = start + openMatch[0].length;
      // Find closing fence — same logic as extractFencedBlocks
      let closeIdx = -1;
      let searchFrom = contentStart;
      while (searchFrom < result.length) {
        const candidate = result.indexOf("```", searchFrom);
        if (candidate === -1) break;
        const prevChar = candidate > 0 ? result[candidate - 1] : "\n";
        const nextChar = candidate + 3 < result.length ? result[candidate + 3] : "\n";
        if ((prevChar === "\n" || prevChar === "\r") && !/[a-zA-Z]/.test(nextChar)) {
          closeIdx = candidate;
          break;
        }
        searchFrom = candidate + 3;
      }

      if (closeIdx !== -1) {
        // Include the closing ``` and any trailing newline
        let end = closeIdx + 3;
        if (end < result.length && result[end] === "\n") end++;
        ranges.push([start, end]);
      } else {
        // No closing fence — remove from start to end
        ranges.push([start, result.length]);
      }
    }

    // Remove ranges in reverse
    for (let i = ranges.length - 1; i >= 0; i--) {
      result = result.slice(0, ranges[i][0]) + result.slice(ranges[i][1]);
    }
  }

  return result
    .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, "")
    .trim();
}

export function parseSuggestions(fullText: string): string[] {
  const match = fullText.match(/<suggestions>\s*([\s\S]*?)\s*<\/suggestions>/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string").slice(0, 3);
    }
  } catch {
    // Try line-by-line fallback
    const lines = match[1].split("\n").map((l) => l.replace(/^[-*]\s*/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 3);
  }
  return [];
}
