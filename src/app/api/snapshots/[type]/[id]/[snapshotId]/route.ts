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
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getProjectAccess, type ProjectRole } from "@/lib/projectAccess";

type ArtifactType = "ku" | "table" | "deck";

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

function isValidType(t: string): t is ArtifactType {
  return t === "ku" || t === "table" || t === "deck";
}

async function canAccessArtifact(
  userId: string,
  type: ArtifactType,
  artifactId: string,
  minRole: ProjectRole
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

    const access = await getProjectAccess(row.projectId, userId);
    return !!access && ROLE_RANK[access.role] >= ROLE_RANK[minRole];
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

    const allowed = await canAccessArtifact(session.user.id, type, id, "viewer");
    if (!allowed) {
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
