import { SheetOperation, DocOperation, KuOperation, TableOperation, DeckOperation, PageOperation, DeckOutlineItem, ThemeConfig } from "@/lib/types";

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
      // Try to fix unescaped newlines inside JSON string values.
      // AI models often output literal newlines inside "content" fields.
      const fixedNewlines = fixUnescapedNewlinesInJson(cleaned);
      if (fixedNewlines !== cleaned) {
        try {
          return JSON.parse(fixedNewlines);
        } catch {
          // fall through
        }
      }

      // Try to extract the JSON object/array from surrounding text
      const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          const fixedExtracted = fixUnescapedNewlinesInJson(jsonMatch[1]);
          try {
            return JSON.parse(fixedExtracted);
          } catch {
            // fall through to truncation repair
          }
        }
      }

      // Last resort: the response was likely truncated at the model's output
      // token cap (common for large tableops). Salvage the complete prefix by
      // trimming to the last whole array element and re-closing the brackets.
      const repaired = repairTruncatedJson(fixUnescapedNewlinesInJson(cleaned));
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Repair JSON that was cut off mid-stream (model hit its output token limit).
 * Walks the string tracking string/bracket state, finds the end of the last
 * COMPLETE array element, trims there, and appends the closing brackets needed
 * to balance. Returns null if the JSON is already balanced or unsalvageable.
 * This lets a truncated `tableops`/`sheetops` block still yield a partial sheet
 * instead of being dropped entirely.
 */
function repairTruncatedJson(jsonStr: string): string | null {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let cutIdx = -1;
  let cutStack: string[] | null = null;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      // Just closed a value that sits directly inside an array → safe cut point.
      if (stack.length > 0 && stack[stack.length - 1] === "[") {
        cutIdx = i + 1;
        cutStack = [...stack];
      }
    }
  }

  if (stack.length === 0) return null; // already balanced — not truncated
  if (cutIdx < 0 || !cutStack) return null; // nothing complete to salvage

  let repaired = jsonStr.slice(0, cutIdx).replace(/,\s*$/, "");
  for (let k = cutStack.length - 1; k >= 0; k--) {
    repaired += cutStack[k] === "[" ? "]" : "}";
  }
  return repaired;
}

/**
 * Fix unescaped newlines/tabs inside JSON string values.
 * Walks the string character by character, and when inside a JSON string
 * (between unescaped quotes), escapes any literal newlines or tabs.
 */
