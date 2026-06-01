import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { eq, lt } from "drizzle-orm";

/**
 * Durable login throttle — brute-force / credential-stuffing protection that
 * survives serverless (unlike the in-memory rate limiter). Two independent
 * keys are checked per attempt: the email (stops guessing one account) and the
 * client IP (stops spraying many accounts from one host).
 *
 * IMPORTANT: every function FAILS OPEN — if the throttle store errors, we let
 * the login proceed rather than lock all users out. Availability over a perfect
 * lock; the bcrypt cost still bounds raw guess rate.
 */

const WINDOW_MS = 15 * 60 * 1000; // failures within 15 min count toward a lock
const EMAIL_THRESHOLD = 6; // lock an email after N fails in the window
const IP_THRESHOLD = 30; // lock an IP after N fails in the window
const BASE_LOCK_MS = 15 * 60 * 1000; // first lock = 15 min
const MAX_LOCK_MS = 6 * 60 * 60 * 1000; // capped at 6 h

export function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}
export function ipKey(ip: string): string {
  return `ip:${ip}`;
}

/** Seconds until a key unlocks, or 0 if not locked. Never throws. */
export async function lockedSeconds(key: string): Promise<number> {
  try {
    const [row] = await db
      .select({ lockedUntil: loginAttempts.lockedUntil })
      .from(loginAttempts)
      .where(eq(loginAttempts.key, key))
      .limit(1);
    if (!row?.lockedUntil) return 0;
    const ms = row.lockedUntil.getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  } catch {
    return 0; // fail open
  }
}

/** Record a failed attempt for a key, applying a lock once the threshold trips. */
export async function recordFailure(key: string, threshold: number): Promise<void> {
  try {
    const now = Date.now();
    const [row] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, key))
      .limit(1);

    // No row, or the window has elapsed → start a fresh count.
    if (!row || now - row.firstFailAt.getTime() > WINDOW_MS) {
      await db
        .insert(loginAttempts)
        .values({ key, fails: 1, firstFailAt: new Date(now), lockedUntil: null })
        .onConflictDoUpdate({
          target: loginAttempts.key,
          set: { fails: 1, firstFailAt: new Date(now), lockedUntil: null },
        });
      return;
    }

    const fails = row.fails + 1;
    let lockedUntil: Date | null = row.lockedUntil ?? null;
    if (fails >= threshold) {
      // Exponential backoff on repeated lockouts, capped.
      const over = fails - threshold;
      const lockMs = Math.min(BASE_LOCK_MS * 2 ** over, MAX_LOCK_MS);
      lockedUntil = new Date(now + lockMs);
    }
    await db
      .update(loginAttempts)
      .set({ fails, lockedUntil })
      .where(eq(loginAttempts.key, key));
  } catch {
    /* fail open */
  }
}

/** Clear a key after a successful login. Never throws. */
export async function clearAttempts(key: string): Promise<void> {
  try {
    await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
  } catch {
    /* fail open */
  }
}

export const THRESHOLDS = { EMAIL_THRESHOLD, IP_THRESHOLD };

/** Best-effort cleanup of stale rows (call opportunistically). */
export async function pruneStaleAttempts(): Promise<void> {
  try {
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.firstFailAt, new Date(Date.now() - 2 * WINDOW_MS)));
  } catch {
    /* ignore */
  }
}
