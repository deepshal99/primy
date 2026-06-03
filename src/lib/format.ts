/**
 * Small shared formatting helpers — previously copy-pasted (and quietly
 * diverging) across LibraryView, AppShellV2, and ProjectHome.
 */

/**
 * Stable, non-cryptographic hash of a string id. Used to deterministically pick
 * a per-workspace accent colour / icon so the same workspace always looks the
 * same.
 */
export function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Compact relative time for dense surfaces (sidebar, library cards):
 * "just now", "5m ago", "3h ago", "2d ago", "4w ago".
 */
export function relTime(ts: number, now: number = Date.now()): string {
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/**
 * Verbose relative time for roomier surfaces (project home):
 * "5 minutes ago", "2 hours ago", "3 days ago".
 */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
}
