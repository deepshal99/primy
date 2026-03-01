# Drafta AI v1 Launch — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Drafta AI launch-ready for solo knowledge workers with reliable foundations, expanded AI capabilities, and polished UX.

**Architecture:** Three sequential phases — (1) Foundation & Trust fixes auth, save reliability, performance, and small CRUD gaps; (2) AI Capabilities adds inline doc editing improvements, smarter context, templates, and contextual suggestions; (3) UX Polish adds version history, direct table import, error boundaries, and technical cleanup. Each task is a standalone commit.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Zustand, Drizzle ORM + Neon PostgreSQL, Plate.js, Google Gemini via Vercel AI SDK, Resend (new — for email)

**No test framework is configured.** Verification is via `npm run build` + manual smoke testing after each task.

---

## Phase 1: Foundation & Trust (Week 1-2)

### Task 1: Add Save Status Indicator to TabBar

**Files:**
- Modify: `src/lib/store.ts` (~line 2047, 2156–2165)
- Modify: `src/components/workspace/TabBar.tsx` (~line 188–232)

**Step 1: Add `saveError` field to store**

In `src/lib/store.ts`, the store already has `isSaving` (set at line 2047) and `lastSavedAt` (set at line 2165). Add a `saveError` field to track failures. In the `saveCurrentEntity` method:

```ts
// At the top of saveCurrentEntity (~line 2047):
set({ isSaving: true, saveError: null });

// In the .catch() block of updateProjectOnServer (~line 2156):
.catch((err) => {
  console.error("Failed to save:", err);
  set({ saveError: "Failed to save" });
  toast.error("Failed to save to server — changes are saved locally");
})
.finally(() => {
  set({ isSaving: false, lastSavedAt: Date.now() });
});
```

Add `saveError: null as string | null` to initial state, and `saveError: string | null` to `AppState` in `types.ts` (~line 399, next to `isSaving`).

**Step 2: Add save indicator to TabBar**

In `src/components/workspace/TabBar.tsx`, subscribe to `isSaving`, `lastSavedAt`, `saveError` from store. Add a status pill in the right-side toolbar area (before `{exportAction}`, ~line 205):

```tsx
// Imports: add Cloud, CloudOff, Loader2 from lucide-react

const isSaving = useAppStore((s) => s.isSaving);
const lastSavedAt = useAppStore((s) => s.lastSavedAt);
const saveError = useAppStore((s) => s.saveError);

// Inside the right-side toolbar div, before exportAction:
{currentEntityId && (
  <div className="flex items-center gap-1.5 px-2 text-[11px]">
    {saveError ? (
      <span className="flex items-center gap-1 text-red-500">
        <CloudOff className="w-3 h-3" /> Error
      </span>
    ) : isSaving ? (
      <span className="flex items-center gap-1 text-[#95928E]">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
      </span>
    ) : lastSavedAt > 0 ? (
      <span className="flex items-center gap-1 text-[#95928E]">
        <Cloud className="w-3 h-3" /> Saved
      </span>
    ) : null}
  </div>
)}
```

**Step 3: Verify and commit**

Run: `npm run build`
Expected: Build passes, no type errors.

```bash
git add src/lib/store.ts src/lib/types.ts src/components/workspace/TabBar.tsx
git commit -m "feat: add save status indicator to tab bar"
```

---

### Task 2: Implement Password Reset Flow

**Step 1: Install Resend email library**

```bash
npm install resend
```

Add `RESEND_API_KEY` to `.env.local` (user must create a Resend account and get an API key).

**Step 2: Add password_reset_tokens table to DB schema**

In `src/db/schema.ts`, add after the existing tables:

