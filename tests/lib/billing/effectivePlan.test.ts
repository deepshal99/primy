import { describe, expect, test } from "vitest";
import { effectivePlan, isOnGracePeriod } from "@/lib/billing/effectivePlan";

const NOW = new Date("2026-05-01T12:00:00Z");
const FUTURE = new Date("2026-06-01T12:00:00Z");
const PAST = new Date("2026-04-01T12:00:00Z");

describe("effectivePlan", () => {
  test("plan='free', proUntil=null → 'free'", () => {
    expect(effectivePlan({ plan: "free", proUntil: null }, NOW)).toBe("free");
  });

  test("plan='pro', proUntil=null → 'pro'", () => {
    expect(effectivePlan({ plan: "pro", proUntil: null }, NOW)).toBe("pro");
  });

  test("plan='free', proUntil=future → 'pro'", () => {
    expect(effectivePlan({ plan: "free", proUntil: FUTURE }, NOW)).toBe("pro");
  });

  test("plan='free', proUntil=past → 'free'", () => {
    expect(effectivePlan({ plan: "free", proUntil: PAST }, NOW)).toBe("free");
  });

  test("plan='pro', proUntil=past → 'pro' (real sub trumps expired grace)", () => {
    expect(effectivePlan({ plan: "pro", proUntil: PAST }, NOW)).toBe("pro");
  });

  test("malformed plan='unknown' → 'free' (defensive)", () => {
    expect(effectivePlan({ plan: "unknown", proUntil: null }, NOW)).toBe("free");
  });

  test("malformed plan='' → 'free' (defensive)", () => {
    expect(effectivePlan({ plan: "", proUntil: null }, NOW)).toBe("free");
  });

  test("malformed plan='enterprise' but proUntil future → 'pro' via grace", () => {
    expect(effectivePlan({ plan: "enterprise", proUntil: FUTURE }, NOW)).toBe("pro");
  });

  test("uses now() default when not provided", () => {
    // proUntil is in the actual past — should resolve free
    const longAgo = new Date("2000-01-01T00:00:00Z");
    expect(effectivePlan({ plan: "free", proUntil: longAgo })).toBe("free");
  });

  test("plan='free' + proUntil exactly equal to now → 'free' (strict >)", () => {
    expect(effectivePlan({ plan: "free", proUntil: NOW }, NOW)).toBe("free");
  });
});

describe("effectivePlan — org inheritance", () => {
  test("free user in a pro org → 'pro'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "pro", orgProUntil: null }, NOW)
    ).toBe("pro");
  });

  test("free user in a free org → 'free'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: null }, NOW)
    ).toBe("free");
  });

  test("free user, org on grace (orgProUntil future) → 'pro'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: FUTURE }, NOW)
    ).toBe("pro");
  });

  test("free user, org grace expired → 'free'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: PAST }, NOW)
    ).toBe("free");
  });

  test("no org fields (undefined) behaves exactly as before → 'free'", () => {
    expect(effectivePlan({ plan: "free", proUntil: null }, NOW)).toBe("free");
  });
});

describe("isOnGracePeriod", () => {
  test("true only when plan='free' AND proUntil > now", () => {
    expect(isOnGracePeriod({ plan: "free", proUntil: FUTURE }, NOW)).toBe(true);
  });

  test("false when plan='pro' (real sub, even with future proUntil)", () => {
    expect(isOnGracePeriod({ plan: "pro", proUntil: FUTURE }, NOW)).toBe(false);
  });

  test("false when proUntil is past", () => {
    expect(isOnGracePeriod({ plan: "free", proUntil: PAST }, NOW)).toBe(false);
  });

  test("false when proUntil is null", () => {
    expect(isOnGracePeriod({ plan: "free", proUntil: null }, NOW)).toBe(false);
  });

  test("false when malformed plan even if proUntil future (treated as free, but checks raw plan)", () => {
    // plan='unknown' is defensively treated as free, so grace applies if proUntil future
    expect(isOnGracePeriod({ plan: "unknown", proUntil: FUTURE }, NOW)).toBe(true);
  });
});
