/**
 * Atomic usage counter helpers.
 *
 * The usage table is keyed (userId, month). Each month row stores three
 * counters: aiMessages, fileUploads, storageBytes. Increments use a
 * single round-trip INSERT ... ON CONFLICT DO UPDATE so concurrent
 * requests from the same user can never lose a count.
 *
 *     await incrementUsage(userId, 'aiMessages')
 *     // → atomic upsert; returns the post-increment value
 *
 * No "reset" job is needed — the month key advances naturally and
 * historical rows stay for analytics.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { MeteredResource } from "@/lib/plans";

/**
 * Returns the YYYY-MM key (UTC) used as the month partition. We use
 * UTC unconditionally so users in different timezones don't see a
 * "month boundary" jitter and so analytics align globally.
 */
export function currentMonthKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Counter columns we know how to increment. */
type CounterColumn = MeteredResource | "storageBytes";

const COLUMN_MAP: Record<CounterColumn, string> = {
  aiMessages: "ai_messages",
  fileUploads: "file_uploads",
  storageBytes: "storage_bytes",
};

/**
 * Atomically increment a counter and return the post-increment value.
 *
 * Implementation:
 *
 *     INSERT INTO usage (user_id, month, <col>)
 *     VALUES (?, ?, ?)
 *     ON CONFLICT (user_id, month)
 *     DO UPDATE SET <col> = usage.<col> + EXCLUDED.<col>,
 *                   updated_at = NOW()
 *     RETURNING <col>;
 *
 * Single round-trip, race-free. No read-modify-write window.
 *
 * @param userId    the user id
 * @param resource  which counter ('aiMessages' | 'fileUploads' | 'storageBytes')
 * @param amount    increment delta — defaults to 1; pass file size in
 *                  bytes when resource='storageBytes'
 */
export async function incrementUsage(
  userId: string,
  resource: CounterColumn,
  amount: number = 1
): Promise<number> {
  const month = currentMonthKey();
  const column = COLUMN_MAP[resource];
  if (!column) {
    throw new Error(`incrementUsage: unknown resource '${resource}'`);
  }
  if (!Number.isFinite(amount)) {
    throw new Error(`incrementUsage: amount must be finite (got ${amount})`);
  }

  // sql.identifier escapes the column name. Values are still parameterized.
  const col = sql.identifier(column);
  const result = await db.execute(sql`
    INSERT INTO usage (user_id, month, ${col})
    VALUES (${userId}, ${month}, ${amount})
    ON CONFLICT (user_id, month)
    DO UPDATE SET ${col} = usage.${col} + EXCLUDED.${col},
                  updated_at = NOW()
    RETURNING ${col} AS value
  `);

  // Drizzle's neon-http execute returns rows as either { rows: [...] }
  // or directly an array depending on driver shape. Handle both.
  const rows: any = (result as any).rows ?? result;
  const row = Array.isArray(rows) ? rows[0] : rows?.[0];
  const value = row?.value;
  if (typeof value !== "number") {
    // Some drivers return numeric/bigint as string. Coerce.
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`incrementUsage: unexpected return shape for ${resource}`);
    }
    return n;
  }
  return value;
}

/**
 * Read the current month's usage row. Returns zeros if no row exists
 * (does NOT create one — only increments do, to keep this read cheap).
 */
export async function getUsage(userId: string): Promise<{
  aiMessages: number;
  fileUploads: number;
  storageBytes: number;
}> {
  const month = currentMonthKey();
  const result = await db.execute(sql`
    SELECT ai_messages, file_uploads, storage_bytes
    FROM usage
    WHERE user_id = ${userId} AND month = ${month}
    LIMIT 1
  `);
  const rows: any = (result as any).rows ?? result;
  const row = Array.isArray(rows) ? rows[0] : rows?.[0];
  if (!row) {
    return { aiMessages: 0, fileUploads: 0, storageBytes: 0 };
  }
  return {
    aiMessages: Number(row.ai_messages ?? 0),
    fileUploads: Number(row.file_uploads ?? 0),
    storageBytes: Number(row.storage_bytes ?? 0),
  };
}

/**
 * Compute total non-deleted storage from the files table. The
 * usage.storageBytes counter is the hot path; this is the source of
 * truth used for reconciliation jobs and the share-quota check.
 */
export async function computeStorageFromFiles(userId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(bytes), 0) AS total
    FROM files
    WHERE user_id = ${userId} AND deleted_at IS NULL
  `);
  const rows: any = (result as any).rows ?? result;
  const row = Array.isArray(rows) ? rows[0] : rows?.[0];
  return Number(row?.total ?? 0);
}
