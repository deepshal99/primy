import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, knowledgeUnits, projectTables, projectDecks, projectPages, folders } from "@/db/schema";
import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";

/**
 * Personal Trash — soft-deleted projects + entities the user owns.
 *   GET    /api/trash                  — list deleted projects + entities
 *   POST   /api/trash { type, id }     — restore (clear deletedAt)
 *   DELETE /api/trash?type=&id=        — permanent hard delete
 *
 * Ownership is checked via projects.userId (the creator). Entities of a deleted
 * project are not listed separately — restoring the project brings them back.
 */

type EntityType = "ku" | "table" | "deck" | "page" | "folder";
const ENTITY_TABLES = {
  ku: knowledgeUnits,
  table: projectTables,
  deck: projectDecks,
  page: projectPages,
  folder: folders,
} as const;

async function requireUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Soft-deleted projects this user owns.
    const deletedProjects = await db
      .select({ id: projects.id, title: projects.title, deletedAt: projects.deletedAt })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNotNull(projects.deletedAt)))
      .orderBy(desc(projects.deletedAt));

    // Soft-deleted entities inside the user's NON-deleted projects.
    const entityQueries = (Object.keys(ENTITY_TABLES) as EntityType[]).map(async (type) => {
      const t = ENTITY_TABLES[type];
      const rows = await db
        .select({
          id: t.id,
          title: type === "folder" ? folders.name : (t as typeof knowledgeUnits).title,
          projectId: t.projectId,
          projectTitle: projects.title,
          deletedAt: t.deletedAt,
        })
        .from(t)
        .innerJoin(projects, eq(projects.id, t.projectId))
        .where(and(eq(projects.userId, userId), isNull(projects.deletedAt), isNotNull(t.deletedAt)))
        .orderBy(desc(t.deletedAt));
      return rows.map((r) => ({ ...r, type }));
    });

    const entityResults = (await Promise.all(entityQueries)).flat();
    entityResults.sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));

    return Response.json({
      projects: deletedProjects.map((p) => ({ id: p.id, title: p.title, deletedAt: p.deletedAt?.getTime() ?? null })),
      items: entityResults.map((e) => ({
        type: e.type,
        id: e.id,
        title: e.title,
        projectId: e.projectId,
        projectTitle: e.projectTitle,
        deletedAt: e.deletedAt?.getTime() ?? null,
      })),
    });
  } catch (error) {
    console.error("[API] GET /api/trash error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Verify the user owns the target (project, or the entity's parent project). */
async function ownsTarget(userId: string, type: string, id: string): Promise<boolean> {
  if (type === "project") {
    const [p] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, id)).limit(1);
    return p?.userId === userId;
  }
  const t = ENTITY_TABLES[type as EntityType];
  if (!t) return false;
  const [row] = await db
    .select({ ownerId: projects.userId })
    .from(t)
    .innerJoin(projects, eq(projects.id, t.projectId))
    .where(eq(t.id, id))
    .limit(1);
  return row?.ownerId === userId;
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { type?: string; id?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { type, id } = body;
    if (!type || !id) return Response.json({ error: "type and id are required" }, { status: 400 });
    if (!(await ownsTarget(userId, type, id))) return Response.json({ error: "Not found" }, { status: 404 });

    if (type === "project") {
      await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, id));
    } else {
      const t = ENTITY_TABLES[type as EntityType];
      if (!t) return Response.json({ error: "Invalid type" }, { status: 400 });
      await db.update(t).set({ deletedAt: null }).where(eq(t.id, id));
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/trash error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");
    if (!type || !id) return Response.json({ error: "type and id are required" }, { status: 400 });
    if (!(await ownsTarget(userId, type, id))) return Response.json({ error: "Not found" }, { status: 404 });

    if (type === "project") {
      await db.delete(projects).where(eq(projects.id, id));
    } else {
      const t = ENTITY_TABLES[type as EntityType];
      if (!t) return Response.json({ error: "Invalid type" }, { status: 400 });
      await db.delete(t).where(eq(t.id, id));
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/trash error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