```ts
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Run: `npx drizzle-kit push` to apply the schema.

**Step 3: Create forgot-password API route**

Create: `src/app/api/auth/forgot-password/route.ts`

```ts
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return Response.json({ error: "Email required" }, { status: 400 });

  // Always return success to prevent email enumeration
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) return Response.json({ success: true });

  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    id: nanoid(),
    userId: user.id,
    token,
    expiresAt,
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: "Drafta AI <noreply@yourdomain.com>",
    to: email,
    subject: "Reset your password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
  });

  return Response.json({ success: true });
}
```

**Step 4: Create reset-password API route**

Create: `src/app/api/auth/reset-password/route.ts`

```ts
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) return Response.json({ error: "Missing fields" }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const [resetToken] = await db.select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!resetToken) return Response.json({ error: "Invalid or expired token" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, resetToken.userId));

  return Response.json({ success: true });
}
```

**Step 5: Create reset-password page**

Create: `src/app/reset-password/page.tsx`

Build a simple form page with password + confirm password fields. On submit, POST to `/api/auth/reset-password` with the token from the URL search params. On success, redirect to `/login` with a success toast.

Follow the existing login page design patterns (same card layout, same styling using `design` tokens or Tailwind classes matching the login page).

**Step 6: Add "Forgot password?" link to login page**

In `src/app/login/page.tsx`, add a link below the password field (when `mode === "signin"`):

```tsx
{mode === "signin" && (
  <a href="/reset-password" className="text-[12px] text-[#6b6b80] hover:text-[#1a1a2e] transition-colors">
    Forgot password?
  </a>
)}
```

Actually this should link to a forgot-password page that just has an email input, not the reset page directly. Create `src/app/forgot-password/page.tsx` with a single email input that POSTs to `/api/auth/forgot-password`.

**Step 7: Verify and commit**

Run: `npm run build`
Expected: Build passes.

```bash
git add -A
git commit -m "feat: add password reset flow with email via Resend"
```

---

### Task 3: Paginate Project Loading

**Files:**
- Modify: `src/app/api/projects/route.ts` (~lines 101–155)
- Modify: `src/app/api/projects/[id]/route.ts`
- Modify: `src/lib/store.ts` (project loading logic)

**Step 1: Make GET /api/projects return lightweight list**

In `src/app/api/projects/route.ts`, change the GET response to return project metadata only — NOT entity content or messages. Each project in the response should have:

```ts
{
  id, title, description, projectType, shareToken, createdAt, updatedAt,
  counts: {
    knowledgeUnits: number,
    tables: number,
    diagrams: number,
    decks: number,
    messages: number,
  }
}
```

Remove the heavy joins that fetch all KUs, tables, diagrams, decks, messages. Instead, use COUNT queries or fetch just the counts.

**Step 2: Load full project on open**

When user opens a project, call `GET /api/projects/[id]` which already returns the full project. In the store's `setCurrentProject()` or equivalent, fetch the full project if its entities aren't loaded yet.

Add a `projectsLoaded: Set<string>` to the store to track which projects have been fully fetched. When opening a project not in this set, fetch from the API first.

**Step 3: Add message pagination endpoint**

Create or modify: `src/app/api/projects/[id]/messages/route.ts`

```ts
// GET /api/projects/[id]/messages?before=<timestamp>&limit=50
// Returns messages older than the given timestamp, sorted newest first
```

In the store, add a `loadEarlierMessages(projectId: string)` action that fetches the next page and prepends to the messages array.

**Step 4: Limit initial messages**

In `GET /api/projects/[id]`, limit messages to the most recent 50. Add a `hasMoreMessages: boolean` flag to the response.

**Step 5: Verify and commit**

Run: `npm run build`
Expected: Build passes.

```bash
git add -A
git commit -m "feat: paginate project loading — lightweight list + on-demand full fetch"
```

---

### Task 4: Onboarding — Welcome Modal & Example Project

**Files:**
- Modify: `src/db/schema.ts` (add `hasOnboarded` to users)
- Create: `src/components/onboarding/WelcomeModal.tsx`
- Modify: `src/app/api/projects/route.ts` (auto-create example project)
- Modify: `src/components/AppShell.tsx` (show welcome modal)

**Step 1: Add hasOnboarded flag to users**

In `src/db/schema.ts`, add to the `users` table:

```ts
hasOnboarded: boolean("has_onboarded").default(false).notNull(),
```

Run: `npx drizzle-kit push`

**Step 2: Create example project on first login**

In `GET /api/projects`, check if the user has `hasOnboarded === false`. If so:
1. Create a "Welcome to Drafta" project with pre-populated entities (a getting-started doc, a sample table, a simple diagram, a 3-slide deck)
2. Set `hasOnboarded = true` on the user
3. Return the projects list including the new project

Define the example content as constants in a new file `src/lib/onboarding/exampleProject.ts`.

**Step 3: Build WelcomeModal component**

Create `src/components/onboarding/WelcomeModal.tsx` — a simple modal that:
- Shows "Welcome to Drafta AI!" with a brief description
- Lists 4 things the user can do (create docs, sheets, diagrams, decks)
- Has a "Get Started" button that closes the modal
- Only shows once (use `localStorage` flag: `drafta_welcomed`)

**Step 4: Show WelcomeModal in AppShell**

In `src/components/AppShell.tsx`, render `<WelcomeModal />` conditionally based on the localStorage flag.

**Step 5: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add onboarding — welcome modal + example project for new users"
```

