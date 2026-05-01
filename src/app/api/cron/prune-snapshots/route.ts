/**
 * Vercel cron: prune artifact_snapshots beyond plan retention.
 *
 * Schedule: weekly (Sundays 03:00 UTC, configured in vercel.json).
 *
 * For each (artifactType, artifactId) group:
 *   1. Resolve owning user's effective plan
 *      (plan === 'pro' OR proUntil > now()) → 'pro' else 'free'
 *   2. Look up retention from PLAN_LIMITS[plan].snapshotsPerArtifact
 *      (5 free / 20 pro)
 *   3. Delete all snapshots beyond the most recent N
 *
 * Authorization: requires `Authorization: Bearer <CRON_SECRET>` header.
 * Vercel cron auto-injects this when CRON_SECRET env is set in the
 * project settings. If CRON_SECRET is missing locally, every request is
 * unauthorized — we never default to allow-all for cron endpoints.
 *
 * Implementation: a single window-function DELETE in one round trip,
 * atomic at the row level. Plan resolution embedded in the SQL via
 * JOIN on users so we don't need a per-user fan-out.
 *
 * Returns: { pruned: number, scanned: number, durationMs: number }
 *
 * Note: `scanned` echoes `pruned` — counting the full snapshot row set
 * would require a second query and adds no operational value (the
 * actionable metric is "how many were deleted").
 */

import { db } from "@/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  // 1. Verify cron auth header.
  //    If CRON_SECRET is unset, ANY auth is rejected — no allow-all.
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  let pruned = 0;
  let scanned = 0;

  try {
    // Single SQL: rank snapshots per (artifactType, artifactId) by createdAt
    // DESC, embed plan-aware retention via JOIN on users, delete the
    // overflow.
    const result = await db.execute(sql`
      WITH ranked AS (
        SELECT s.id,
               ROW_NUMBER() OVER (
                 PARTITION BY s.artifact_type, s.artifact_id
                 ORDER BY s.created_at DESC
               ) AS rn,
               CASE
                 WHEN u.plan = 'pro' OR (u.pro_until IS NOT NULL AND u.pro_until > NOW())
                   THEN ${PLAN_LIMITS.pro.snapshotsPerArtifact}
                 ELSE ${PLAN_LIMITS.free.snapshotsPerArtifact}
               END AS retention
        FROM artifact_snapshots s
        JOIN users u ON u.id = s.user_id
      ),
      to_delete AS (
        SELECT id FROM ranked WHERE rn > retention
      )
      DELETE FROM artifact_snapshots
      WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    `);
    pruned = result.rows?.length ?? 0;
    // `scanned` is a placeholder (= pruned). A full COUNT(*) would need
    // a separate query; not worth the cost for this housekeeping job.
    scanned = pruned;
  } catch (err) {
    console.error("[cron] prune-snapshots error:", err);
    return Response.json(
      { error: "Prune failed", message: String(err) },
      { status: 500 }
    );
  }

  const durationMs = Date.now() - start;
  console.log(
    `[cron] prune-snapshots: pruned=${pruned} duration=${durationMs}ms`
  );

  return Response.json({ pruned, scanned, durationMs });
}

// Allow GET for manual testing in dev (still gated by Bearer token).
export const GET = POST;
