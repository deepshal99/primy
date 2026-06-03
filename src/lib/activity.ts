import { db } from "@/db";
import { activityEvents, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// ── Project activity log ──
//
// Append-only stream powering the project's "Recent activity" strip and team
// accountability. Writes are best-effort and non-fatal: a logging failure must
// never break the action that triggered it. We log high-signal team events
// (created / deleted / shared / invited / joined) and deliberately skip noisy
// per-keystroke edits.

export type ActivityVerb =
  | "created"
  | "deleted"
  | "shared"
  | "unshared"
  | "invited"
  | "joined";

export async function logActivity(opts: {
  projectId: string;
  actorId: string;
  verb: ActivityVerb;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      id: nanoid(),
      projectId: opts.projectId,
      actorId: opts.actorId,
      verb: opts.verb,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      meta: opts.meta ?? {},
    });
  } catch (e) {
    console.warn("[activity] log failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}

export interface ActivityRow {
  id: string;
  verb: string;
  entityType: string | null;
  actorName: string | null;
  meta: Record<string, unknown>;
  createdAt: number;
}

/** Recent activity for a project, newest first, with actor display names. */
export async function listActivity(projectId: string, limit = 20): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: activityEvents.id,
      verb: activityEvents.verb,
      entityType: activityEvents.entityType,
      actorName: users.name,
      meta: activityEvents.meta,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(users.id, activityEvents.actorId))
    .where(eq(activityEvents.projectId, projectId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    verb: r.verb,
    entityType: r.entityType,
    actorName: r.actorName,
    meta: (r.meta as Record<string, unknown>) ?? {},
    createdAt: r.createdAt.getTime(),
  }));
}
