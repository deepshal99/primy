import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  knowledgeUnits,
  projectTables,
  messages,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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

    const { id } = await params;
    const body = await req.json();

    // Verify ownership
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.projectType !== undefined) updates.projectType = body.projectType;
    if (body.memory !== undefined) updates.memory = body.memory;

    // Handle knowledge unit upserts
    if (body.knowledgeUnits) {
      for (const ku of body.knowledgeUnits) {
        const [existingKu] = await db
          .select()
          .from(knowledgeUnits)
          .where(eq(knowledgeUnits.id, ku.id))
          .limit(1);

        if (existingKu) {
          await db
            .update(knowledgeUnits)
            .set({
              title: ku.title,
              content: ku.content,
              updatedAt: new Date(),
            })
            .where(eq(knowledgeUnits.id, ku.id));
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

    // Handle table upserts
    if (body.tables) {
      for (const table of body.tables) {
        const [existingTable] = await db
          .select()
          .from(projectTables)
          .where(eq(projectTables.id, table.id))
          .limit(1);

        if (existingTable) {
          await db
            .update(projectTables)
            .set({
              title: table.title,
              sheets: table.sheets,
              updatedAt: new Date(),
            })
            .where(eq(projectTables.id, table.id));
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
      .where(eq(projects.id, id))
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
