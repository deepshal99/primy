/**
 * Example project content for new user onboarding.
 * Created once when a user first signs in (hasOnboarded === false).
 */

import type { CellData, SheetData, DeckSlide } from "@/lib/types";

// ── Getting Started Document ──

export const GETTING_STARTED_DOC_TITLE = "Getting Started";

export const GETTING_STARTED_DOC_CONTENT = `# Welcome to Primy

Primy is your AI-powered workspace for creating and managing documents, spreadsheets, and presentations, all in one place.

## How it works

Everything starts with a conversation. Type a message in the chat panel on the left, and the AI assistant will help you create and edit content across all your workspace entities.

**Try saying:**
- "Create a table comparing React, Vue, and Angular"
- "Write a project brief for a mobile app"
- "Make a 5-slide pitch deck for my startup"

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Search across all entities |
| ⌘N | Create a new project |
| ⌘/ | Focus the chat input |
| ⌘B | Toggle the sidebar |
| ⌘Z | Undo last AI edit |
| ⌘⇧Z | Redo |

## Tips

- **Mention entities** in chat with \`@\` to give the AI context about specific documents or tables.
- **Upload files** (PDF, DOCX, XLSX, images) by dragging them into the chat. The AI can read and analyze them.
- **Share anything**: every entity has a share button that generates a public link.

Happy building!
`;

// ── Task Tracker Table ──

export const TASK_TRACKER_TITLE = "Task Tracker";

function cell(r: number, c: number, v: string, opts?: { bl?: number; bg?: string; fc?: string }): CellData {
  return {
    r,
    c,
    v: {
      v,
      m: v,
      ct: { fa: "General", t: "g" },
      ...(opts?.bl !== undefined ? { bl: opts.bl } : {}),
      ...(opts?.bg ? { bg: opts.bg } : {}),
      ...(opts?.fc ? { fc: opts.fc } : {}),
    },
  };
}

const headerStyle = { bl: 1, bg: "#f4f4f5", fc: "#1a1a2e" };

export const TASK_TRACKER_SHEETS: SheetData[] = [
  {
    name: "Tasks",
    order: 0,
    status: 1,
    config: {
      columnlen: { "0": 200, "1": 120, "2": 100, "3": 120 },
    },
    row: 10,
    column: 6,
    celldata: [
      // Headers
      cell(0, 0, "Task", headerStyle),
      cell(0, 1, "Status", headerStyle),
      cell(0, 2, "Priority", headerStyle),
      cell(0, 3, "Due Date", headerStyle),
      // Row 1
      cell(1, 0, "Set up project workspace"),
      cell(1, 1, "Done"),
      cell(1, 2, "High"),
      cell(1, 3, "2025-03-01"),
      // Row 2
      cell(2, 0, "Draft product requirements"),
      cell(2, 1, "In Progress"),
      cell(2, 2, "High"),
      cell(2, 3, "2025-03-05"),
      // Row 3
      cell(3, 0, "Design wireframes"),
      cell(3, 1, "To Do"),
      cell(3, 2, "Medium"),
      cell(3, 3, "2025-03-10"),
      // Row 4
      cell(4, 0, "Write API documentation"),
      cell(4, 1, "To Do"),
      cell(4, 2, "Medium"),
      cell(4, 3, "2025-03-15"),
      // Row 5
      cell(5, 0, "Schedule team review"),
      cell(5, 1, "To Do"),
      cell(5, 2, "Low"),
      cell(5, 3, "2025-03-20"),
    ],
  },
];

// ── Welcome Deck ──

export const WELCOME_DECK_TITLE = "Welcome Deck";

export const WELCOME_DECK_SLIDES: DeckSlide[] = [
  {
    id: "slide-1",
    layout: "title",
    title: "Welcome to Primy",
    subtitle: "Your AI-powered workspace for docs, sheets, and decks.",
  },
  {
    id: "slide-2",
    layout: "bullets",
    title: "What you can do",
    bullets: [
      "Write and format documents with AI assistance",
      "Build spreadsheets from natural language",
      "Create presentation decks in seconds",
      "Upload files for AI analysis",
    ],
  },
  {
    id: "slide-3",
    layout: "titleContent",
    title: "Get started",
    content: "Open the chat panel and describe what you want to create. The AI will generate documents, tables, or slides, and you can refine them with follow-up messages.\n\nEverything saves automatically. Happy building!",
  },
];
