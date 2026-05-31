import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/db";
import {
  users,
  projects,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projectPages,
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";
import { addProjectOwner, listAccessibleProjectIds } from "@/lib/projectAccess";
import { nanoid } from "nanoid";
import {
  GETTING_STARTED_DOC_TITLE,
  GETTING_STARTED_DOC_CONTENT,
  TASK_TRACKER_TITLE,
  TASK_TRACKER_SHEETS,
  WELCOME_DECK_TITLE,
  WELCOME_DECK_SLIDES,
} from "@/lib/onboarding";

// GET /api/projects — lightweight project list (metadata + entity counts only)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`${session.user.id}:projects:get`, 60, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    await ensureUserExists(session as any);

    // ── Onboarding: create example project for first-time users ──
    const [user] = await db
      .select({ hasOnboarded: users.hasOnboarded })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user && !user.hasOnboarded) {
      await createExampleProject(session.user.id);
      await db
        .update(users)
        .set({ hasOnboarded: true })
        .where(eq(users.id, session.user.id));
    }

    // Membership-aware: owned projects + projects the user is a member of.
    const accessibleIds = await listAccessibleProjectIds(session.user.id);

    if (accessibleIds.length === 0) {
      return Response.json([]);
    }

    const userProjects = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, accessibleIds))
      .orderBy(desc(projects.updatedAt));

    if (userProjects.length === 0) {
      return Response.json([]);
    }

    // Batch-count entities per project using 4 lightweight queries (IDs only)
    const projectIds = userProjects.map((p) => p.id);

    const [kuCounts, tableCounts, deckCounts, pageCounts] = await Promise.all([
      db
        .select({ projectId: knowledgeUnits.projectId, count: sql<number>`count(*)::int` })
        .from(knowledgeUnits)
        .where(inArray(knowledgeUnits.projectId, projectIds))
        .groupBy(knowledgeUnits.projectId),
      db
        .select({ projectId: projectTables.projectId, count: sql<number>`count(*)::int` })
        .from(projectTables)
        .where(inArray(projectTables.projectId, projectIds))
        .groupBy(projectTables.projectId),
      db
        .select({ projectId: projectDecks.projectId, count: sql<number>`count(*)::int` })
        .from(projectDecks)
        .where(inArray(projectDecks.projectId, projectIds))
        .groupBy(projectDecks.projectId),
      db
        .select({ projectId: projectPages.projectId, count: sql<number>`count(*)::int` })
        .from(projectPages)
        .where(inArray(projectPages.projectId, projectIds))
        .groupBy(projectPages.projectId),
    ]);

    // Build lookup maps
    const kuCountMap = new Map(kuCounts.map((r) => [r.projectId, r.count]));
    const tableCountMap = new Map(tableCounts.map((r) => [r.projectId, r.count]));
    const deckCountMap = new Map(deckCounts.map((r) => [r.projectId, r.count]));
    const pageCountMap = new Map(pageCounts.map((r) => [r.projectId, r.count]));

    const result = userProjects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      projectType: p.projectType,
      shareToken: p.shareToken || null,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
      counts: {
        knowledgeUnits: kuCountMap.get(p.id) || 0,
        tables: tableCountMap.get(p.id) || 0,
        decks: deckCountMap.get(p.id) || 0,
        pages: pageCountMap.get(p.id) || 0,
      },
    }));

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/projects error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`${session.user.id}:projects:post`, 60, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    await ensureUserExists(session as any);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id, title, description, projectType } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Client must provide a valid string id" }, { status: 400 });
    }

    if (title && typeof title !== "string") {
      return Response.json({ error: "title must be a string" }, { status: 400 });
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        id,
        userId: session.user.id,
        title: title || "New Project",
        description,
        projectType,
      })
      .returning();

    await addProjectOwner(id, session.user.id);

    return Response.json({
      id: newProject.id,
      title: newProject.title,
      description: newProject.description,
      projectType: newProject.projectType,
      memory: newProject.memory || {},
      createdAt: newProject.createdAt.getTime(),
      updatedAt: newProject.updatedAt.getTime(),
      knowledgeUnits: [],
      tables: [],
      decks: [],
      messages: [],
    });
  } catch (error) {
    console.error("[API] POST /api/projects error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Onboarding helper: seed a "Welcome to Drafta" project ──

async function createExampleProject(userId: string) {
  const projectId = nanoid();
  const kuId = nanoid();
  const tableId = nanoid();
  const deckId = nanoid();

  await db.insert(projects).values({
    id: projectId,
    userId,
    title: "Welcome to Drafta",
    description: "Your getting-started project with an example document, a spreadsheet, and a slide deck.",
    projectType: "Other",
  });

  await addProjectOwner(projectId, userId);

  await Promise.all([
    db.insert(knowledgeUnits).values({
      id: kuId,
      projectId,
      title: GETTING_STARTED_DOC_TITLE,
      content: GETTING_STARTED_DOC_CONTENT,
    }),
    db.insert(projectTables).values({
      id: tableId,
      projectId,
      title: TASK_TRACKER_TITLE,
      sheets: TASK_TRACKER_SHEETS,
    }),
    db.insert(projectDecks).values({
      id: deckId,
      projectId,
      title: WELCOME_DECK_TITLE,
      slides: WELCOME_DECK_SLIDES,
    }),
  ]);
}