---

### Task 5: Duplicate Diagram & Deck + AI DELETE & RENAME Operations

**Files:**
- Modify: `src/lib/types.ts` (add DELETE/RENAME to operation types)
- Modify: `src/lib/store.ts` (add `duplicateDiagram`, `duplicateDeck`, handle DELETE/RENAME ops in `finishStreaming`)
- Modify: `src/lib/ai/systemPrompt.ts` (document new operations)
- Modify: `src/components/workspace/ProjectHome.tsx` (wire duplicate for diagram/deck)

**Step 1: Add operation types**

In `src/lib/types.ts`:

```ts
// DiagramOperation — add after existing types (~line 352):
| { type: "DELETE"; diagramId: string }
| { type: "RENAME"; diagramId: string; title: string }

// DeckOperation — add after existing types (~line 287):
| { type: "DELETE"; deckId: string }
| { type: "RENAME"; deckId: string; title: string }

// KuOperation — add DELETE (~line 311):
| { type: "DELETE"; kuId: string }

// TableOperation — add DELETE (~line 337):
| { type: "DELETE"; tableId: string }
```

**Step 2: Add duplicateDiagram and duplicateDeck to store**

In `src/lib/store.ts`, follow the `duplicateKnowledgeUnit` pattern (lines 1403–1449):

```ts
duplicateDiagram: (projectId, diagramId) => {
  get().saveCurrentEntity();
  const project = get().projects.find((p) => p.id === projectId);
  if (!project) return;
  const original = project.diagrams.find((d) => d.id === diagramId);
  if (!original) return;

  const diagram: ProjectDiagram = {
    id: nanoid(),
    title: `${original.title} (copy)`,
    diagramType: original.diagramType,
    source: original.source,
    shareToken: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Push to project, open it, save to server — same pattern as duplicateKnowledgeUnit
},

duplicateDeck: (projectId, deckId) => {
  // Same pattern but for decks — deep clone slides with JSON.parse(JSON.stringify())
},
```

Add both to `AppState` interface in `types.ts`.

**Step 3: Handle DELETE and RENAME in finishStreaming**

In `src/lib/store.ts` `finishStreaming`, add handling for each operation type:

For KU DELETE: Filter out the KU from `project.knowledgeUnits`, close its tab if open, add `kuId` to `deletedKnowledgeUnitIds` in the server sync payload.

For diagram/deck DELETE: Same pattern — filter from array, close tab, sync delete to server.

For diagram/deck RENAME: Find by ID, update title, sync to server.

**Step 4: Wire duplicate in ProjectHome**

In `src/components/workspace/ProjectHome.tsx`:
- Subscribe to `duplicateDiagram` and `duplicateDeck` from store (~line 128)
- Change `canDuplicate` guard (line 372) to always be `true`
- Extend `handleDuplicate` (lines 206–209) with `entity.type === "diagram"` and `entity.type === "deck"` branches

**Step 5: Update system prompt**

In `src/lib/ai/systemPrompt.ts`, add DELETE and RENAME docs to the `diagramops` and `deckops` sections. Add DELETE to `kuops` and `tableops` sections. Follow the existing documentation format.

**Step 6: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add duplicate diagram/deck + AI DELETE/RENAME for all entity types"
```

---

### Task 6: API Rate Limiting

**Files:**
- Create: `src/lib/rateLimit.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/extract/route.ts`
- Modify: `src/app/api/embeddings/route.ts`

**Step 1: Create rate limiter utility**

Create `src/lib/rateLimit.ts`:

```ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true; // allowed
}
```

**Step 2: Apply to API routes**

At the top of each route handler, after auth check:

```ts
import { checkRateLimit } from "@/lib/rateLimit";

