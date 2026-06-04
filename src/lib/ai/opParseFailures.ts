/**
 * opParseFailures — the single, prod-safe sink for AI-operation parse failures.
 *
 * WHY THIS EXISTS
 * The AI op pipeline (`parseAIResponse.ts`) recovers aggressively from malformed
 * model output, but its terminal "give up" paths used to drop an operation with
 * at most a `console.warn` — and many of those warns were gated
 * `if (NODE_ENV !== "production")`. So in PRODUCTION a malformed op vanished with
 * zero signal: no log, no metric, no user message. The user just saw
 * "I don't see the page/sheet". This module makes every such drop:
 *   1. ALWAYS logged (prod included) under one greppable prefix, and
 *   2. counted in-memory so tests + telemetry can observe the rate.
 *
 * It also provides `detectDroppedOpFamilies`, which closes the OTHER half of the
 * gap: the chat UI only warned when EVERY op family failed. If a deck block
 * failed while a sheet block succeeded, the deck dropped silently. Per-family
 * detection surfaces each dropped deliverable independently.
 *
 *   ┌─ parse recovers ──▶ ops returned (no failure)
 *   │
 *   └─ parse gives up ──▶ reportOpParseFailure() ──▶ [primy.op_parse_failure] log + counter
 *                                                └──▶ (family count stays 0)
 *                                                       │
 *   chat turn ends ──▶ detectDroppedOpFamilies(text, counts) ──▶ user-visible toast
 */

export type OpFamily =
  | "sheetops"
  | "docops"
  | "kuops"
  | "tableops"
  | "deckops"
  | "pageops";

/** Reason codes for a drop — machine-friendly, kept stable for log queries. */
export type OpParseFailureReason =
  | "json-parse-failed" // robustJsonParse returned null
  | "no-typed-ops" // parsed JSON but nothing had a `type` field
  | "schema-invalid" // structurally parsed but failed its zod schema
  | "missing-required-field"; // a required field (html, id, …) was absent

export interface OpParseFailure {
  family: OpFamily;
  reason: OpParseFailureReason;
  /** A short raw sample for debugging — truncated by the sink, never PII-scrubbed. */
  sample: string;
}

const counts: Record<OpFamily, number> = {
  sheetops: 0,
  docops: 0,
  kuops: 0,
  tableops: 0,
  deckops: 0,
  pageops: 0,
};

/**
 * Record a terminal op-parse failure. ALWAYS logs (production included) under a
 * stable, greppable prefix so a log drain / alert can key on it. Increments an
 * in-memory counter for telemetry and tests. Never throws — a logging failure
 * must never break the chat turn that triggered it.
 */
export function reportOpParseFailure(failure: OpParseFailure): void {
  try {
    counts[failure.family] += 1;
    // console.error (not warn) so it survives prod log-level filters; the prefix
    // is the query key, the JSON payload is the structured detail.
    console.error(
      "[primy.op_parse_failure]",
      JSON.stringify({
        family: failure.family,
        reason: failure.reason,
        sample: failure.sample.slice(0, 300),
      }),
    );
  } catch {
    /* logging must never throw into the parse path */
  }
}

/** Snapshot of failure counts since the last reset. For telemetry + tests. */
export function getOpParseFailureCounts(): Record<OpFamily, number> {
  return { ...counts };
}

/** Reset counters (tests; or a telemetry flush boundary). */
export function resetOpParseFailureCounts(): void {
  (Object.keys(counts) as OpFamily[]).forEach((k) => {
    counts[k] = 0;
  });
}

const FENCE_BY_FAMILY: Record<OpFamily, string> = {
  sheetops: "```sheetops",
  docops: "```docops",
  kuops: "```kuops",
  tableops: "```tableops",
  deckops: "```deckops",
  pageops: "```pageops",
};

/** How many ops each family yielded for one chat turn. */
export type OpFamilyCounts = Record<OpFamily, number>;

/**
 * Families whose fence is present in the reply but which yielded ZERO ops — i.e.
 * the model tried to emit that deliverable and it was silently dropped. This is
 * independent per family, so a dropped deck is surfaced even when a sheet in the
 * same reply applied fine.
 */
export function detectDroppedOpFamilies(
  fullText: string,
  counts: OpFamilyCounts,
): OpFamily[] {
  const dropped: OpFamily[] = [];
  for (const family of Object.keys(FENCE_BY_FAMILY) as OpFamily[]) {
    if (fullText.includes(FENCE_BY_FAMILY[family]) && counts[family] === 0) {
      dropped.push(family);
    }
  }
  return dropped;
}

/** User-facing noun for each family, for toast copy. */
export const OP_FAMILY_LABEL: Record<OpFamily, string> = {
  sheetops: "spreadsheet",
  docops: "document",
  kuops: "document",
  tableops: "spreadsheet",
  deckops: "deck",
  pageops: "page",
};

/** Dedup-friendly human label list for a set of dropped families (for a toast). */
export function droppedFamiliesLabel(families: OpFamily[]): string {
  const labels = [...new Set(families.map((f) => OP_FAMILY_LABEL[f]))];
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
