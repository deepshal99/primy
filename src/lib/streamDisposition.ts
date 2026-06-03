// Routing logic for where an AI stream's results land when it finishes.
//
// A chat stream belongs to the project it STARTED in. By the time it finishes
// the user may have navigated to a different project (or started editing
// something else in the same project). This pure module decides the three
// possible dispositions so the store stays free of branching cruft and the
// behavior is unit-testable.

export type StreamDisposition =
  | { mode: "foreground-open" }   // active project + user idle → auto-open the result
  | { mode: "foreground-quiet" }  // active project + user editing another entity → apply, no focus steal
  | { mode: "background" };       // different project → apply silently, mark unread

/** Window after the last keystroke during which we treat the user as "actively editing". */
export const ACTIVE_EDIT_WINDOW_MS = 8000;

export function isActivelyEditing(opts: {
  currentEntityId: string | null;
  lastInteractionAt: number;
  now: number;
  thresholdMs?: number;
}): boolean {
  const { currentEntityId, lastInteractionAt, now, thresholdMs = ACTIVE_EDIT_WINDOW_MS } = opts;
  if (!currentEntityId) return false;
  if (!lastInteractionAt) return false;
  return now - lastInteractionAt <= thresholdMs;
}

export function resolveStreamDisposition(opts: {
  streamProjectId: string | null;
  currentProjectId: string | null;
  /** True when the user is actively editing an entity (and would be interrupted by an auto-open). */
  editingDifferentEntity: boolean;
}): StreamDisposition {
  const { streamProjectId, currentProjectId, editingDifferentEntity } = opts;
  // A null streamProjectId means the send had no project scope captured (legacy
  // path / brand-new auto-created project) — treat as foreground.
  const targetIsActive = streamProjectId == null || streamProjectId === currentProjectId;
  if (!targetIsActive) return { mode: "background" };
  if (editingDifferentEntity) return { mode: "foreground-quiet" };
  return { mode: "foreground-open" };
}
