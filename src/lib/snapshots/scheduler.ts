/**
 * Auto-snapshot scheduler — fire-and-forget, debounced per artifact.
 *
 * Called after AI operations finish applying. Posts a snapshot to
 * /api/snapshots/[type]/[id] without awaiting (never blocks the
 * user-facing flow). Failures are swallowed and logged — telemetry
 * only, never user-visible.
 *
 * Debounce: skip if the most recent snapshot for this artifact was
 * within DEBOUNCE_MS. Prevents 50 micro-edits → 50 snapshots, which
 * would make the cron prune work harder for no real version coverage.
 *
 * The cron at /api/cron/prune-snapshots handles plan retention as a
 * safety net; this debounce is just to avoid hot-loop noise.
 *
 * New-artifact race: a snapshot fired right after an AI op creates a
 * brand-new entity can 404, because the server only learns about the
 * entity via the debounced project save (~2s later). The POST checks
 * access by looking the artifact up in the DB, so until that save lands
 * the artifact "doesn't exist" and the first version is lost. We retry a
 * 404 a couple of times, spaced past the save debounce, to ride this out.
 */

const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes
const RETRY_DELAY_MS = 3000; // > the ~2s debounced project save in the store
const MAX_RETRIES = 2; // enough to outlast a slow save without retry storms

type ArtifactType = "ku" | "table" | "deck";

const lastFiredAt = new Map<string, number>();
function key(type: ArtifactType, id: string) {
  return `${type}:${id}`;
}

export interface ScheduleSnapshotOptions {
  type: ArtifactType;
  id: string;
  content: unknown;
  /** Optional human-readable label, e.g. "After AI edit". */
  label?: string;
}

export function scheduleSnapshot(opts: ScheduleSnapshotOptions): void {
  if (typeof window === "undefined") return; // server-side no-op
  if (!opts.id || !opts.content) return;

  const k = key(opts.type, opts.id);
  const now = Date.now();
  const last = lastFiredAt.get(k) ?? 0;
  if (now - last < DEBOUNCE_MS) return;

  // Mark optimistically — even if the request fails, we don't want
  // a retry storm against the same artifact.
  lastFiredAt.set(k, now);

  postSnapshot(opts, k, 0);
}

/**
 * Fire one POST; on a 404 (artifact not persisted server-side yet — the
 * new-artifact race described above) retry a bounded number of times,
 * spaced past the store's save debounce. Other failures are logged once.
 */
function postSnapshot(opts: ScheduleSnapshotOptions, k: string, attempt: number): void {
  fetch(`/api/snapshots/${opts.type}/${opts.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: opts.content, label: opts.label ?? null }),
  })
    .then((res) => {
      if (res.ok) return;
      if (res.status === 404 && attempt < MAX_RETRIES) {
        setTimeout(() => postSnapshot(opts, k, attempt + 1), RETRY_DELAY_MS);
        return;
      }
      console.warn(`[snapshots] POST failed (${res.status}) for ${k}`);
    })
    .catch((err) => {
      if (attempt < MAX_RETRIES) {
        setTimeout(() => postSnapshot(opts, k, attempt + 1), RETRY_DELAY_MS);
        return;
      }
      console.warn(`[snapshots] POST error for ${k}:`, err);
    });
}

/**
 * Test helper — clears the debounce map. Not used in production.
 */
export function _resetSnapshotScheduler(): void {
  lastFiredAt.clear();
}
