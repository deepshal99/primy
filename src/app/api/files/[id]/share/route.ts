import { auth } from "@/lib/auth";
import { db } from "@/db";
import { knowledgeUnits, projectTables, projectDiagrams, projectDecks, projects } from "@/db/schema";
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

  // Check if it's a deck
  const [deck] = await db
    .select({
      id: projectDecks.id,
      projectId: projectDecks.projectId,
      shareToken: projectDecks.shareToken,
    })
    .from(projectDecks)
    .where(eq(projectDecks.id, fileId))
    .limit(1);

  if (deck) {
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, deck.projectId), eq(projects.userId, userId)))
      .limit(1);
    if (proj) return { type: "deck" as const, entity: deck };
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
    } else if (result.type === "diagram") {
      await db.update(projectDiagrams).set({ shareToken: token, updatedAt: new Date() }).where(eq(projectDiagrams.id, id));
    } else if (result.type === "deck") {
      await db.update(projectDecks).set({ shareToken: token, updatedAt: new Date() }).where(eq(projectDecks.id, id));
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
    } else if (result.type === "diagram") {
      await db.update(projectDiagrams).set({ shareToken: null, updatedAt: new Date() }).where(eq(projectDiagrams.id, id));
    } else if (result.type === "deck") {
      await db.update(projectDecks).set({ shareToken: null, updatedAt: new Date() }).where(eq(projectDecks.id, id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/files/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
