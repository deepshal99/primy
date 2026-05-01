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
 */

const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes

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

  fetch(`/api/snapshots/${opts.type}/${opts.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: opts.content, label: opts.label ?? null }),
  })
    .then(async (res) => {
      if (!res.ok) {
        console.warn(`[snapshots] POST failed (${res.status}) for ${k}`);
      }
    })
    .catch((err) => {
      console.warn(`[snapshots] POST error for ${k}:`, err);
    });
}

/**
 * Test helper — clears the debounce map. Not used in production.
 */
export function _resetSnapshotScheduler(): void {
  lastFiredAt.clear();
}