// In the handler:
if (!checkRateLimit(`${userId}:chat`, 30, 60_000)) {
  return Response.json({ error: "Too many requests" }, { status: 429 });
}
```

Limits: `/api/chat` 30/min, `/api/projects` 60/min, `/api/extract` 10/min, `/api/embeddings` 20/min.

**Step 3: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add in-memory rate limiting to API routes"
```

---

## Phase 2: AI Capabilities (Week 2-3)

### Task 7: Improve Inline AI Editing in Documents

**Files:**
- Modify: `src/components/doc/SelectionBubble.tsx`
- Modify: `src/components/doc/DocView.tsx` (~lines 390–461, 502–554)
- Possibly create: `src/app/api/inline-edit/route.ts`

**Context:** DocView.tsx already has `runAIEdit()` (lines 390–461) that POSTs to `/api/chat` and a `SelectionBubble` component. The current UX requires the user to type a custom prompt. Enhance this with preset actions.

**Step 1: Add preset action buttons to SelectionBubble**

In `src/components/doc/SelectionBubble.tsx`, add quick-action buttons alongside or replacing the current text-input approach:

Preset actions: "Improve writing", "Fix grammar", "Make shorter", "Make longer", "Simplify", "Change tone → Professional / Casual / Academic"

Each button calls `onAction(actionPrompt, selectedText)` where the parent `DocView` handles it via the existing `runAIEdit`.

**Step 2: Improve runAIEdit UX**

In `src/components/doc/DocView.tsx`, modify the `runAIEdit` function to:
- Show a visual highlight on the selected text while streaming
- Display the streamed replacement inline (not in a modal)
- Add "Accept" / "Revert" buttons after streaming completes

**Step 3: Create lightweight inline-edit endpoint (optional)**

If the current `/api/chat` approach works well for inline edits, keep it. Otherwise, create `src/app/api/inline-edit/route.ts` — a simpler endpoint that uses Gemini Flash (fast, small) with just the selected text + action, no full project context.

**Step 4: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add preset inline AI editing actions in document editor"
```

---

### Task 8: Smarter Context Injection (Auto-include Active Entity)

**Files:**
- Modify: `src/lib/store.ts` (send activeEntityId/Type in chat request)
- Modify: `src/app/api/chat/route.ts` (~lines 47, 107–165)

**Step 1: Send active entity context from client**

In the store's chat send action, include `activeEntityId` and `activeEntityType` in the POST body to `/api/chat`. These come from `state.currentEntityId` and `state.currentEntityType`.

**Step 2: Inject active entity in the chat route**

In `src/app/api/chat/route.ts`, after destructuring the body (~line 47), extract `activeEntityId` and `activeEntityType`. Look up the entity from the project context and inject its content as:

```
[Currently viewing: "{title}" ({type})]
{content — capped at 10KB}
```

Place this BEFORE the existing context blocks (~line 107). This way the AI always knows what the user is looking at.

**Step 3: Add context indicator to chat input**

In `src/components/chat/ChatInput.tsx`, show a small label above the input: "AI can see: {entityTitle}" when an entity is open, or "AI can see: Project overview" when no entity is open. Use `currentEntityId` and entity title from the store.

**Step 4: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: auto-inject active entity context into AI chat"
```

---

### Task 9: AI-Powered Project Templates

**Files:**
- Create: `src/lib/templates.ts`
- Create: `src/components/onboarding/TemplatePickerModal.tsx`
- Modify: `src/components/sidebar/NavRail.tsx` (or wherever "New Project" is triggered)
- Modify: `src/lib/store.ts` (add `createProjectFromTemplate` action)

**Step 1: Define template metadata**

Create `src/lib/templates.ts`:

