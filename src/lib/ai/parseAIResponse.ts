import { SheetOperation, DocOperation, KuOperation, TableOperation } from "@/lib/types";

export function parseSheetOperations(fullText: string): SheetOperation[] {
  const regex = /```sheetops\s*\n([\s\S]*?)\n?\s*```/g;
  const operations: SheetOperation[] = [];

  let match;
  while ((match = regex.exec(fullText)) !== null) {
    try {
      const jsonStr = match[1].trim();
      console.log("[Drafta] Parsing sheetops JSON (first 200 chars):", jsonStr.slice(0, 200));
      const parsed = JSON.parse(jsonStr);
      if (parsed.operations && Array.isArray(parsed.operations)) {
        operations.push(...parsed.operations);
        console.log("[Drafta] Successfully parsed", parsed.operations.length, "sheet operations");
      } else if (parsed.type) {
        operations.push(parsed);
        console.log("[Drafta] Parsed single sheet operation:", parsed.type);
      }
    } catch (e) {
      console.error("[Drafta] Failed to parse sheet operations:", e);
      console.error("[Drafta] Raw content:", match[1].slice(0, 300));
    }
  }

  if (operations.length === 0 && fullText.includes("sheetops")) {
    console.warn("[Drafta] Found 'sheetops' in text but couldn't parse operations.");
    console.warn("[Drafta] Text around sheetops:", fullText.slice(fullText.indexOf("sheetops") - 20, fullText.indexOf("sheetops") + 200));
  }

  return operations;
}

export function parseDocOperations(fullText: string): DocOperation[] {
  const regex = /```docops\s*\n([\s\S]*?)\n?\s*```/g;
  const operations: DocOperation[] = [];

  let match;
  while ((match = regex.exec(fullText)) !== null) {
    try {
      const jsonStr = match[1].trim();
      console.log("[Drafta] Parsing docops JSON (first 200 chars):", jsonStr.slice(0, 200));
      const parsed = JSON.parse(jsonStr);
      if (parsed.operations && Array.isArray(parsed.operations)) {
        operations.push(...parsed.operations);
        console.log("[Drafta] Successfully parsed", parsed.operations.length, "doc operations");
      } else if (parsed.type) {
        operations.push(parsed);
        console.log("[Drafta] Parsed single doc operation:", parsed.type);
      }
    } catch (e) {
      console.error("[Drafta] Failed to parse doc operations:", e);
      console.error("[Drafta] Raw content:", match[1].slice(0, 300));
    }
  }

  return operations;
}

// ── KU Operations Parser ──

export function parseKuOperations(fullText: string): KuOperation[] {
  const regex = /```kuops\s*\n([\s\S]*?)\n?\s*```/g;
  const operations: KuOperation[] = [];

  let match;
  while ((match = regex.exec(fullText)) !== null) {
    try {
      const raw = match[1].trim();
      console.log("[Drafta] Parsing kuops (first 200 chars):", raw.slice(0, 200));

      // Try JSON parse first
      try {
        const parsed = JSON.parse(raw);
        if (parsed.operations && Array.isArray(parsed.operations)) {
          operations.push(...parsed.operations);
        } else if (parsed.type) {
          operations.push(parsed);
        }
        continue;
      } catch {
        // Not JSON — try the CREATE title="..." format
      }

      // Parse CREATE title="Title"\n---\ncontent format
      const createMatch = raw.match(/^CREATE\s+title\s*=\s*"([^"]+)"\s*\n---\n([\s\S]*)$/);
      if (createMatch) {
        operations.push({
          type: "CREATE",
          title: createMatch[1],
          content: createMatch[2].trim(),
        });
        continue;
      }

      // Parse as line-based commands
      const lines = raw.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const renameMatch = trimmed.match(/^RENAME\s+(\S+)\s+title\s*=\s*"([^"]+)"$/);
        if (renameMatch) {
          operations.push({ type: "RENAME", kuId: renameMatch[1], title: renameMatch[2] });
        }
      }
    } catch (e) {
      console.error("[Drafta] Failed to parse KU operations:", e);
    }
  }

  return operations;
}

// ── Table Operations Parser ──

export function parseTableOperations(fullText: string): TableOperation[] {
  const regex = /```tableops\s*\n([\s\S]*?)\n?\s*```/g;
  const operations: TableOperation[] = [];

  let match;
  while ((match = regex.exec(fullText)) !== null) {
    try {
      const jsonStr = match[1].trim();
      console.log("[Drafta] Parsing tableops JSON (first 200 chars):", jsonStr.slice(0, 200));
      const parsed = JSON.parse(jsonStr);
      if (parsed.operations && Array.isArray(parsed.operations)) {
        operations.push(...parsed.operations);
        console.log("[Drafta] Successfully parsed", parsed.operations.length, "table operations");
      } else if (parsed.type) {
        operations.push(parsed);
        console.log("[Drafta] Parsed single table operation:", parsed.type);
      }
    } catch (e) {
      console.error("[Drafta] Failed to parse table operations:", e);
    }
  }

  return operations;
}

export function extractDisplayText(fullText: string): string {
  return fullText
    .replace(/```sheetops\s*\n[\s\S]*?\n?\s*```/g, "")
    .replace(/```docops\s*\n[\s\S]*?\n?\s*```/g, "")
    .replace(/```kuops\s*\n[\s\S]*?\n?\s*```/g, "")
    .replace(/```tableops\s*\n[\s\S]*?\n?\s*```/g, "")
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
