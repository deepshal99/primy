import { describe, expect, test } from "vitest";
import { getGateway, noopGateway } from "@/lib/billing/gateway";

describe("noopGateway", () => {
  test("name is 'noop'", () => {
    expect(noopGateway.name).toBe("noop");
  });

  test("createCheckoutSession throws with descriptive error", async () => {
    await expect(
      noopGateway.createCheckoutSession({
        userId: "u1",
        plan: "pro",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
      })
    ).rejects.toThrow(/gateway/i);
  });

  test("cancelSubscription resolves silently (no-op)", async () => {
    await expect(noopGateway.cancelSubscription("sub_123")).resolves.toBeUndefined();
  });

  test("getCustomerPortalUrl resolves to '/'", async () => {
    await expect(noopGateway.getCustomerPortalUrl("cus_1")).resolves.toBe("/");
  });

  test("parseWebhook throws", async () => {
    const req = new Request("https://x/webhook", { method: "POST" });
    await expect(noopGateway.parseWebhook(req)).rejects.toThrow(/gateway/i);
  });
});

describe("getGateway", () => {
  test("returns noopGateway by default", () => {
    expect(getGateway()).toBe(noopGateway);
  });

  test("returns noopGateway when PAYMENT_GATEWAY env unset", () => {
    const orig = process.env.PAYMENT_GATEWAY;
    delete process.env.PAYMENT_GATEWAY;
    expect(getGateway().name).toBe("noop");
    if (orig !== undefined) process.env.PAYMENT_GATEWAY = orig;
  });

  test("returns noopGateway when PAYMENT_GATEWAY is unrecognized", () => {
    const orig = process.env.PAYMENT_GATEWAY;
    process.env.PAYMENT_GATEWAY = "stripe-but-not-wired-yet";
    expect(getGateway().name).toBe("noop");
    if (orig === undefined) delete process.env.PAYMENT_GATEWAY;
    else process.env.PAYMENT_GATEWAY = orig;
  });
});
