import { describe, expect, test } from "vitest";
import { PLAN_LIMITS, PRO_PRICE_USD, planLimitsEnforced } from "@/lib/plans";

describe("PLAN_LIMITS", () => {
  test("free tier has lower caps than pro tier", () => {
    expect(PLAN_LIMITS.free.aiMessagesPerMonth).toBeLessThan(
      PLAN_LIMITS.pro.aiMessagesPerMonth
    );
    expect(PLAN_LIMITS.free.fileUploadsPerMonth).toBeLessThan(
      PLAN_LIMITS.pro.fileUploadsPerMonth
    );
    expect(PLAN_LIMITS.free.storageBytes).toBeLessThan(PLAN_LIMITS.pro.storageBytes);
    expect(PLAN_LIMITS.free.snapshotsPerArtifact).toBeLessThan(
      PLAN_LIMITS.pro.snapshotsPerArtifact
    );
  });

  test("free tier shows watermark, pro hides it", () => {
    expect(PLAN_LIMITS.free.watermarkOnShares).toBe(true);
    expect(PLAN_LIMITS.pro.watermarkOnShares).toBe(false);
  });

  test("pro unlocks brand profiles + full slash commands", () => {
    expect(PLAN_LIMITS.free.brandProfiles).toBe(false);
    expect(PLAN_LIMITS.pro.brandProfiles).toBe(true);
    expect(PLAN_LIMITS.free.fullSlashCommands).toBe(false);
    expect(PLAN_LIMITS.pro.fullSlashCommands).toBe(true);
  });

  test("pro is effectively unlimited on uploads + workspaces", () => {
    expect(PLAN_LIMITS.pro.workspaces).toBe(Number.POSITIVE_INFINITY);
    expect(PLAN_LIMITS.pro.fileUploadsPerMonth).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("PRO_PRICE_USD", () => {
  test("locked at $24/mo per spec", () => {
    expect(PRO_PRICE_USD).toBe(24);
  });
});

describe("planLimitsEnforced", () => {
  test("enforced by default; only ENFORCE_PLAN_LIMITS=false disables", () => {
    const original = process.env.ENFORCE_PLAN_LIMITS;
    // Fail-closed launch default: unset means ENFORCED.
    delete process.env.ENFORCE_PLAN_LIMITS;
    expect(planLimitsEnforced()).toBe(true);

    process.env.ENFORCE_PLAN_LIMITS = "false";
    expect(planLimitsEnforced()).toBe(false);

    process.env.ENFORCE_PLAN_LIMITS = "true";
    expect(planLimitsEnforced()).toBe(true);

    process.env.ENFORCE_PLAN_LIMITS = original;
  });
});
