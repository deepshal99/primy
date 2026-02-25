import { auth } from "@/lib/auth";
import { db } from "@/db";
import { knowledgeUnits, projectTables, projectDiagrams, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * POST /api/files/[id]/share — Generate share token for a KU, table, or diagram
 * DELETE /api/files/[id]/share — Remove share token (unshare)
 */

async function verifyOwnership(fileId: string, userId: string) {
  // Check if it's a KU
  const [ku] = await db
    .select({
      id: knowledgeUnits.id,
      projectId: knowledgeUnits.projectId,
      shareToken: knowledgeUnits.shareToken,
    })
    .from(knowledgeUnits)
    .where(eq(knowledgeUnits.id, fileId))
    .limit(1);

  if (ku) {
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, ku.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (proj) return { type: "ku" as const, entity: ku };
  }

  // Check if it's a table
  const [table] = await db
    .select({
      id: projectTables.id,
      projectId: projectTables.projectId,
      shareToken: projectTables.shareToken,
    })
    .from(projectTables)
    .where(eq(projectTables.id, fileId))
    .limit(1);

  if (table) {
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, table.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (proj) return { type: "table" as const, entity: table };
  }

  // Check if it's a diagram
  const [diagram] = await db
    .select({
      id: projectDiagrams.id,
      projectId: projectDiagrams.projectId,
      shareToken: projectDiagrams.shareToken,
    })
    .from(projectDiagrams)
    .where(eq(projectDiagrams.id, fileId))
    .limit(1);

  if (diagram) {
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, diagram.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (proj) return { type: "diagram" as const, entity: diagram };
  }

  return null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifyOwnership(id, session.user.id);

    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (result.entity.shareToken) {
      return Response.json({ shareToken: result.entity.shareToken });
    }

    const token = nanoid(16);

    if (result.type === "ku") {
      await db.update(knowledgeUnits).set({ shareToken: token, updatedAt: new Date() }).where(eq(knowledgeUnits.id, id));
    } else if (result.type === "table") {
      await db.update(projectTables).set({ shareToken: token, updatedAt: new Date() }).where(eq(projectTables.id, id));
    } else {
      await db.update(projectDiagrams).set({ shareToken: token, updatedAt: new Date() }).where(eq(projectDiagrams.id, id));
    }

    return Response.json({ shareToken: token });
  } catch (error) {
    console.error("[API] POST /api/files/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifyOwnership(id, session.user.id);

    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (result.type === "ku") {
      await db.update(knowledgeUnits).set({ shareToken: null, updatedAt: new Date() }).where(eq(knowledgeUnits.id, id));
    } else if (result.type === "table") {
      await db.update(projectTables).set({ shareToken: null, updatedAt: new Date() }).where(eq(projectTables.id, id));
    } else {
      await db.update(projectDiagrams).set({ shareToken: null, updatedAt: new Date() }).where(eq(projectDiagrams.id, id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/files/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
