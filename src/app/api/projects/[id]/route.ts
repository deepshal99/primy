import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  knowledgeUnits,
  projectTables,
  projectDiagrams,
  projectDecks,
  messages,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";

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

    // Handle diagram upserts
    if (body.diagrams) {
      for (const diagram of body.diagrams) {
        const [existingDiagram] = await db
          .select()
          .from(projectDiagrams)
          .where(and(eq(projectDiagrams.id, diagram.id), eq(projectDiagrams.projectId, id)))
          .limit(1);

        if (existingDiagram) {
          await db
            .update(projectDiagrams)
            .set({
              title: diagram.title,
              diagramType: diagram.diagramType,
              source: diagram.source,
              updatedAt: new Date(),
            })
            .where(and(eq(projectDiagrams.id, diagram.id), eq(projectDiagrams.projectId, id)));
        } else {
          await db.insert(projectDiagrams).values({
            id: diagram.id,
            projectId: id,
            title: diagram.title,
            diagramType: diagram.diagramType || "mermaid",
            source: diagram.source || "",
          });
        }
      }
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

    // Handle deleted diagrams
    if (body.deletedDiagramIds?.length > 0) {
      await db
        .delete(projectDiagrams)
        .where(
          and(
            eq(projectDiagrams.projectId, id),
            inArray(projectDiagrams.id, body.deletedDiagramIds)
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
