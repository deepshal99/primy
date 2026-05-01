/**
 * Pure plan resolution — no DB access.
 *
 * The "effective plan" combines two sources:
 *   1. The stored plan column ('free' | 'pro') — set after a real
 *      subscription event from the payment gateway.
 *   2. The proUntil timestamp — a grace-period override used for
 *      founding-member promos and beta access.
 *
 * Real subscription always wins. Malformed plan values are treated as
 * "free" defensively so a corrupted column never grants paid features.
 */

import type { Plan } from "@/lib/plans";

export interface PlanResolutionInput {
  /** Raw stored value: "free" | "pro" — anything else is treated as free. */
  plan: string;
  /** Grace-period override; "pro" while proUntil > now(). */
  proUntil: Date | null;
}

/**
 * Resolves the effective plan for a user.
 *
 *   - "pro" if plan === "pro"                                   (real sub)
 *   - "pro" if proUntil > now()                                 (grace)
 *   - "free" otherwise (including malformed plan values)
 */
export function effectivePlan(input: PlanResolutionInput, now: Date = new Date()): Plan {
  if (input.plan === "pro") return "pro";
  if (input.proUntil instanceof Date && input.proUntil.getTime() > now.getTime()) {
    return "pro";
  }
  return "free";
}

/**
 * True iff the user's "pro" status is from a temporary grace period
 * (not a real paid subscription). Useful for surfacing CTAs that
 * encourage upgrade before grace expires.
 */
export function isOnGracePeriod(input: PlanResolutionInput, now: Date = new Date()): boolean {
  if (input.plan === "pro") return false;
  if (!(input.proUntil instanceof Date)) return false;
  return input.proUntil.getTime() > now.getTime();
}
