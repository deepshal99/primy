import { tool, jsonSchema } from "ai";

/**
 * Drafta's client-forwarded tools (Layer B).
 *
 * These tools have NO `execute` function on purpose. The model CALLS them; the
 * chat route streams each call to the browser; the Zustand store applies it
 * (see `toolMapping.ts`). That makes entity creation/edit:
 *   1. schema-validated — the input shape is enforced by the API, so it can
 *      never arrive as malformed hand-typed JSON, and
 *   2. unforgeable — the tool call IS the action, so the model can't "claim it
 *      created something" without actually emitting the call.
 *
 * Scope (intentionally bounded for a safe migration): the high-frequency
 * create/edit paths that fail today. Sheet-cell edits, page edits, decks, and
 * rename/delete stay on the existing ```fenced-block path, which the client
 * still parses as a fallback (dual-accept). Every tool here is id-free and maps
 * 1:1 onto an existing store operation, so the apply pipeline is unchanged.
 */
export const DRAFTA_TOOLS = {
  create_document: tool({
    description:
      "Create a NEW document (note, draft, outline, report, any written/prose content) as a named file in the project. Use this for ANY text content longer than ~2 sentences instead of writing it into chat. The document opens automatically.",
    inputSchema: jsonSchema<{ title: string; content: string }>({
      type: "object",
      properties: {
        title: { type: "string", description: "Short, descriptive file title" },
        content: { type: "string", description: "Full document body, in Markdown" },
      },
      required: ["title", "content"],
      additionalProperties: false,
    }),
  }),

  edit_document: tool({
    description:
      "Replace the ENTIRE content of the currently open document. Use when the user asks to rewrite or substantially change the open doc. If no document is open, this creates one.",
    inputSchema: jsonSchema<{ content: string }>({
      type: "object",
      properties: {
        content: { type: "string", description: "New full document body, in Markdown" },
      },
      required: ["content"],
      additionalProperties: false,
    }),
  }),

  append_to_document: tool({
    description:
      "Append new content to the END of the currently open document, leaving the existing content intact.",
    inputSchema: jsonSchema<{ content: string }>({
      type: "object",
      properties: {
        content: { type: "string", description: "Markdown to append to the document" },
      },
      required: ["content"],
      additionalProperties: false,
    }),
  }),

  create_spreadsheet: tool({
    description:
      "Create a NEW spreadsheet / table / tracker / data grid as a named file. Provide column headers and rows of PLAIN values — the app lays out the grid for you. Never hand-build cell coordinates. The sheet opens automatically.",
    inputSchema: jsonSchema<{ title: string; headers: string[]; rows: string[][] }>({
      type: "object",
      properties: {
        title: { type: "string", description: "Short, descriptive file title" },
        headers: {
          type: "array",
          items: { type: "string" },
          description: "Column headers — becomes the first (bold) row",
        },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "Data rows. Each row is an array of cell values aligned to headers.",
        },
      },
      required: ["title", "headers", "rows"],
      additionalProperties: false,
    }),
  }),

  create_page: tool({
    description:
      "Create a NEW visual HTML page / one-pager / designed document as a named file. Provide COMPLETE standalone HTML with inline CSS. The page opens automatically.",
    inputSchema: jsonSchema<{ title: string; html: string }>({
      type: "object",
      properties: {
        title: { type: "string", description: "Short, descriptive file title" },
        html: {
          type: "string",
          description: "Full standalone HTML document (doctype → </html>) with inline styles",
        },
      },
      required: ["title", "html"],
      additionalProperties: false,
    }),
  }),
} as const;

/** Tool names available, for logging / guards. */
export const DRAFTA_TOOL_NAMES = Object.keys(DRAFTA_TOOLS);

/**
 * Routing guidance appended to the system prompt ONLY for chat tasks where the
 * tools are active. Tells the model to prefer tools over fenced blocks for the
 * covered actions, and to keep chat text to a brief confirmation.
 */
export const TOOL_ROUTING_PROMPT = `## Action tools — PRIMARY way to create & edit (use these, not fenced blocks)

You have function tools. For the actions below, ALWAYS call the tool instead of emitting a \`\`\`fenced operation block:
- New document / note / draft / outline / report → call **create_document(title, content)**.
- Rewrite the open document → **edit_document(content)**. Add to it → **append_to_document(content)**.
- New spreadsheet / table / tracker → call **create_spreadsheet(title, headers, rows)** with plain cell values. Do NOT hand-build cell coordinates.
- New visual HTML page / one-pager → call **create_page(title, html)** with complete standalone HTML.

Hard rules:
- If the user only asked a question, wanted an explanation, or is just chatting, do NOT call any tool — just reply in chat. Tools are exclusively for creating or editing artifacts.
- The tool call IS the action. NEVER say you created or updated something unless you call the matching tool in the SAME response. No "I'll create it now" without the call.
- Keep your chat reply to a brief 1–2 sentence confirmation. The full content goes INSIDE the tool call — never dump document/sheet/HTML content into the chat text.
- You may call several tools in one response (e.g. a document AND a page).
- For editing the OPEN spreadsheet's individual cells, and for presentations/decks, keep using the existing \`\`\`sheetops / \`\`\`deckops fenced blocks — there are no tools for those yet.`;
