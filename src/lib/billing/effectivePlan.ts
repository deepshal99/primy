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
  /** The user's org plan, if they belong to one. "pro" grants pro to all members. */
  orgPlan?: string | null;
  /** Org grace-period override; "pro" while orgProUntil > now(). */
  orgProUntil?: Date | null;
}

/**
 * Resolves the effective plan for a user.
 *
 *   - "pro" if the user's own plan === "pro"      (personal real sub)
 *   - "pro" if the user's proUntil > now()        (personal grace)
 *   - "pro" if the user's org plan === "pro"      (company paid)
 *   - "pro" if the user's orgProUntil > now()     (org grace)
 *   - "free" otherwise (including malformed values)
 */
export function effectivePlan(input: PlanResolutionInput, now: Date = new Date()): Plan {
  if (input.plan === "pro") return "pro";
  if (input.proUntil instanceof Date && input.proUntil.getTime() > now.getTime()) {
    return "pro";
  }
  if (input.orgPlan === "pro") return "pro";
  if (input.orgProUntil instanceof Date && input.orgProUntil.getTime() > now.getTime()) {
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