function fixUnescapedNewlinesInJson(jsonStr: string): string {
  const result: string[] = [];
  let inString = false;
  let i = 0;
  while (i < jsonStr.length) {
    const ch = jsonStr[i];
    if (inString) {
      if (ch === '\\') {
        // Escaped character — pass through both chars
        result.push(ch);
        if (i + 1 < jsonStr.length) {
          result.push(jsonStr[i + 1]);
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (ch === '"') {
        inString = false;
        result.push(ch);
        i++;
        continue;
      }
      if (ch === '\n') {
        result.push('\\n');
        i++;
        continue;
      }
      if (ch === '\r') {
        result.push('\\r');
        i++;
        continue;
      }
      if (ch === '\t') {
        result.push('\\t');
        i++;
        continue;
      }
      result.push(ch);
      i++;
    } else {
      if (ch === '"') {
        inString = true;
      }
      result.push(ch);
      i++;
    }
  }
  return result.join('');
}

function parseOpsFromBlock<T>(block: string): T[] {
  const parsed = robustJsonParse(block);
  if (!parsed) {
    console.warn("[Primy Parse] Failed to parse block as JSON:", block.slice(0, 300));
    return [];
  }

  if (parsed.operations && Array.isArray(parsed.operations)) {
    return parsed.operations as T[];
  } else if (parsed.type) {
    return [parsed as T];
  } else if (Array.isArray(parsed)) {
    const filtered = parsed.filter((item: any) => item?.type) as T[];
    if (filtered.length === 0 && parsed.length > 0) {
      console.warn("[Primy Parse] Parsed JSON array but no items had 'type' field:", JSON.stringify(parsed[0]).slice(0, 200));
    }
    return filtered;
  }
  console.warn("[Primy Parse] Parsed JSON but couldn't extract operations:", JSON.stringify(parsed).slice(0, 200));
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
      if (process.env.NODE_ENV !== "production") console.warn("[Primy] Failed to parse sheetops block:", block.slice(0, 200));
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
      if (process.env.NODE_ENV !== "production") console.warn("[Primy] Failed to parse docops block:", block.slice(0, 200));
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

    // Parse UPDATE kuId\n---\ncontent format (plaintext fallback)
    const updateMatch = block.match(/^UPDATE\s+(\S+)\s*\n---\n([\s\S]*)$/);
    if (updateMatch) {
      operations.push({
        type: "UPDATE",
        kuId: updateMatch[1],
        content: updateMatch[2].trim(),
      });
      continue;
    }

    // Parse APPEND kuId\n---\ncontent format (plaintext fallback)
    const appendMatch = block.match(/^APPEND\s+(\S+)\s*\n---\n([\s\S]*)$/);
    if (appendMatch) {
      operations.push({
        type: "APPEND",
        kuId: appendMatch[1],
        content: appendMatch[2].trim(),
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
      if (process.env.NODE_ENV !== "production") console.warn("[Primy] Failed to parse kuops block:", block.slice(0, 200));
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
          // Allow CREATE with empty celldata — the store will create an empty sheet
          console.warn("[Primy] tableops CREATE has empty/missing celldata, defaulting to empty sheet:", op.title);
          op.celldata = [];
        }
        operations.push(op);
      }
    } else {
      if (process.env.NODE_ENV !== "production") console.warn("[Primy] Failed to parse tableops block:", block.slice(0, 200));
    }
  }

  return operations;
}

// ── HTML Page Operations Parser ──

export function parsePageOperations(fullText: string): PageOperation[] {
  const blocks = extractFencedBlocks(fullText, "pageops");
  const operations: PageOperation[] = [];

  for (const block of blocks) {
    const ops = parseOpsFromBlock<PageOperation>(block);
    if (ops.length > 0) {
      for (const op of ops) {
        if ((op.type === "CREATE" || op.type === "UPDATE") && typeof op.html !== "string") {
          if (process.env.NODE_ENV !== "production") console.warn("[Primy] pageops op missing html, skipping:", op.type);
          continue;
        }
        operations.push(op);
      }
    } else {
      if (process.env.NODE_ENV !== "production") console.warn("[Primy] Failed to parse pageops block:", block.slice(0, 200));
    }
  }

  return operations;
}

// ── HTML Deck Slide Normalization ──

/**
 * Normalize an HTML slide: coerce missing/malformed editableFields to [],
 * assign a fallback id if missing. Returns null only if html is missing entirely.
 */
function normalizeHtmlSlide(slide: any): any | null {
  if (typeof slide.html !== "string" || slide.html.length === 0) {
    console.warn("[Primy] HTML slide rejected — missing or empty html field:", slide.id);
    return null;
  }
  // Ensure id
  if (typeof slide.id !== "string" || !slide.id) {
    slide.id = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
  // Coerce editableFields — if missing or not an array, default to empty
  if (!Array.isArray(slide.editableFields)) {
    slide.editableFields = [];
  }
  return slide;
}

/**
 * Attempt to fix JSON containing HTML strings where double quotes in HTML
 * attributes corrupt the JSON structure. Walks each "html":"..." value
 * char-by-char, escaping internal double quotes that aren't valid JSON boundaries.
 */
function fixHtmlJsonQuotes(jsonStr: string): string {
  const htmlFieldPattern = /"html"\s*:\s*"/g;
  let result = "";
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = htmlFieldPattern.exec(jsonStr)) !== null) {
    const valueStart = match.index + match[0].length;
    result += jsonStr.slice(lastEnd, valueStart);

    // Walk to find the true end of the HTML string value
    let i = valueStart;
    let htmlContent = "";
    while (i < jsonStr.length) {
      const ch = jsonStr[i];
      if (ch === '\\' && i + 1 < jsonStr.length) {
        htmlContent += ch + jsonStr[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        // Look ahead: is this the real JSON close-quote?
        // A real close-quote is followed by optional whitespace then , or } or ]
        const after = jsonStr.slice(i + 1).match(/^\s*([,}\]])/);
        if (after) {
          // Also check: does the rest parse as valid JSON continuation?
          // Heuristic: if after the quote we see ,"editableFields" or ,"id" or ,"notes" or }
          const afterTrimmed = jsonStr.slice(i + 1).trimStart();
          if (
            afterTrimmed.startsWith(",") ||
            afterTrimmed.startsWith("}") ||
            afterTrimmed.startsWith("]")
          ) {
            // This looks like the real end
            break;
          }
        }
        // Otherwise escape this quote — it's inside the HTML
        htmlContent += '\\"';
        i++;
        continue;
      }
      // Escape literal newlines/tabs inside the string
      if (ch === '\n') { htmlContent += '\\n'; i++; continue; }
      if (ch === '\r') { htmlContent += '\\r'; i++; continue; }
      if (ch === '\t') { htmlContent += '\\t'; i++; continue; }
      htmlContent += ch;
      i++;
    }

    result += htmlContent;
    lastEnd = i; // the close quote itself will be included from jsonStr
  }

  result += jsonStr.slice(lastEnd);
  return result;
}

