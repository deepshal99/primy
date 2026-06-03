import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  projects,
  folders,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projectPages,
  messages,
} from "@/db/schema";
import { eq, and, inArray, desc, sql, isNull } from "drizzle-orm";
import { ensureUserExists } from "@/lib/db/ensureUser";
import { logActivity } from "@/lib/activity";
import {
  requireProjectAccess,
  accessErrorResponse,
  addProjectOwner,
} from "@/lib/projectAccess";

const MESSAGES_PER_PAGE = 50;

/**
 * Ensure project row exists. Handles race condition where PUT arrives
 * before the background POST that creates the project row. New rows get an
 * owner membership so the project is access-correct from birth.
 */
async function ensureProjectExists(id: string, userId: string, body: Record<string, any>) {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!existing) {
    await db.insert(projects).values({
      id,
      userId,
      title: body.title || "New Project",
      description: body.description,
      projectType: body.projectType,
    }).onConflictDoNothing();
    await addProjectOwner(id, userId);
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

    // Authorize: any member (viewer+) may read. Capture the caller's role so
    // the client can present a read-only experience to viewers/commenters.
    let callerRole = "owner";
    try {
      const access = await requireProjectAccess(id, session.user.id, "viewer");
      callerRole = access.role;
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all entities + folders + last N+1 messages in parallel
    const [allFolders, allKUs, allTables, allDecks, allPages, recentMessages, totalMessageCount] =
      await Promise.all([
        db
          .select()
          .from(folders)
          .where(and(eq(folders.projectId, id), isNull(folders.deletedAt)))
          .orderBy(folders.position),
        db
          .select()
          .from(knowledgeUnits)
          .where(and(eq(knowledgeUnits.projectId, id), isNull(knowledgeUnits.deletedAt)))
          .orderBy(desc(knowledgeUnits.updatedAt)),
        db
          .select()
          .from(projectTables)
          .where(and(eq(projectTables.projectId, id), isNull(projectTables.deletedAt)))
          .orderBy(desc(projectTables.updatedAt)),
        db
          .select()
          .from(projectDecks)
          .where(and(eq(projectDecks.projectId, id), isNull(projectDecks.deletedAt)))
          .orderBy(desc(projectDecks.updatedAt)),
        db
          .select()
          .from(projectPages)
          .where(and(eq(projectPages.projectId, id), isNull(projectPages.deletedAt)))
          .orderBy(desc(projectPages.updatedAt)),
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
      folders: allFolders.map((f) => ({
        id: f.id,
        projectId: f.projectId,
        name: f.name,
        color: f.color,
        position: f.position,
        createdAt: f.createdAt.getTime(),
        updatedAt: f.updatedAt.getTime(),
      })),
      knowledgeUnits: allKUs.map((k) => ({
        id: k.id,
        projectId: k.projectId,
        folderId: k.folderId || null,
        title: k.title,
        content: k.content,
        shareToken: k.shareToken || null,
        createdAt: k.createdAt.getTime(),
        updatedAt: k.updatedAt.getTime(),
      })),
      tables: allTables.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        folderId: t.folderId || null,
        title: t.title,
        sheets: t.sheets,
        shareToken: t.shareToken || null,
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
      })),
      decks: allDecks.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        folderId: d.folderId || null,
        title: d.title,
        theme: d.theme,
        style: d.style || null,
        slides: d.slides,
        shareToken: d.shareToken || null,
        createdAt: d.createdAt.getTime(),
        updatedAt: d.updatedAt.getTime(),
      })),
      pages: allPages.map((pg) => ({
        id: pg.id,
        projectId: pg.projectId,
        folderId: pg.folderId || null,
        title: pg.title,
        html: pg.html,
        editableFields: pg.editableFields || [],
        sourceKuId: pg.sourceKuId || null,
        shareToken: pg.shareToken || null,
        createdAt: pg.createdAt.getTime(),
        updatedAt: pg.updatedAt.getTime(),
      })),
      messages: chronologicalMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime(),
        attachments: m.attachments,
      })),
      hasMoreMessages: totalMessages > MESSAGES_PER_PAGE,
      myRole: callerRole,
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

    // Ensure project exists (handles race with background POST). This makes
    // the caller an owner if the project is being created here.
    await ensureProjectExists(id, session.user.id, body);

    // Authorize: editor+ may write.
    try {
      await requireProjectAccess(id, session.user.id, "editor");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.projectType !== undefined) updates.projectType = body.projectType;
    if (body.memory !== undefined) updates.memory = body.memory;

    // Did this PUT actually change anything? A pure no-op save must NOT bump
    // projects.updatedAt, or the Library (ordered by updatedAt) reshuffles for
    // free. Seeded true when a project-level field is present.
    let mutated = Object.keys(updates).length > 1;

    // Folder upserts (in-project grouping). One existence query for the whole
    // batch instead of a SELECT per folder.
    if (body.folders?.length > 0) {
      const ids = body.folders.map((f: any) => f.id);
      const existing = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.projectId, id), inArray(folders.id, ids)));
      const existingIds = new Set(existing.map((r) => r.id));
      for (const f of body.folders) {
        if (existingIds.has(f.id)) {
          await db
            .update(folders)
            .set({ name: f.name, color: f.color, position: f.position ?? 0, updatedAt: new Date() })
            .where(and(eq(folders.id, f.id), eq(folders.projectId, id)));
        } else {
          await db.insert(folders).values({
            id: f.id,
            projectId: id,
            name: f.name || "New Folder",
            color: f.color || "#FFB43F",
            position: f.position ?? 0,
          });
        }
      }
      mutated = true;
    }

    // Deleted folders — soft delete. Child entities keep their folderId; the
    // hidden folder just drops out of the board (they read as Unfiled) until
    // the folder is restored from Trash.
    if (body.deletedFolderIds?.length > 0) {
      await db
        .update(folders)
        .set({ deletedAt: new Date() })
        .where(and(eq(folders.projectId, id), inArray(folders.id, body.deletedFolderIds)));
      mutated = true;
    }

    // Entity → folder moves (dedicated path, so general upserts never touch
    // folder_id and can't null it on rename/save). folderId null = Unfiled.
    if (body.entityFolderMoves?.length > 0) {
      const tableFor: Record<string, typeof knowledgeUnits | typeof projectTables | typeof projectDecks | typeof projectPages> = {
        ku: knowledgeUnits,
        table: projectTables,
        deck: projectDecks,
        page: projectPages,
      };
      for (const mv of body.entityFolderMoves) {
        const tbl = tableFor[mv.entityType as string];
        if (!tbl) continue;
        await db
          .update(tbl)
          .set({ folderId: mv.folderId ?? null, updatedAt: new Date() })
          .where(and(eq(tbl.id, mv.id), eq(tbl.projectId, id)));
      }
      mutated = true;
    }

    // Handle knowledge unit upserts (with ownership check via projectId).
    // One existence query for the batch, then per-row writes.
    if (body.knowledgeUnits?.length > 0) {
      const ids = body.knowledgeUnits.map((k: any) => k.id);
      const existing = await db
        .select({ id: knowledgeUnits.id })
        .from(knowledgeUnits)
        .where(and(eq(knowledgeUnits.projectId, id), inArray(knowledgeUnits.id, ids)));
      const existingIds = new Set(existing.map((r) => r.id));
      for (const ku of body.knowledgeUnits) {
        if (existingIds.has(ku.id)) {
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
          await logActivity({ projectId: id, actorId: session.user.id, verb: "created", entityType: "ku", entityId: ku.id, meta: { title: ku.title } });
        }
      }
      mutated = true;
    }

    // Handle table upserts (with ownership check via projectId).
    if (body.tables?.length > 0) {
      const ids = body.tables.map((t: any) => t.id);
      const existing = await db
        .select({ id: projectTables.id })
        .from(projectTables)
        .where(and(eq(projectTables.projectId, id), inArray(projectTables.id, ids)));
      const existingIds = new Set(existing.map((r) => r.id));
      for (const table of body.tables) {
        if (existingIds.has(table.id)) {
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
          await logActivity({ projectId: id, actorId: session.user.id, verb: "created", entityType: "table", entityId: table.id, meta: { title: table.title } });
        }
      }
      mutated = true;
    }

    // Handle deleted KUs — soft delete (recoverable via Trash)
    if (body.deletedKnowledgeUnitIds?.length > 0) {
      await db
        .update(knowledgeUnits)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(knowledgeUnits.projectId, id),
            inArray(knowledgeUnits.id, body.deletedKnowledgeUnitIds)
          )
        );
      mutated = true;
    }

    // Handle deleted tables — soft delete
    if (body.deletedTableIds?.length > 0) {
      await db
        .update(projectTables)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(projectTables.projectId, id),
            inArray(projectTables.id, body.deletedTableIds)
          )
        );
      mutated = true;
    }

    // Handle deck upserts
    if (body.decks?.length > 0) {
      const ids = body.decks.map((d: any) => d.id);
      const existing = await db
        .select({ id: projectDecks.id })
        .from(projectDecks)
        .where(and(eq(projectDecks.projectId, id), inArray(projectDecks.id, ids)));
      const existingIds = new Set(existing.map((r) => r.id));
      for (const deck of body.decks) {
        if (existingIds.has(deck.id)) {
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
          await logActivity({ projectId: id, actorId: session.user.id, verb: "created", entityType: "deck", entityId: deck.id, meta: { title: deck.title } });
        }
      }
      mutated = true;
    }

    // Handle deleted decks — soft delete
    if (body.deletedDeckIds?.length > 0) {
      await db
        .update(projectDecks)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(projectDecks.projectId, id),
            inArray(projectDecks.id, body.deletedDeckIds)
          )
        );
      mutated = true;
    }

    // Handle page upserts (HTML visual documents)
    if (body.pages?.length > 0) {
      const ids = body.pages.map((p: any) => p.id);
      const existing = await db
        .select({ id: projectPages.id })
        .from(projectPages)
        .where(and(eq(projectPages.projectId, id), inArray(projectPages.id, ids)));
      const existingIds = new Set(existing.map((r) => r.id));
      for (const page of body.pages) {
        if (existingIds.has(page.id)) {
          const pageUpdates: Record<string, any> = { updatedAt: new Date() };
          if (page.title !== undefined) pageUpdates.title = page.title;
          if (page.html !== undefined) pageUpdates.html = page.html;
          if (page.editableFields !== undefined) pageUpdates.editableFields = page.editableFields;
          if (page.sourceKuId !== undefined) pageUpdates.sourceKuId = page.sourceKuId;
          await db
            .update(projectPages)
            .set(pageUpdates)
            .where(and(eq(projectPages.id, page.id), eq(projectPages.projectId, id)));
        } else {
          await db.insert(projectPages).values({
            id: page.id,
            projectId: id,
            title: page.title || "Untitled Page",
            html: page.html || "",
            editableFields: page.editableFields || [],
            sourceKuId: page.sourceKuId || null,
          });
          await logActivity({ projectId: id, actorId: session.user.id, verb: "created", entityType: "page", entityId: page.id, meta: { title: page.title || "Untitled Page" } });
        }
      }
      mutated = true;
    }

    // Handle deleted pages — soft delete
    if (body.deletedPageIds?.length > 0) {
      await db
        .update(projectPages)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(projectPages.projectId, id),
            inArray(projectPages.id, body.deletedPageIds)
          )
        );
      mutated = true;
    }

    // Handle new messages (append-only, skip duplicates). One existence query
    // for the batch, then insert only the genuinely new rows.
    if (body.newMessages?.length > 0) {
      const ids = body.newMessages.map((m: any) => m.id);
      const existing = await db
        .select({ id: messages.id })
        .from(messages)
        .where(inArray(messages.id, ids));
      const existingIds = new Set(existing.map((r) => r.id));
      const fresh = body.newMessages.filter((m: any) => !existingIds.has(m.id));
      if (fresh.length > 0) {
        await db.insert(messages).values(
          fresh.map((m: any) => ({
            id: m.id,
            projectId: id,
            role: m.role,
            content: m.content,
            attachments: m.attachments || [],
            timestamp: new Date(m.timestamp),
          }))
        );
        mutated = true;
      }
    }

    // Nothing actually changed — return the project as-is WITHOUT bumping
    // updatedAt, so a no-op debounced save doesn't reorder the Library.
    if (!mutated) {
      const [current] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return Response.json({ success: true, project: current });
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

    // Authorize: owner only.
    try {
      await requireProjectAccess(id, session.user.id, "owner");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    // Soft delete — recoverable from Trash (purged after 30 days by cron).
    await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/projects/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
