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
import { artifactSnapshots } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { canAccessArtifact, isValidArtifactType } from "@/lib/artifactAccess";

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
    if (!isValidArtifactType(type) || !id || !snapshotId) {
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