// ── Deck Operations Parser ──

/**
 * HTML-aware JSON parse for deckops blocks.
 * If the block contains HTML slides, applies HTML-specific fixups before standard parsing.
 */
function parseHtmlDeckopsBlock(block: string): any {
  // Step 1: try direct parse
  try {
    return JSON.parse(block);
  } catch { /* continue */ }

  // Step 2: fix unescaped newlines (standard recovery)
  const fixedNewlines = fixUnescapedNewlinesInJson(block);
  try {
    return JSON.parse(fixedNewlines);
  } catch { /* continue */ }

  // Step 3: fix double quotes inside HTML attribute values
  const fixedQuotes = fixHtmlJsonQuotes(block);
  try {
    return JSON.parse(fixedQuotes);
  } catch { /* continue */ }

  // Step 4: combined — fix newlines then quotes
  const fixedBoth = fixHtmlJsonQuotes(fixUnescapedNewlinesInJson(block));
  try {
    return JSON.parse(fixedBoth);
  } catch { /* continue */ }

  // Step 5: strip trailing commas then retry
  const cleaned = block.replace(/,\s*([}\]])/g, "$1").trim();
  const fixedCleaned = fixHtmlJsonQuotes(fixUnescapedNewlinesInJson(cleaned));
  try {
    return JSON.parse(fixedCleaned);
  } catch { /* continue */ }

  return null;
}

