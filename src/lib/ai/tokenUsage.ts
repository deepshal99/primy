import { db } from "@/db";
import { tokenUsageLog } from "@/db/schema";
import { nanoid } from "nanoid";
import { getUserOrg } from "@/lib/org/orgAccess";

// ── AI cost telemetry ──
//
// One row per AI call, for /admin spend views + future usage-based billing.
// Token counts come from the provider's `totalUsage`. Prices below are
// APPROXIMATE (cents per 1M tokens, [input, output]) — confirm against the
// OpenAI dashboard and update here as prices change. The raw token columns are
// the source of truth; est_cost_cents is a denormalized convenience.
const PRICE_CENTS_PER_M: Record<string, [number, number]> = {
  "gpt-4.1-mini": [40, 160],
  "gpt-4.1": [200, 800],
  "gpt-5-mini": [25, 200],
  "gpt-5.5": [125, 1000],
};

/** Best-effort cost estimate in whole cents. Unknown models fall back to gpt-4.1. */
export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  // Longest matching key wins so "gpt-4.1-mini" doesn't match the "gpt-4.1" entry.
  const key =
    Object.keys(PRICE_CENTS_PER_M)
      .filter((k) => model.includes(k))
      .sort((a, b) => b.length - a.length)[0] ?? "gpt-4.1";
  const [inC, outC] = PRICE_CENTS_PER_M[key];
  return Math.round((inputTokens / 1_000_000) * inC + (outputTokens / 1_000_000) * outC);
}

/**
 * Record a single AI call's token usage. Fire-and-forget safe: any failure is
 * logged and swallowed so telemetry never breaks a chat response.
 */
export async function logTokenUsage(args: {
  userId: string;
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const org = await getUserOrg(args.userId);
    await db.insert(tokenUsageLog).values({
      id: nanoid(),
      userId: args.userId,
      orgId: org?.orgId ?? null,
      task: args.task,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      estCostCents: estimateCostCents(args.model, args.inputTokens, args.outputTokens),
    });
  } catch (e) {
    console.warn("[tokenUsage] log failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}