```ts
export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  prompt: string; // AI prompt to generate the project content
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    title: "Blank Project",
    description: "Start from scratch",
    icon: "Plus",
    prompt: "", // no AI generation
  },
  {
    id: "business-plan",
    title: "Business Plan",
    description: "Executive summary, financials, org chart, and pitch deck",
    icon: "Briefcase",
    prompt: "Create a business plan project with: 1) A document titled 'Executive Summary' with sections for company overview, market analysis, and financial projections. 2) A spreadsheet titled 'Financial Projections' with revenue, expenses, and profit columns for 12 months. 3) A diagram titled 'Organization Chart' showing a simple org structure. 4) A presentation titled 'Pitch Deck' with 5 slides covering problem, solution, market, team, and ask.",
  },
  {
    id: "research",
    title: "Research Project",
    description: "Literature review, data collection, methodology flow",
    icon: "BookOpen",
    prompt: "Create a research project with: 1) A document titled 'Literature Review' with sections for introduction, background, methodology, and references. 2) A spreadsheet titled 'Data Collection' with columns for source, date, key findings, and relevance score. 3) A diagram titled 'Research Methodology' showing a flowchart of the research process.",
  },
  {
    id: "weekly-report",
    title: "Weekly Report",
    description: "Report template, metrics tracker, progress chart",
    icon: "BarChart3",
    prompt: "Create a weekly report project with: 1) A document titled 'Weekly Report' with sections for accomplishments, challenges, next week's plan, and blockers. 2) A spreadsheet titled 'Metrics Tracker' with columns for metric name, target, actual, and status for each week. 3) A diagram titled 'Progress Chart' showing a simple bar chart of weekly progress.",
  },
  {
    id: "course-notes",
    title: "Course Notes",
    description: "Lecture notes, schedule, concept map",
    icon: "GraduationCap",
    prompt: "Create a course notes project with: 1) A document titled 'Lecture Notes' with a template for date, topic, key concepts, and summary. 2) A spreadsheet titled 'Course Schedule' with columns for week, date, topic, readings, and assignments. 3) A diagram titled 'Concept Map' showing relationships between 5-6 key course concepts.",
  },
  {
    id: "content-calendar",
    title: "Content Calendar",
    description: "Content schedule, brand guidelines, workflow",
    icon: "Calendar",
    prompt: "Create a content calendar project with: 1) A spreadsheet titled 'Content Schedule' with columns for date, platform, content type, topic, status, and assigned to. 2) A document titled 'Brand Guidelines' with sections for tone of voice, target audience, and content pillars. 3) A diagram titled 'Content Workflow' showing a flowchart from ideation to publish.",
  },
];
```

**Step 2: Build TemplatePickerModal**

Create `src/components/onboarding/TemplatePickerModal.tsx` — a modal grid showing the 6 templates. On selection:
- If "Blank", create empty project (current behavior)
- Otherwise, create project then send the template prompt as the first AI message

**Step 3: Wire into NavRail's new project flow**

In `NavRail.tsx`, change the "New Project" button to open the TemplatePickerModal instead of immediately creating a blank project.

**Step 4: Add createProjectFromTemplate to store**

In the store, add an action that:
1. Creates a new project
2. If a template prompt is provided, sends it as the first chat message via the existing chat flow
3. Shows a "Setting up your project..." loading state

**Step 5: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add project templates — 6 starter templates with AI generation"
```

---

### Task 10: Contextual Suggestion Chips

**Files:**
- Modify: `src/components/chat/SuggestionChips.tsx`
- Modify: `src/components/chat/ExamplePrompts.tsx`

**Step 1: Make suggestion chips entity-aware**

In `SuggestionChips.tsx`, accept `currentEntityType` as a prop (or read from store). When the AI doesn't provide custom suggestions, fall back to entity-specific defaults:

```ts
const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  ku: ["Summarize this document", "Add a table of contents", "Expand the introduction", "Fix grammar and style"],
  table: ["Create a chart from this data", "Add a summary row", "Sort by first column", "Analyze trends"],
  diagram: ["Add more detail to this diagram", "Simplify the structure", "Convert to a different type", "Explain this diagram"],
  deck: ["Add a new slide about...", "Improve the slide design", "Generate speaker notes", "Add a Q&A slide"],
  default: ["Create a new document", "Build a spreadsheet", "Generate a diagram", "Make a presentation"],
};
```

**Step 2: Update ExamplePrompts for empty chat**

In `ExamplePrompts.tsx`, make the prompts contextual to the active entity type (if any) or show generic prompts for empty state.

**Step 3: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: contextual suggestion chips based on active entity type"
```

---

## Phase 3: UX Polish & Launch Prep (Week 3-4)

### Task 11: Version History