export function parseDeckOperations(fullText: string): DeckOperation[] {
  const blocks = extractFencedBlocks(fullText, "deckops");
  const operations: DeckOperation[] = [];

  for (const block of blocks) {
    let ops: DeckOperation[] = [];

    // For blocks with HTML slides, use the HTML-aware parser
    if (block.includes('"html"')) {
      const parsed = parseHtmlDeckopsBlock(block);
      if (parsed) {
        if (parsed.type) {
          ops = [parsed as DeckOperation];
        } else if (Array.isArray(parsed)) {
          ops = parsed.filter((item: any) => item?.type) as DeckOperation[];
        } else if (parsed.operations && Array.isArray(parsed.operations)) {
          ops = parsed.operations as DeckOperation[];
        }
      }
      if (ops.length === 0) {
        console.warn("[Primy] All HTML-aware parse attempts failed for deckops block");
      } else {
        console.debug("[Primy] HTML deckops block parsed successfully");
      }
    } else {
      // Standard parse for non-HTML deck operations
      ops = parseOpsFromBlock<DeckOperation>(block);
    }

    if (ops.length > 0) {
      // Normalize HTML slides (coerce fields, log rejections)
      for (const op of ops) {
        if (op.type === "CREATE" || op.type === "UPDATE") {
          if (op.slides) {
            const before = op.slides.length;
            op.slides = op.slides
              .map((slide: any) => {
                if ('html' in slide && !('layout' in slide)) {
                  return normalizeHtmlSlide(slide);
                }
                return slide; // legacy structured slides pass through
              })
              .filter(Boolean);
            if (op.slides.length < before) {
              console.warn(`[Primy] ${before - op.slides.length} HTML slides were rejected during normalization`);
            }
            if (op.slides.length > 0) {
              console.log(`[Primy] Deck ${op.type}: ${op.slides.length} slides parsed successfully (${op.slides.filter((s: any) => 'html' in s).length} HTML)`);
            }
          }
        }
      }
      operations.push(...ops);
    } else {
      console.warn("[Primy] Failed to parse deckops block:", block.slice(0, 300));
      // Last-resort: try to extract individual slide objects from the block
      if (block.includes('"html"') && block.includes('"slides"')) {
        console.warn("[Primy] Attempting last-resort slide extraction...");
        const recovered = lastResortSlideExtraction(block);
        if (recovered) {
          operations.push(recovered);
          console.debug("[Primy] Last-resort extraction recovered", recovered.type === "CREATE" ? recovered.slides?.length : 0, "slides");
        }
      }
    }
  }

  return operations;
}

/**
 * Last-resort: when JSON parsing completely fails, try to extract
 * a CREATE operation by pulling out the title and individual slide HTML strings.
 */
function lastResortSlideExtraction(block: string): DeckOperation | null {
  try {
    // Extract title
    const titleMatch = block.match(/"title"\s*:\s*"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : "Untitled Deck";

    // Extract type
    const typeMatch = block.match(/"type"\s*:\s*"(CREATE|UPDATE)"/);
    const type = (typeMatch ? typeMatch[1] : "CREATE") as "CREATE" | "UPDATE";

    // Find all "html": "..." values by walking the string
    const slides: any[] = [];
    const idPattern = /"id"\s*:\s*"([^"]+)"/g;
    const ids: string[] = [];
    let idMatch: RegExpExecArray | null;
    while ((idMatch = idPattern.exec(block)) !== null) {
      // Skip the top-level "type" and "title" fields
      if (idMatch[1] !== "CREATE" && idMatch[1] !== "UPDATE" && idMatch[1].startsWith("slide")) {
        ids.push(idMatch[1]);
      }
    }

    // Extract html values using a state machine approach
    const htmlPattern = /"html"\s*:\s*"/g;
    let htmlMatch: RegExpExecArray | null;
    let slideIdx = 0;
    while ((htmlMatch = htmlPattern.exec(block)) !== null) {
      const valueStart = htmlMatch.index + htmlMatch[0].length;
      // Find end: walk until we find a quote followed by valid JSON continuation
      let i = valueStart;
      let htmlStr = "";
      while (i < block.length) {
        const ch = block[i];
        if (ch === '\\' && i + 1 < block.length) {
          htmlStr += ch + block[i + 1];
          i += 2;
          continue;
        }
        if (ch === '"') {
          const afterTrimmed = block.slice(i + 1).trimStart();
          if (afterTrimmed.startsWith(",") || afterTrimmed.startsWith("}") || afterTrimmed.startsWith("]")) {
            break;
          }
          htmlStr += ch; // keep the quote in the HTML
          i++;
          continue;
        }
        htmlStr += ch;
        i++;
      }

      if (htmlStr.length > 50) { // sanity check — slides should be substantial
        // Unescape the JSON string
        try {
          htmlStr = JSON.parse(`"${htmlStr}"`);
        } catch {
          // Use as-is with basic unescaping
          htmlStr = htmlStr.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
        }
        slides.push({
          id: ids[slideIdx] || `slide-${slideIdx + 1}`,
          html: htmlStr,
          editableFields: [],
        });
      }
      slideIdx++;
    }

    if (slides.length === 0) return null;

    if (type === "CREATE") {
      return { type: "CREATE", title, slides } as DeckOperation;
    } else {
      const deckIdMatch = block.match(/"deckId"\s*:\s*"([^"]+)"/);
      return { type: "UPDATE", deckId: deckIdMatch?.[1] || "", slides } as DeckOperation;
    }
  } catch (e) {
    console.warn("[Primy] Last-resort slide extraction failed:", e);
    return null;
  }
}

