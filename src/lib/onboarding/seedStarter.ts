import { db } from "@/db";
import { projects, knowledgeUnits } from "@/db/schema";
import { addProjectOwner } from "@/lib/projectAccess";
import { nanoid } from "nanoid";

// ── Starter workspace seeding ──
//
// On first onboarding completion we seed ONE tasteful, private "Start here"
// project with a welcome document — so new users (and demo testers) land on
// something alive instead of an empty screen. Static content (no AI cost),
// seeded exactly once, fully deletable (goes to Trash).

const WELCOME_DOC = `# 👋 Welcome to Primy

Primy is your AI workspace for **docs, sheets, and decks**: all in one place, all connected.

## Try it now
Open the chat and ask for anything:
- "Write a one-page project brief for a coffee subscription startup"
- "Build a 3-month content calendar as a sheet"
- "Make a 6-slide pitch deck for it"

Primy creates the doc, sheet, or deck for you, then you edit it like a normal editor.

## What's where
- **Sidebar**: your workspaces (projects) and files.
- **Quick Note**: frictionless personal capture. Always private to you.
- **Recents**: jump back into anything you touched.
- **⌘K**: search across everything.

## Private vs shared
Every project starts **private**, only you can see it. When it's ready, share it with your team or generate a public link. You stay in control.

## Why this beats the old way
No more "ask AI, download the file, reshare, someone edits, now it's out of date." Your docs, sheets, and decks live here, stay current, and your team works on the same thing.

---
*This is a sample to get you started. Edit or delete it anytime. (Deleting moves it to Trash; you can restore it.)*
`;

/**
 * Seed the starter workspace for a user. Caller guarantees this runs at most
 * once (on the false→true onboarding transition). Best-effort: failures are
 * logged and swallowed so a seeding hiccup never blocks onboarding.
 */
export async function seedStarterWorkspace(userId: string): Promise<void> {
  try {
    const projectId = nanoid();
    await db.insert(projects).values({
      id: projectId,
      userId,
      title: "👋 Start here",
      description: "A quick tour of Primy. Edit or delete anytime.",
      visibility: "private",
      status: "active",
    });
    await addProjectOwner(projectId, userId);

    await db.insert(knowledgeUnits).values({
      id: nanoid(),
      projectId,
      title: "Welcome to Primy",
      content: WELCOME_DOC,
    });
  } catch (e) {
    console.warn("[seedStarter] failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}