**Files:**
- Modify: `src/db/schema.ts` (add `entityVersions` table)
- Create: `src/app/api/versions/route.ts`
- Modify: `src/app/api/projects/[id]/route.ts` (save versions on PUT)
- Create: `src/components/workspace/VersionHistory.tsx`
- Modify: `src/components/workspace/TabBar.tsx` (add version history button)

**Step 1: Add entityVersions table**

In `src/db/schema.ts`:

```ts
export const entityVersions = pgTable("entity_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  entityId: text("entity_id").notNull(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  content: jsonb("content").notNull(),
  title: varchar("title", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_entity_versions_entity").on(table.entityId, table.entityType),
]);
```

Run: `npx drizzle-kit push`

**Step 2: Save versions on PUT**

In `PUT /api/projects/[id]`, when upserting an entity, also insert a version row. Keep only the latest 20 versions per entity (delete oldest after insert).

```ts
// After upserting a KU/table/diagram/deck:
await db.insert(entityVersions).values({
  id: nanoid(),
  projectId,
  entityId: entity.id,
  entityType: "ku", // or "table", "diagram", "deck"
  content: entity.content, // the full entity content
  title: entity.title,
});

// Cleanup: delete versions beyond 20
// SELECT id FROM entity_versions WHERE entityId = ? ORDER BY createdAt DESC OFFSET 20
// DELETE those IDs
```

**Step 3: Create versions API**

Create `src/app/api/versions/route.ts`:

```ts
// GET /api/versions?entityId=xxx&entityType=ku
// Returns list of versions: [{ id, title, createdAt }]
// GET /api/versions/[id]
// Returns full version content
```

**Step 4: Build VersionHistory component**

Create `src/components/workspace/VersionHistory.tsx` — a right sidebar panel:
- Shows a timeline of versions with timestamps
- Click a version to preview it (read-only overlay)
- "Restore this version" button replaces current entity content

**Step 5: Add version history button to TabBar**

In `TabBar.tsx`, add a `History` icon button that toggles the VersionHistory panel.

**Step 6: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add version history — 20 versions per entity with restore"
```

---

### Task 12: Direct Table Import (XLSX/CSV)

**Files:**
- Create: `src/lib/sheet/importSheet.ts`
- Modify: `src/components/sheet/SheetPanel.tsx` (add import button)

**Step 1: Create import utility**

Create `src/lib/sheet/importSheet.ts`:

```ts
import XLSX from "xlsx";

export function parseFileToSheetData(file: File): Promise<{ celldata: CellData[]; config?: SheetConfig }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // Convert to Fortune Sheet celldata format
      // ...iterate sheet cells, map to { r, c, v: { v: value } }
      resolve({ celldata, config });
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
```

**Step 2: Add import button to SheetPanel**

In `src/components/sheet/SheetPanel.tsx`, add an "Import" button next to the Export button. On click, open a file picker accepting `.xlsx,.csv,.tsv`. Parse the file using `parseFileToSheetData` and replace the current sheet data.

Also support drag-and-drop: wrap the sheet area in a drop zone that accepts spreadsheet files.

**Step 3: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add direct XLSX/CSV import into spreadsheet tables"
```

---

### Task 13: Error Boundaries for Editor Panels

**Files:**
- Create: `src/components/workspace/EditorErrorBoundary.tsx`
- Modify: `src/components/workspace/WorkspacePanel.tsx`

**Step 1: Create EditorErrorBoundary**

Create `src/components/workspace/EditorErrorBoundary.tsx`:

```tsx
"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  entityType: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.entityType} editor crash]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-[48px]">&#9888;</div>
          <h2 className="text-[16px] font-semibold text-[#1a1a2e]">
            Something went wrong
          </h2>
          <p className="text-[13px] text-[#6b6b80] text-center max-w-sm">
            The {this.props.entityType} editor encountered an error. Your work has been auto-saved.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[#ff4a00] text-white hover:bg-[#e54400] transition-colors"
          >
            Reload editor
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Step 2: Wrap panels in WorkspacePanel**

In `src/components/workspace/WorkspacePanel.tsx`, wrap each `dynamic()` panel render in `<EditorErrorBoundary>`:

```tsx
const renderPanel = () => {
  if (isDeck) return <EditorErrorBoundary entityType="deck"><DeckPanel /></EditorErrorBoundary>;
  if (isDiagram) return <EditorErrorBoundary entityType="diagram"><DiagramPanel /></EditorErrorBoundary>;
  if (isTable) return <EditorErrorBoundary entityType="sheet"><SheetPanel /></EditorErrorBoundary>;
  return <EditorErrorBoundary entityType="document"><DocPanel /></EditorErrorBoundary>;
};
```

**Step 3: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: add error boundaries around all editor panels"
```