// ── Deck Outline Parser ──

export function parseDeckOutlineItems(fullText: string): DeckOutlineItem[] {
  const blocks = extractFencedBlocks(fullText, "deckoutline");
  const items: DeckOutlineItem[] = [];

  for (const block of blocks) {
    const parsed = robustJsonParse(block);
    if (!parsed) continue;

    // Handle { slides: [...] } wrapper
    const arr = parsed.slides && Array.isArray(parsed.slides)
      ? parsed.slides
      : Array.isArray(parsed)
        ? parsed
        : null;

    if (arr) {
      for (const item of arr) {
        if (item && typeof item === "object" && item.title) {
          items.push({
            id: item.id || `outline-${items.length + 1}`,
            title: item.title,
            description: item.description || "",
            category: item.category,
            layout: item.layout,
            visual: item.visual,
            imageQuery: item.imageQuery,
          });
        }
      }
    }
  }

  return items;
}

/** Convert a deckoutline block to readable markdown for display */
function deckOutlineToMarkdown(block: string): string {
  const parsed = robustJsonParse(block);
  if (!parsed) return "";

  const arr = parsed.slides && Array.isArray(parsed.slides)
    ? parsed.slides
    : Array.isArray(parsed)
      ? parsed
      : null;

  if (!arr || arr.length === 0) return "";

  const lines = arr.map((item: any, i: number) => {
    const category = item.category ? ` [${item.category}]` : "";
    const layout = item.layout ? ` _(${item.layout})_` : "";
    const visual = item.visual ? ` · ${item.visual}` : "";
    const photo = item.imageQuery ? ` 📷` : "";
    return `${i + 1}. **${item.title}**${category}${layout}${item.description ? ` — ${item.description}` : ""}${visual}${photo}`;
  });

  return lines.join("\n");
}

// ── ThemeConfig Validator ──

const VALID_BULLET_STYLES = ["disc", "dash", "number", "arrow", "check", "ring", "bar"] as const;
const VALID_DECOR_STYLES = ["geometric", "minimal", "gradient"] as const;
const VALID_HEADING_CASES = ["none", "uppercase"] as const;

