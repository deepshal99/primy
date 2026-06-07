// Task-aware phased loading for the chat "thinking" state.
//
// While the model streams, we show a short, plausible sequence of steps so the
// user sees *what* is happening and roughly *how far along* it is — instead of a
// generic "Thinking...". The honesty rules:
//   - The task is GUESSED from the user's message, then OVERRIDDEN the moment a
//     real operation block streams in (so a wrong guess self-corrects).
//   - The middle steps are simulated on a timer, but the FINAL "building" step
//     is gated on the real artifact actually streaming — we never claim we're
//     building something before we are, and never show "done" early.

export type StreamTask = "deck" | "doc" | "sheet" | "page" | "answer";

export interface StreamPhase {
  id: string;
  /** Default label; the "read" step may be enriched with real file names at render. */
  label: string;
}

/** Per-task phase scripts. The LAST phase is the real artifact-building step. */
export const PHASE_SCRIPTS: Record<StreamTask, StreamPhase[]> = {
  deck: [
    { id: "read", label: "Reading your context" },
    { id: "outline", label: "Outlining the deck" },
    { id: "design", label: "Designing the slides" },
    { id: "build", label: "Building the deck" },
  ],
  doc: [
    { id: "read", label: "Reading your context" },
    { id: "organize", label: "Organizing the ideas" },
    { id: "build", label: "Writing the document" },
  ],
  sheet: [
    { id: "read", label: "Reading your context" },
    { id: "plan", label: "Structuring the columns" },
    { id: "build", label: "Filling in the data" },
  ],
  page: [
    { id: "read", label: "Reading your context" },
    { id: "sketch", label: "Sketching the layout" },
    { id: "build", label: "Designing the page" },
  ],
  // A guessed-answer turn might still turn out to be an action (an op block
  // arrives and the loader re-keys to that artifact's script). Before any output
  // we don't yet know which, so the single label stays neutral and true for
  // both. Genuine prose answers render as live streaming text, not this loader.
  answer: [
    { id: "think", label: "Thinking it through" },
  ],
};

/** Guess the task from the user's prompt. Used only until a real op block arrives. */
export function inferStreamTask(userText: string): StreamTask {
  const t = (userText || "").toLowerCase();
  if (/\b(deck|presentation|slides?|pitch deck|slide deck)\b/.test(t)) return "deck";
  if (/\b(landing page|one[-\s]?pager|web ?page|html page|make (it|this) visual|visual page|microsite)\b/.test(t)) return "page";
  if (/\b(spreadsheet|sheet|table|tracker|budget|csv|rows?|columns?|pivot)\b/.test(t)) return "sheet";
  if (/\b(doc|document|write|essay|article|memo|brief|draft|report|blog post)\b/.test(t)) return "doc";
  return "answer";
}

/** Map a detected operation type to the task it implies (real signal, overrides the guess). */
export function taskFromOp(
  op: "sheet" | "doc" | "deck" | "outline" | "page" | null
): StreamTask | null {
  switch (op) {
    case "sheet": return "sheet";
    case "doc": return "doc";
    case "deck":
    case "outline": return "deck";
    case "page": return "page";
    default: return null;
  }
}

/** How long each *simulated* middle step lingers before advancing. */
export const PHASE_STEP_MS = 2400;

/**
 * Which phase is currently active.
 * - `outputStarted` true ⇒ jump to the final (real "building") step.
 * - otherwise advance on the timer, but HOLD at the second-to-last step so we
 *   never auto-claim the build before it's real. (`allowFinalBySim` lets the
 *   timer reach the last step; the UI keeps it off so the final step always
 *   waits for real output.)
 */
export function activePhaseIndex(opts: {
  phaseCount: number;
  elapsedMs: number;
  outputStarted: boolean;
  allowFinalBySim?: boolean;
  stepMs?: number;
}): number {
  const { phaseCount, elapsedMs, outputStarted, allowFinalBySim = false, stepMs = PHASE_STEP_MS } = opts;
  const lastIndex = Math.max(0, phaseCount - 1);
  if (outputStarted) return lastIndex;
  const simulated = Math.max(0, Math.floor(elapsedMs / stepMs));
  const cap = allowFinalBySim ? lastIndex : Math.max(0, lastIndex - 1);
  return Math.min(simulated, cap);
}
