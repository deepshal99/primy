import { auth } from "@/lib/auth";
import { db } from "@/db";
import { knowledgeUnits, projectTables, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * POST /api/files/[id]/share — Generate share token for a KU or table
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
    // Verify project belongs to user
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

    // If already shared, return existing token
    if (result.entity.shareToken) {
      return Response.json({ shareToken: result.entity.shareToken });
    }

    const token = nanoid(16);

    if (result.type === "ku") {
      await db
        .update(knowledgeUnits)
        .set({ shareToken: token, updatedAt: new Date() })
        .where(eq(knowledgeUnits.id, id));
    } else {
      await db
        .update(projectTables)
        .set({ shareToken: token, updatedAt: new Date() })
        .where(eq(projectTables.id, id));
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
      await db
        .update(knowledgeUnits)
        .set({ shareToken: null, updatedAt: new Date() })
        .where(eq(knowledgeUnits.id, id));
    } else {
      await db
        .update(projectTables)
        .set({ shareToken: null, updatedAt: new Date() })
        .where(eq(projectTables.id, id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/files/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
