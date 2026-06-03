/**
 * Snapshot restore.
 *
 *   POST /api/snapshots/[type]/[id]/[snapshotId]/restore
 *     → 1. Reads the target snapshot's content.
 *     → 2. Saves a "Pre-restore (auto)" snapshot of the CURRENT artifact
 *          state so the user can undo this restore.
 *     → 3. Writes the snapshot's content back to the artifact row.
 *     → 4. Returns { content } so the client can refresh its editor.
 *
 * Auth: ownership chain — snapshot.artifact -> project -> user.
 * 404 (no 403 leak) on unauthorized.
 *
 * Snapshot content shape (matches scheduler.ts writes):
 *   ku    → { docContent: string }  → writes knowledge_units.content
 *   table → { sheets: Sheet[] }     → writes project_tables.sheets jsonb
 *   deck  → { slides, theme }       → writes project_decks.{slides, theme}
 */

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  artifactSnapshots,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projectPages,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PLAN_LIMITS } from "@/lib/plans";
import { resolveEffectivePlan } from "@/lib/billing";
import { desc, inArray } from "drizzle-orm";
import { canAccessArtifact, isValidArtifactType, type ArtifactType } from "@/lib/artifactAccess";

async function loadCurrentContent(
  type: ArtifactType,
  artifactId: string
): Promise<unknown | null> {
  if (type === "ku") {
    const [row] = await db
      .select({ content: knowledgeUnits.content })
      .from(knowledgeUnits)
      .where(eq(knowledgeUnits.id, artifactId))
      .limit(1);
    return row ? { docContent: row.content ?? "" } : null;
  }
  if (type === "table") {
    const [row] = await db
      .select({ sheets: projectTables.sheets })
      .from(projectTables)
      .where(eq(projectTables.id, artifactId))
      .limit(1);
    return row ? { sheets: row.sheets } : null;
  }
  if (type === "page") {
    const [row] = await db
      .select({ html: projectPages.html, editableFields: projectPages.editableFields })
      .from(projectPages)
      .where(eq(projectPages.id, artifactId))
      .limit(1);
    return row ? { html: row.html, editableFields: row.editableFields } : null;
  }
  // deck
  const [row] = await db
    .select({ slides: projectDecks.slides, theme: projectDecks.theme })
    .from(projectDecks)
    .where(eq(projectDecks.id, artifactId))
    .limit(1);
  return row ? { slides: row.slides, theme: row.theme } : null;
}

async function writeRestoredContent(
  type: ArtifactType,
  artifactId: string,
  content: any
): Promise<void> {
  if (type === "ku") {
    await db
      .update(knowledgeUnits)
      .set({
        content: typeof content?.docContent === "string" ? content.docContent : "",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeUnits.id, artifactId));
    return;
  }
  if (type === "table") {
    await db
      .update(projectTables)
      .set({
        sheets: Array.isArray(content?.sheets) ? content.sheets : [],
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, artifactId));
    return;
  }
  if (type === "page") {
    await db
      .update(projectPages)
      .set({
        html: typeof content?.html === "string" ? content.html : "",
        editableFields: Array.isArray(content?.editableFields) ? content.editableFields : [],
        updatedAt: new Date(),
      })
      .where(eq(projectPages.id, artifactId));
    return;
  }
  // deck
  await db
    .update(projectDecks)
    .set({
      slides: Array.isArray(content?.slides) ? content.slides : [],
      theme: typeof content?.theme === "string" ? content.theme : "light",
      updatedAt: new Date(),
    })
    .where(eq(projectDecks.id, artifactId));
}

async function pruneToFit(
  type: ArtifactType,
  artifactId: string,
  retention: number
): Promise<void> {
  // Keep retention - 1 newest before insert. Mirrors the scheduler/POST behavior.
  const existing = await db
    .select({ id: artifactSnapshots.id })
    .from(artifactSnapshots)
    .where(
      and(
        eq(artifactSnapshots.artifactType, type),
        eq(artifactSnapshots.artifactId, artifactId)
      )
    )
    .orderBy(desc(artifactSnapshots.createdAt));
  const keepCount = Math.max(0, retention - 1);
  const toDelete = existing.slice(keepCount).map((r) => r.id);
  if (toDelete.length > 0) {
    await db
      .delete(artifactSnapshots)
      .where(inArray(artifactSnapshots.id, toDelete));
  }
}

export async function POST(
  _req: Request,
  {
    params,
  }: { params: Promise<{ type: string; id: string; snapshotId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { type, id, snapshotId } = await params;
    if (!isValidArtifactType(type) || !id || !snapshotId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const allowed = await canAccessArtifact(userId, type, id, "editor");
    if (!allowed) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // 1. Load target snapshot content
    const [target] = await db
      .select()
      .from(artifactSnapshots)
      .where(
        and(
          eq(artifactSnapshots.id, snapshotId),
          eq(artifactSnapshots.artifactType, type),
          eq(artifactSnapshots.artifactId, id)
        )
      )
      .limit(1);

    if (!target) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Save pre-restore snapshot (skipped if current state can't be read)
    const currentContent = await loadCurrentContent(type, id);
    if (currentContent !== null) {
      const plan = await resolveEffectivePlan(userId);
      const retention = PLAN_LIMITS[plan].snapshotsPerArtifact;

      await pruneToFit(type, id, retention);

      await db.insert(artifactSnapshots).values({
        id: nanoid(),
        userId,
        artifactType: type,
        artifactId: id,
        label: "Pre-restore (auto)",
        content: currentContent as any,
      });
    }

    // 3. Write target content back to artifact
    await writeRestoredContent(type, id, target.content);

    // 4. Return restored content so client can refresh editor
    return Response.json({
      content: target.content,
      restoredFrom: {
        id: target.id,
        label: target.label,
        createdAt: target.createdAt.getTime(),
      },
    });
  } catch (error) {
    console.error("[API] POST /api/snapshots/restore error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
