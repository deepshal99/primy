import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/db";
import {
  projects,
  knowledgeUnits,
  projectTables,
  projectDiagrams,
  projectDecks,
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";

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

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, session.user.id))
      .orderBy(desc(projects.updatedAt));

    if (userProjects.length === 0) {
      return Response.json([]);
    }

    // Batch-count entities per project using 4 lightweight queries (IDs only)
    const projectIds = userProjects.map((p) => p.id);

    const [kuCounts, tableCounts, diagramCounts, deckCounts] = await Promise.all([
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
        .select({ projectId: projectDiagrams.projectId, count: sql<number>`count(*)::int` })
        .from(projectDiagrams)
        .where(inArray(projectDiagrams.projectId, projectIds))
        .groupBy(projectDiagrams.projectId),
      db
        .select({ projectId: projectDecks.projectId, count: sql<number>`count(*)::int` })
        .from(projectDecks)
        .where(inArray(projectDecks.projectId, projectIds))
        .groupBy(projectDecks.projectId),
    ]);

    // Build lookup maps
    const kuCountMap = new Map(kuCounts.map((r) => [r.projectId, r.count]));
    const tableCountMap = new Map(tableCounts.map((r) => [r.projectId, r.count]));
    const diagramCountMap = new Map(diagramCounts.map((r) => [r.projectId, r.count]));
    const deckCountMap = new Map(deckCounts.map((r) => [r.projectId, r.count]));

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
        diagrams: diagramCountMap.get(p.id) || 0,
        decks: deckCountMap.get(p.id) || 0,
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
      diagrams: [],
      decks: [],
      messages: [],
    });
  } catch (error) {
    console.error("[API] POST /api/projects error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
