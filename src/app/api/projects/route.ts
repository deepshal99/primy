import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  knowledgeUnits,
  projectTables,
  messages,
} from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";

// GET /api/projects — list all projects for authenticated user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    // Batch-fetch all related entities in 3 queries (avoids N+1)
    const projectIds = userProjects.map((p) => p.id);

    const [allKUs, allTables, allMessages] = await Promise.all([
      db
        .select()
        .from(knowledgeUnits)
        .where(inArray(knowledgeUnits.projectId, projectIds))
        .orderBy(desc(knowledgeUnits.updatedAt)),
      db
        .select()
        .from(projectTables)
        .where(inArray(projectTables.projectId, projectIds))
        .orderBy(desc(projectTables.updatedAt)),
      db
        .select()
        .from(messages)
        .where(inArray(messages.projectId, projectIds))
        .orderBy(messages.timestamp),
    ]);

    // Group by projectId
    const kusByProject = new Map<string, typeof allKUs>();
    for (const ku of allKUs) {
      const arr = kusByProject.get(ku.projectId) || [];
      arr.push(ku);
      kusByProject.set(ku.projectId, arr);
    }

    const tablesByProject = new Map<string, typeof allTables>();
    for (const t of allTables) {
      const arr = tablesByProject.get(t.projectId) || [];
      arr.push(t);
      tablesByProject.set(t.projectId, arr);
    }

    const msgsByProject = new Map<string, typeof allMessages>();
    for (const m of allMessages) {
      const arr = msgsByProject.get(m.projectId) || [];
      arr.push(m);
      msgsByProject.set(m.projectId, arr);
    }

    const result = userProjects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      projectType: p.projectType,
      memory: p.memory || {},
      shareToken: p.shareToken || null,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
      knowledgeUnits: (kusByProject.get(p.id) || []).map((k) => ({
        id: k.id,
        projectId: k.projectId,
        title: k.title,
        content: k.content,
        shareToken: k.shareToken || null,
        createdAt: k.createdAt.getTime(),
        updatedAt: k.updatedAt.getTime(),
      })),
      tables: (tablesByProject.get(p.id) || []).map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        sheets: t.sheets,
        shareToken: t.shareToken || null,
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
      })),
      messages: (msgsByProject.get(p.id) || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime(),
        attachments: m.attachments,
      })),
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

    await ensureUserExists(session as any);

    const body = await req.json();
    const { id, title, description, projectType } = body;

    if (!id) {
      return Response.json({ error: "Client must provide an id" }, { status: 400 });
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
      messages: [],
    });
  } catch (error) {
    console.error("[API] POST /api/projects error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
