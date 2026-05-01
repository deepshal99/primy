"use client";

/**
 * usePlanInfo — display-friendly billing state for the client UI.
 *
 * Combines /api/user (effective plan + grace period) with /api/usage
 * (current month counters) and derives percent-used and days-remaining
 * for the Settings → Billing tab.
 *
 * The hook only READS state. Limit enforcement is the API's job; the
 * UI only displays what the server reports.
 */

import { useQuery } from "@tanstack/react-query";
import { PLAN_LIMITS, type Plan, type PlanLimits } from "@/lib/plans";

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  hasOnboarded: boolean;
  plan: string;
  proUntil: string | null;
  effectivePlan: Plan;
  isOnGracePeriod: boolean;
}

interface UsageResponse {
  month: string;
  aiMessages: number;
  fileUploads: number;
  storageBytes: number;
}

export interface PlanInfo {
  loading: boolean;
  error: Error | null;
  plan: Plan;
  isOnGracePeriod: boolean;
  proUntil: Date | null;
  limits: PlanLimits;
  usage: { aiMessages: number; fileUploads: number; storageBytes: number };
  percentUsed: { aiMessages: number; fileUploads: number; storageBytes: number };
  daysRemainingInGrace: number | null;
}

/** UTC YYYY-MM key — must match server-side currentMonthKey(). */
function currentMonthKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function fetchUser(): Promise<UserResponse> {
  const res = await fetch("/api/user");
  if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
  return res.json();
}

async function fetchUsage(): Promise<UsageResponse> {
  const res = await fetch("/api/usage");
  if (!res.ok) throw new Error(`Failed to load usage (${res.status})`);
  return res.json();
}

/** Computes percent (0-100). Infinite limits return 0 (rendered as "Unlimited"). */
function computePercent(used: number, limit: number): number {
  if (!Number.isFinite(limit)) return 0;
  if (limit <= 0) return 0;
  const pct = (used / limit) * 100;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(100, pct);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function usePlanInfo(): PlanInfo {
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 5 * 60 * 1000,
  });

  const usageQuery = useQuery({
    queryKey: ["usage", currentMonthKey()],
    queryFn: fetchUsage,
    staleTime: 60 * 1000,
  });

  const user = userQuery.data;
  const usageData = usageQuery.data;

  // Default to free plan if user data is missing — never crash the UI.
  const plan: Plan = user?.effectivePlan === "pro" ? "pro" : "free";
  const limits = PLAN_LIMITS[plan];

  const usage = {
    aiMessages: usageData?.aiMessages ?? 0,
    fileUploads: usageData?.fileUploads ?? 0,
    storageBytes: usageData?.storageBytes ?? 0,
  };

  const percentUsed = {
    aiMessages: computePercent(usage.aiMessages, limits.aiMessagesPerMonth),
    fileUploads: computePercent(usage.fileUploads, limits.fileUploadsPerMonth),
    storageBytes: computePercent(usage.storageBytes, limits.storageBytes),
  };

  const proUntil =
    user?.proUntil && typeof user.proUntil === "string"
      ? new Date(user.proUntil)
      : null;

  let daysRemainingInGrace: number | null = null;
  if (user?.isOnGracePeriod && proUntil instanceof Date && !Number.isNaN(proUntil.getTime())) {
    const diffMs = proUntil.getTime() - Date.now();
    daysRemainingInGrace = Math.max(0, Math.ceil(diffMs / DAY_MS));
  }

  const loading = userQuery.isLoading || usageQuery.isLoading;
  const error = (userQuery.error as Error | null) ?? (usageQuery.error as Error | null) ?? null;

  return {
    loading,
    error,
    plan,
    isOnGracePeriod: !!user?.isOnGracePeriod,
    proUntil,
    limits,
    usage,
    percentUsed,
    daysRemainingInGrace,
  };
}
