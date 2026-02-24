import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  projects,
  knowledgeUnits,
  projectTables,
  messages,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Ensure the authenticated user has a row in the users table.
 * This handles the case where the DB was reset but the browser
 * still holds a valid JWT from a previous session.
 */
async function ensureUserExists(session: { user: { id: string; name?: string | null; email?: string | null } }) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({
      id: session.user.id,
      name: session.user.name || session.user.email?.split("@")[0] || "User",
      email: session.user.email || `${session.user.id}@placeholder.local`,
      passwordHash: "MIGRATED_SESSION", // placeholder — user already authenticated via JWT
    }).onConflictDoNothing();
  }
}

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

    // Fetch related entities for each project
    const result = await Promise.all(
      userProjects.map(async (p) => {
        const [kus, tables, msgs] = await Promise.all([
          db
            .select()
            .from(knowledgeUnits)
            .where(eq(knowledgeUnits.projectId, p.id))
            .orderBy(desc(knowledgeUnits.updatedAt)),
          db
            .select()
            .from(projectTables)
            .where(eq(projectTables.projectId, p.id))
            .orderBy(desc(projectTables.updatedAt)),
          db
            .select()
            .from(messages)
            .where(eq(messages.projectId, p.id))
            .orderBy(messages.timestamp),
        ]);

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          projectType: p.projectType,
          memory: p.memory || {},
          createdAt: p.createdAt.getTime(),
          updatedAt: p.updatedAt.getTime(),
          knowledgeUnits: kus.map((k) => ({
            id: k.id,
            projectId: k.projectId,
            title: k.title,
            content: k.content,
            createdAt: k.createdAt.getTime(),
            updatedAt: k.updatedAt.getTime(),
          })),
          tables: tables.map((t) => ({
            id: t.id,
            projectId: t.projectId,
            title: t.title,
            sheets: t.sheets,
            createdAt: t.createdAt.getTime(),
            updatedAt: t.updatedAt.getTime(),
          })),
          messages: msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.getTime(),
            attachments: m.attachments,
          })),
        };
      })
    );

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
