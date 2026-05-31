import { auth } from "@/lib/auth";
import { db } from "@/db";
import { knowledgeUnits, projectTables, projectDecks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getProjectAccess, type ProjectRole } from "@/lib/projectAccess";

/**
 * POST /api/files/[id]/share — Generate share token for a KU, table, or deck
 * DELETE /api/files/[id]/share — Remove share token (unshare)
 */

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

/**
 * Resolve the entity (KU/table/deck) by id and authorize the user at editor+
 * on its parent project. Returns null on miss so callers 404.
 */
async function verifyOwnership(fileId: string, userId: string) {
  const minRank = ROLE_RANK.editor;
  const ok = async (projectId: string) => {
    const access = await getProjectAccess(projectId, userId);
    return !!access && ROLE_RANK[access.role] >= minRank;
  };

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

  if (ku && (await ok(ku.projectId))) {
    return { type: "ku" as const, entity: ku };
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

  if (table && (await ok(table.projectId))) {
    return { type: "table" as const, entity: table };
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

  if (deck && (await ok(deck.projectId))) {
    return { type: "deck" as const, entity: deck };
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
    } else if (result.type === "deck") {
      await db.update(projectDecks).set({ shareToken: null, updatedAt: new Date() }).where(eq(projectDecks.id, id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/files/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
