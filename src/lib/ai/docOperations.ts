import { DocOperation } from "@/lib/types";

export function applyDocOps(
  currentContent: string,
  operations: DocOperation[]
): string {
  let content = currentContent;
  for (const op of operations) {
    try {
      content = applyDocOp(content, op);
    } catch (err) {
      console.error("[Primy] Failed to apply doc operation:", op.type, err);
    }
  }
  return content;
}

function applyDocOp(content: string, op: DocOperation): string {
  switch (op.type) {
    case "SET_CONTENT":
      return typeof op.markdown === "string" ? op.markdown : content;

    case "APPEND_CONTENT": {
      if (typeof op.markdown !== "string" || !op.markdown) return content;
      return content ? content + "\n\n" + op.markdown : op.markdown;
    }

    case "REPLACE_SECTION": {
      if (typeof op.markdown !== "string" || typeof op.headingText !== "string" || !op.headingText) {
        return content;
      }
      const lines = content.split("\n");
      const headingRegex = /^(#{1,6})\s+(.+)$/;
      let startIdx = -1;
      let startLevel = 0;
      let endIdx = lines.length;

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(headingRegex);
        if (
          match &&
          match[2].trim().toLowerCase() === op.headingText.trim().toLowerCase()
        ) {
          startIdx = i;
          startLevel = match[1].length;
          for (let j = i + 1; j < lines.length; j++) {
            const nextMatch = lines[j].match(headingRegex);
            if (nextMatch && nextMatch[1].length <= startLevel) {
              endIdx = j;
              break;
            }
          }
          break;
        }
      }

      if (startIdx === -1) {
        return content + "\n\n" + op.markdown;
      }

      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      return [...before, op.markdown, ...after].join("\n");
    }

    default:
      return content;
  }
}