/** Validate and normalize an AI-generated style object into a valid ThemeConfig */
export function validateThemeConfig(raw: unknown): ThemeConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  // Required color fields
  const bg = typeof o.bg === "string" ? o.bg : null;
  const text = typeof o.text === "string" ? o.text : null;
  const accent = typeof o.accent === "string" ? o.accent : null;
  if (!bg || !text || !accent) return null;

  const textSecondary = typeof o.textSecondary === "string" ? o.textSecondary : `${text}99`;
  const accentAlt = typeof o.accentAlt === "string" ? o.accentAlt : accent;
  const accentLight = typeof o.accentLight === "string" ? o.accentLight : `${accent}12`;

  const headingFont = typeof o.headingFont === "string" ? o.headingFont : "'Inter', system-ui, sans-serif";
  const bodyFont = typeof o.bodyFont === "string" ? o.bodyFont : "'Inter', system-ui, sans-serif";
  const headingWeight = typeof o.headingWeight === "number" ? o.headingWeight : 700;
  const headingCase = VALID_HEADING_CASES.includes(o.headingCase as any) ? (o.headingCase as "none" | "uppercase") : "none";

  const cardBg = typeof o.cardBg === "string" ? o.cardBg : bg;
  const cardBorder = typeof o.cardBorder === "string" ? o.cardBorder : "#E0E0E0";
  const divider = typeof o.divider === "string" ? o.divider : "#D0D0D0";

  const bulletStyle = VALID_BULLET_STYLES.includes(o.bulletStyle as any) ? (o.bulletStyle as ThemeConfig["bulletStyle"]) : "bar";
  const decorStyle = VALID_DECOR_STYLES.includes(o.decorStyle as any) ? (o.decorStyle as ThemeConfig["decorStyle"]) : "minimal";

  let googleFonts: string[] = [];
  if (Array.isArray(o.googleFonts)) {
    googleFonts = o.googleFonts.filter((f): f is string => typeof f === "string");
  }

  const label = typeof o.label === "string" ? o.label : "Custom";

  return {
    label,
    bg,
    text,
    textSecondary,
    accent,
    accentAlt,
    accentLight,
    headingFont,
    bodyFont,
    headingWeight,
    headingCase,
    cardBg,
    cardBorder,
    divider,
    bulletStyle,
    decorStyle,
    googleFonts,
  };
}

export function extractDisplayText(fullText: string): string {
  // Strip operation fenced blocks; convert deckoutline to readable markdown
  let result = fullText;
  for (const tag of ["sheetops", "docops", "kuops", "tableops", "deckops", "deckoutline"]) {
    const openPattern = new RegExp("```" + tag + "\\s*\\n?", "g");
    let openMatch: RegExpExecArray | null;
    const ranges: [number, number, string][] = []; // [start, end, replacement]

    while ((openMatch = openPattern.exec(result)) !== null) {
      const start = openMatch.index;
      const contentStart = start + openMatch[0].length;
      // Find closing fence — same nesting logic as extractFencedBlocks
      let closeIdx = -1;
      let searchFrom = contentStart;
      let nestingDepth = 0;
      while (searchFrom < result.length) {
        const candidate = result.indexOf("```", searchFrom);
        if (candidate === -1) break;
        const prevChar = candidate > 0 ? result[candidate - 1] : "\n";
        const nextChar = candidate + 3 < result.length ? result[candidate + 3] : "\n";
        const isAtLineStart = prevChar === "\n" || prevChar === "\r";

        if (isAtLineStart && /[a-zA-Z]/.test(nextChar)) {
          nestingDepth++;
          searchFrom = candidate + 3;
          continue;
        }

        if (isAtLineStart && !/[a-zA-Z]/.test(nextChar)) {
          if (nestingDepth > 0) {
            nestingDepth--;
            searchFrom = candidate + 3;
            continue;
          }
          closeIdx = candidate;
          break;
        }

        searchFrom = candidate + 3;
      }

      if (closeIdx !== -1) {
        let end = closeIdx + 3;
        if (end < result.length && result[end] === "\n") end++;
        // For deckoutline, convert to readable markdown instead of removing
        const replacement = tag === "deckoutline"
          ? deckOutlineToMarkdown(result.slice(contentStart, closeIdx).trim())
          : "";
        ranges.push([start, end, replacement]);
      } else {
        const replacement = tag === "deckoutline"
          ? deckOutlineToMarkdown(result.slice(contentStart).trim())
          : "";
        ranges.push([start, result.length, replacement]);
      }
    }

    // Replace ranges in reverse
    for (let i = ranges.length - 1; i >= 0; i--) {
      result = result.slice(0, ranges[i][0]) + ranges[i][2] + result.slice(ranges[i][1]);
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
      return parsed.filter((s): s is string => typeof s === "string").slice(0, 4);
    }
  } catch {
    // Try line-by-line fallback
    const lines = match[1].split("\n").map((l) => l.replace(/^[-*]\s*/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 4);
  }
  return [];
}
