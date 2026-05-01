/**
 * Snapshot list / create endpoint.
 *
 *   GET  /api/snapshots/[type]/[id]
 *     → returns metadata-only list (id, label, createdAt) sorted desc.
 *       Per eng-review #24: content is NOT included — fetched only on
 *       single-snapshot GET or restore. Keeps timeline payloads tiny.
 *
 *   POST /api/snapshots/[type]/[id]
 *     → creates a snapshot of the artifact at this moment.
 *       Body: { content: jsonb, label?: string }.
 *       Plan-aware retention: silently prunes the oldest beyond
 *       PLAN_LIMITS[plan].snapshotsPerArtifact (5 free / 20 pro)
 *       BEFORE inserting — mirrors cron behavior, never rejects.
 *
 * Auth: ownership is verified by joining the artifact to its parent
 * project to confirm session.user.id owns the project. Unauthorized
 * access returns 404 (not 403) to avoid leaking artifact existence.
 */

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  artifactSnapshots,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projects,
  users,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PLAN_LIMITS } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing/effectivePlan";

type ArtifactType = "ku" | "table" | "deck";

function isValidType(t: string): t is ArtifactType {
  return t === "ku" || t === "table" || t === "deck";
}

/**
 * Verify the session user owns the artifact identified by (type, id).
 * Returns true iff the artifact's project belongs to userId.
 * Treats any failure as "not owned" so callers always 404 on miss.
 */
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
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { type, id } = await params;
    if (!isValidType(type) || !id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const owned = await ownsArtifact(session.user.id, type, id);
    if (!owned) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Metadata only — content excluded by selecting specific columns.
    const rows = await db
      .select({
        id: artifactSnapshots.id,
        label: artifactSnapshots.label,
        createdAt: artifactSnapshots.createdAt,
      })
      .from(artifactSnapshots)
      .where(
        and(
          eq(artifactSnapshots.artifactType, type),
          eq(artifactSnapshots.artifactId, id)
        )
      )
      .orderBy(desc(artifactSnapshots.createdAt));

    return Response.json({
      snapshots: rows.map((r) => ({
        id: r.id,
        label: r.label,
        createdAt: r.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error("[API] GET /api/snapshots/[type]/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { type, id } = await params;
    if (!isValidType(type) || !id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    let body: { content?: unknown; label?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.content === undefined || body.content === null) {
      return Response.json({ error: "Missing content" }, { status: 400 });
    }

    const owned = await ownsArtifact(userId, type, id);
    if (!owned) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Resolve effective plan once for retention.
    const [u] = await db
      .select({ plan: users.plan, proUntil: users.proUntil })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const plan = u
      ? effectivePlan({ plan: u.plan, proUntil: u.proUntil })
      : "free";
    const retention = PLAN_LIMITS[plan].snapshotsPerArtifact;

    // Auto-prune oldest beyond retention BEFORE insert (silent).
    // Keep retention - 1 newest, since we're about to add one more.
    const existing = await db
      .select({ id: artifactSnapshots.id })
      .from(artifactSnapshots)
      .where(
        and(
          eq(artifactSnapshots.artifactType, type),
          eq(artifactSnapshots.artifactId, id)
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

    // Sanitize label — clip to schema column width.
    const rawLabel = typeof body.label === "string" ? body.label.trim() : "";
    const label = rawLabel ? rawLabel.slice(0, 100) : null;

    const [inserted] = await db
      .insert(artifactSnapshots)
      .values({
        id: nanoid(),
        userId,
        artifactType: type,
        artifactId: id,
        label,
        content: body.content as any,
      })
      .returning({
        id: artifactSnapshots.id,
        label: artifactSnapshots.label,
        createdAt: artifactSnapshots.createdAt,
      });

    return Response.json({
      snapshot: {
        id: inserted.id,
        label: inserted.label,
        createdAt: inserted.createdAt.getTime(),
      },
    });
  } catch (error) {
    console.error("[API] POST /api/snapshots/[type]/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
