/**
 * In-memory sliding-window rate limiter.
 *
 * Each key (e.g. "userId:chat") maintains a list of request timestamps.
 * On each check, expired timestamps are pruned and the request is allowed
 * only if the count within the window is below the limit.
 *
 * A background interval purges fully-expired entries every 60 seconds
 * to prevent unbounded memory growth.
 *
 * ⚠️ SCOPE: this store is PER SERVERLESS INSTANCE. Limits are therefore
 * best-effort, not global — a caller spread across N warm instances effectively
 * gets up to N× the limit. This is acceptable as a secondary guard:
 *   - chat is also bounded GLOBALLY by the DB usage meter (withPlanLimit), so
 *     its real cap doesn't depend on this limiter;
 *   - the security-relevant ones (share-token enumeration, extract, deck-refine)
 *     rely on it for friction, not a hard ceiling.
 * For a hard global ceiling, back this with a shared store (Upstash/KV) and make
 * the check async. Deferred until that store is provisioned — wiring it now would
 * be inert (falls back to this map) until the env is set.
 */

interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** How many requests remain in the current window. */
  remaining: number;
  /** Epoch ms when the oldest tracked request expires (i.e. when capacity frees up). */
  resetAt: number;
}

/** Stores request timestamps per key. */
const store = new Map<string, number[]>();

/**
 * Check (and record) a rate-limited request.
 *
 * @param key      Unique identifier, e.g. `${userId}:chat`
 * @param limit    Maximum requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get existing timestamps and prune expired ones
  let timestamps = store.get(key);
  if (timestamps) {
    timestamps = timestamps.filter((t) => t > windowStart);
  } else {
    timestamps = [];
  }

  if (timestamps.length >= limit) {
    // Denied — compute when the earliest request in the window expires
    const resetAt = timestamps[0] + windowMs;
    store.set(key, timestamps);
    return { allowed: false, remaining: 0, resetAt };
  }

  // Allowed — record this request
  timestamps.push(now);
  store.set(key, timestamps);

  const remaining = limit - timestamps.length;
  const resetAt = timestamps[0] + windowMs;
  return { allowed: true, remaining, resetAt };
}

// ---------------------------------------------------------------------------
// Background cleanup: every 60s, drop keys whose newest timestamp is expired.
// Uses unref() so the timer doesn't prevent Node.js from exiting.
// ---------------------------------------------------------------------------
const CLEANUP_INTERVAL_MS = 60_000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store) {
    // If the most recent timestamp is older than any reasonable window
    // (we use 5 minutes as an upper bound), the key is stale.
    const newest = timestamps[timestamps.length - 1];
    if (now - newest > 5 * 60_000) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Allow the Node.js process to exit even if the timer is active
if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
  cleanupTimer.unref();
}