---

### Task 14: Empty State Improvements

**Files:**
- Modify: `src/components/doc/DocView.tsx`
- Modify: `src/components/sheet/SheetView.tsx`
- Modify: `src/components/diagram/DiagramView.tsx`
- Modify: `src/components/deck/DeckPanel.tsx`
- Modify: `src/components/workspace/ProjectHome.tsx`

**Step 1: Add helpful placeholders to each empty editor**

Review each panel and add contextual empty-state text:
- **Document (empty)**: "Start typing or ask AI to help write something..."
- **Sheet (empty)**: Show an import prompt: "Import a file, paste data, or ask AI to create a table"
- **Diagram (empty)**: "Describe a diagram in chat, or pick a type to start drawing"
- **Deck (no slides)**: "Ask AI to generate a presentation, or add a blank slide"

**Step 2: Add template link to ProjectHome**

In `ProjectHome.tsx`, add a "Or start from a template" link below the 4 create buttons, which opens the TemplatePickerModal.

**Step 3: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "feat: improve empty states with helpful placeholders across all editors"
```

---

### Task 15: Technical Cleanup — Legacy Removal + Immer + Partial Save

**Files:**
- Modify: `src/lib/types.ts` (remove legacy Conversation types)
- Modify: `src/lib/store.ts` (remove legacy actions, add Immer, partial save)
- Modify: `src/app/api/projects/[id]/route.ts` (add PATCH for single entity)

**Step 1: Remove legacy Conversation system**

In `src/lib/types.ts`, remove or deprecate `Conversation`, `WorkspaceTab` (if unused), and all legacy-only fields.

In `src/lib/store.ts`, remove: `saveCurrentConversation`, `loadConversation`, `deleteConversation`, `renameConversation`, `newConversation`, `loadConversations`, and all `drafta_conversations` localStorage handling. Keep `migrateConversations()` with a deprecation comment for one more release.

**Step 2: Add Immer middleware**

```ts
import { immer } from "zustand/middleware/immer";

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    // ... existing state and actions
    // Now can use: set((draft) => { draft.projects[0].title = "new"; })
  }))
);
```

Refactor the most mutation-heavy actions first:
- `finishStreaming` (700+ lines of spread operators)
- Entity CRUD actions (addKnowledgeUnit, duplicateTable, etc.)
- `saveCurrentEntity`

**Step 3: Add partial entity save endpoint**

Create or add to `PUT /api/projects/[id]` — support a `partialEntity` field that only updates a single entity instead of the full project. This reduces payload size on every keystroke-triggered save.

Alternatively, create `PATCH /api/projects/[id]/entities/[entityId]` as a separate route.

**Step 4: Verify and commit**

Run: `npm run build`

```bash
git add -A
git commit -m "refactor: remove legacy conversation system, add Immer, optimize partial save"
```

---

## Final Verification Checklist

After all tasks are complete:

1. `npm run build` — zero errors
2. Sign up → see welcome modal + example project
3. Create project from template → AI generates entities
4. Edit a document → select text → use inline AI actions
5. Chat with AI while viewing an entity → AI references active context
6. Duplicate a diagram and a deck from ProjectHome
7. Ask AI to delete an entity → entity removed
8. Save indicator shows "Saving..." → "Saved" on every edit
9. Version history: make 5 edits → see 5 versions → restore version #2
10. Import an XLSX file into a spreadsheet
11. Force-crash an editor (throw in dev tools) → error boundary catches it
12. Forgot password → receive email → reset → login works
13. Rate limit: fire 40 chat requests in 1 minute → get 429 after 30

---

## Deployment

After each phase, deploy to Vercel:

```bash
git push origin main
vercel deploy --prod
```

Ensure all environment variables are set:
- `RESEND_API_KEY` (new — required for password reset emails)
- Existing: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GEMINI_API_KEY`, `NEXTAUTH_URL`
