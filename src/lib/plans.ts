/**
 * Plan limits — single source of truth.
 *
 * Imported by both server (enforcement in withPlanLimit) and client
 * (display via usePlanInfo). Constants only — no env branching.
 *
 * Effective plan resolution lives in src/lib/billing/effectivePlan.ts:
 *   effectivePlan(user) = (plan === 'pro' OR proUntil > now()) ? 'pro' : 'free'
 *
 * Limits are enforced only when ENFORCE_PLAN_LIMITS=true in env.
 * Until a payment gateway is wired, the flag is OFF — every user
 * effectively gets Pro behavior so beta runs unblocked.
 */

export type Plan = "free" | "pro";

export interface PlanLimits {
  /** Max distinct projects/workspaces a user can own. */
  workspaces: number;
  /** Max AI chat messages per calendar month. */
  aiMessagesPerMonth: number;
  /** Max file uploads per calendar month. */
  fileUploadsPerMonth: number;
  /** Max total storage across all files (after soft delete). */
  storageBytes: number;
  /** Whether share viewers display the "Built with Primy" watermark. */
  watermarkOnShares: boolean;
  /** Whether brand voice + visual profiles are enabled. */
  brandProfiles: boolean;
  /** Whether the full slash-command set is available (vs. starter set). */
  fullSlashCommands: boolean;
  /** Number of artifact snapshots retained per artifact. */
  snapshotsPerArtifact: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    workspaces: 1,
    aiMessagesPerMonth: 50,
    fileUploadsPerMonth: 5,
    storageBytes: 500 * 1024 * 1024, // 500 MB
    watermarkOnShares: true,
    brandProfiles: false,
    fullSlashCommands: false,
    snapshotsPerArtifact: 5,
  },
  pro: {
    workspaces: Number.POSITIVE_INFINITY,
    aiMessagesPerMonth: 1500,
    fileUploadsPerMonth: Number.POSITIVE_INFINITY,
    storageBytes: 20 * 1024 * 1024 * 1024, // 20 GB
    watermarkOnShares: false,
    brandProfiles: true,
    fullSlashCommands: true,
    snapshotsPerArtifact: 20,
  },
};

/** Pro tier price in USD/month. Single tier for v1.0. */
export const PRO_PRICE_USD = 24;

/** Founding-member grace period (days) granted to all pre-launch users. */
export const FOUNDING_MEMBER_GRACE_DAYS = 60;

/** Resources that withPlanLimit can gate. */
export type MeteredResource = "aiMessages" | "fileUploads";

/**
 * Plan-limits enforcement. ON by default (launch decision 2026-06-10): a
 * misconfigured env must fail CLOSED on AI spend, not hand out unlimited
 * Pro. Set ENFORCE_PLAN_LIMITS=false explicitly to disable (local dev,
 * load tests).
 */
export function planLimitsEnforced(): boolean {
  return process.env.ENFORCE_PLAN_LIMITS !== "false";
}
