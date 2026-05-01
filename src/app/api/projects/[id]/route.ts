import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  knowledgeUnits,
  projectTables,
  projectDecks,
  messages,
} from "@/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";

const MESSAGES_PER_PAGE = 50;

/**
 * Ensure project row exists. Handles race condition where PUT arrives
 * before the background POST that creates the project row.
 */
async function ensureProjectExists(id: string, userId: string, body: Record<string, any>) {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!existing) {
    await db.insert(projects).values({
      id,
      userId,
      title: body.title || "New Project",
      description: body.description,
      projectType: body.projectType,
    }).onConflictDoNothing();
  }
}

// GET /api/projects/[id] — full project with all entities + last 50 messages
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch project with ownership check
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all entities + last N+1 messages in parallel
    const [allKUs, allTables, allDecks, recentMessages, totalMessageCount] =
      await Promise.all([
        db
          .select()
          .from(knowledgeUnits)
          .where(eq(knowledgeUnits.projectId, id))
          .orderBy(desc(knowledgeUnits.updatedAt)),
        db
          .select()
          .from(projectTables)
          .where(eq(projectTables.projectId, id))
          .orderBy(desc(projectTables.updatedAt)),
        db
          .select()
          .from(projectDecks)
          .where(eq(projectDecks.projectId, id))
          .orderBy(desc(projectDecks.updatedAt)),
        db
          .select()
          .from(messages)
          .where(eq(messages.projectId, id))
          .orderBy(desc(messages.timestamp))
          .limit(MESSAGES_PER_PAGE),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(eq(messages.projectId, id)),
      ]);

    const totalMessages = totalMessageCount[0]?.count ?? 0;

    // Reverse messages so they're in chronological order for display
    const chronologicalMessages = recentMessages.reverse();

    const result = {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      memory: project.memory || {},
      shareToken: project.shareToken || null,
      createdAt: project.createdAt.getTime(),
      updatedAt: project.updatedAt.getTime(),
      knowledgeUnits: allKUs.map((k) => ({
        id: k.id,
        projectId: k.projectId,
        title: k.title,
        content: k.content,
        shareToken: k.shareToken || null,
        createdAt: k.createdAt.getTime(),
        updatedAt: k.updatedAt.getTime(),
      })),
      tables: allTables.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        sheets: t.sheets,
        shareToken: t.shareToken || null,
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
      })),
      decks: allDecks.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        title: d.title,
        theme: d.theme,
        style: d.style || null,
        slides: d.slides,
        shareToken: d.shareToken || null,
        createdAt: d.createdAt.getTime(),
        updatedAt: d.updatedAt.getTime(),
      })),
      messages: chronologicalMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime(),
        attachments: m.attachments,
      })),
      hasMoreMessages: totalMessages > MESSAGES_PER_PAGE,
    };

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/projects/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/projects/[id] — update a project
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureUserExists(session as any);

    const { id } = await params;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Invalid project id" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Ensure project exists (handles race with background POST)
    await ensureProjectExists(id, session.user.id, body);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.projectType !== undefined) updates.projectType = body.projectType;
    if (body.memory !== undefined) updates.memory = body.memory;

    // Handle knowledge unit upserts (with ownership check via projectId)
    if (body.knowledgeUnits) {
      for (const ku of body.knowledgeUnits) {
        const [existingKu] = await db
          .select()
          .from(knowledgeUnits)
          .where(and(eq(knowledgeUnits.id, ku.id), eq(knowledgeUnits.projectId, id)))
          .limit(1);

        if (existingKu) {
          await db
            .update(knowledgeUnits)
            .set({
              title: ku.title,
              content: ku.content,
              updatedAt: new Date(),
            })
            .where(and(eq(knowledgeUnits.id, ku.id), eq(knowledgeUnits.projectId, id)));
        } else {
          await db.insert(knowledgeUnits).values({
            id: ku.id,
            projectId: id,
            title: ku.title,
            content: ku.content || "",
          });
        }
      }
    }

    // Handle table upserts (with ownership check via projectId)
    if (body.tables) {
      for (const table of body.tables) {
        const [existingTable] = await db
          .select()
          .from(projectTables)
          .where(and(eq(projectTables.id, table.id), eq(projectTables.projectId, id)))
          .limit(1);

        if (existingTable) {
          await db
            .update(projectTables)
            .set({
              title: table.title,
              sheets: table.sheets,
              updatedAt: new Date(),
            })
            .where(and(eq(projectTables.id, table.id), eq(projectTables.projectId, id)));
        } else {
          await db.insert(projectTables).values({
            id: table.id,
            projectId: id,
            title: table.title,
            sheets: table.sheets || [],
          });
        }
      }
    }

    // Handle deleted KUs
    if (body.deletedKnowledgeUnitIds?.length > 0) {
      await db
        .delete(knowledgeUnits)
        .where(
          and(
            eq(knowledgeUnits.projectId, id),
            inArray(knowledgeUnits.id, body.deletedKnowledgeUnitIds)
          )
        );
    }

    // Handle deleted tables
    if (body.deletedTableIds?.length > 0) {
      await db
        .delete(projectTables)
        .where(
          and(
            eq(projectTables.projectId, id),
            inArray(projectTables.id, body.deletedTableIds)
          )
        );
    }

    // Handle deck upserts
    if (body.decks) {
      for (const deck of body.decks) {
        const [existingDeck] = await db
          .select()
          .from(projectDecks)
          .where(and(eq(projectDecks.id, deck.id), eq(projectDecks.projectId, id)))
          .limit(1);

        if (existingDeck) {
          await db
            .update(projectDecks)
            .set({
              title: deck.title,
              theme: deck.theme,
              style: deck.style || null,
              slides: deck.slides,
              updatedAt: new Date(),
            })
            .where(and(eq(projectDecks.id, deck.id), eq(projectDecks.projectId, id)));
        } else {
          await db.insert(projectDecks).values({
            id: deck.id,
            projectId: id,
            title: deck.title,
            theme: deck.theme || "light",
            style: deck.style || null,
            slides: deck.slides || [],
          });
        }
      }
    }

    // Handle deleted decks
    if (body.deletedDeckIds?.length > 0) {
      await db
        .delete(projectDecks)
        .where(
          and(
            eq(projectDecks.projectId, id),
            inArray(projectDecks.id, body.deletedDeckIds)
          )
        );
    }

    // Handle new messages (append-only, skip duplicates)
    if (body.newMessages?.length > 0) {
      for (const m of body.newMessages) {
        const [exists] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.id, m.id))
          .limit(1);
        if (!exists) {
          await db.insert(messages).values({
            id: m.id,
            projectId: id,
            role: m.role,
            content: m.content,
            attachments: m.attachments || [],
            timestamp: new Date(m.timestamp),
          });
        }
      }
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .returning();

    return Response.json({ success: true, project: updated });
  } catch (error) {
    console.error("[API] PUT /api/projects/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — delete a project (cascades)
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

    // Verify ownership
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(projects).where(eq(projects.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/projects/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
