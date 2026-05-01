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
  projects,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PLAN_LIMITS } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing/effectivePlan";
import { users as usersTable } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";

type ArtifactType = "ku" | "table" | "deck";

function isValidType(t: string): t is ArtifactType {
  return t === "ku" || t === "table" || t === "deck";
}

async function ownsArtifact(
  userId: string,
  type: ArtifactType,
  artifactId: string
): Promise<boolean> {
  try {
    const tableMap = {
      ku: knowledgeUnits,
      table: projectTables,
      deck: projectDecks,
    } as const;
    const t = tableMap[type];
    const [row] = await db
      .select({ projectId: t.projectId })
      .from(t)
      .where(eq(t.id, artifactId))
      .limit(1);
    if (!row) return false;
    const [proj] = await db
      .select({ userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.id, row.projectId), eq(projects.userId, userId)))
      .limit(1);
    return !!proj;
  } catch {
    return false;
  }
}

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
    if (!isValidType(type) || !id || !snapshotId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const owned = await ownsArtifact(userId, type, id);
    if (!owned) {
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
      const [u] = await db
        .select({ plan: usersTable.plan, proUntil: usersTable.proUntil })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      const plan = u
        ? effectivePlan({ plan: u.plan, proUntil: u.proUntil })
        : "free";
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
