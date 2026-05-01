/**
 * Single snapshot read.
 *
 *   GET /api/snapshots/[type]/[id]/[snapshotId]
 *     → returns { id, label, createdAt, content } for one snapshot.
 *       Used by the version history UI when previewing a version.
 *
 * Auth: ownership chain — snapshot.artifact -> project -> user. Not
 * found → 404 (no 403 leak).
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

export async function GET(
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
    const { type, id, snapshotId } = await params;
    if (!isValidType(type) || !id || !snapshotId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const owned = await ownsArtifact(session.user.id, type, id);
    if (!owned) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const [snap] = await db
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

    if (!snap) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      snapshot: {
        id: snap.id,
        label: snap.label,
        createdAt: snap.createdAt.getTime(),
        content: snap.content,
      },
    });
  } catch (error) {
    console.error(
      "[API] GET /api/snapshots/[type]/[id]/[snapshotId] error:",
      error
    );
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
