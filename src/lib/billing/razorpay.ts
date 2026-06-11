/**
 * Razorpay gateway implementation (subscriptions API, REST — no SDK dep).
 *
 * Activate by setting:
 *   PAYMENT_GATEWAY=razorpay
 *   RAZORPAY_KEY_ID=rzp_live_...
 *   RAZORPAY_KEY_SECRET=...
 *   RAZORPAY_PLAN_ID_PRO=plan_...        (created in the Razorpay dashboard)
 *   RAZORPAY_WEBHOOK_SECRET=...          (webhook secret from the dashboard)
 *
 * Webhook endpoint to register in the dashboard: POST /api/billing/webhook
 * with events: subscription.activated, subscription.charged,
 * subscription.cancelled.
 *
 * The userId travels in subscription `notes` so the webhook can map a
 * Razorpay subscription back to a Primy user without a customer table.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutOptions, Gateway, WebhookEvent } from "./gateway";

const API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay gateway selected but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set.");
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function rzpFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const desc = (body?.error as Record<string, unknown> | undefined)?.description;
    throw new Error(`Razorpay ${path} failed (${res.status}): ${desc || res.statusText}`);
  }
  return body;
}

export const razorpayGateway: Gateway = {
  name: "razorpay",

  async createCheckoutSession(opts: CheckoutOptions): Promise<{ url: string }> {
    const planId = process.env.RAZORPAY_PLAN_ID_PRO;
    if (!planId) throw new Error("RAZORPAY_PLAN_ID_PRO is not set.");
    // 120 monthly cycles = effectively "until cancelled" (Razorpay requires a
    // finite total_count). short_url is a Razorpay-hosted checkout page.
    const sub = await rzpFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 120,
        customer_notify: 1,
        notes: { userId: opts.userId, plan: opts.plan },
      }),
    });
    const url = sub.short_url;
    if (typeof url !== "string" || !url) {
      throw new Error("Razorpay subscription created but no checkout URL returned.");
    }
    return { url };
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await rzpFetch(`/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    });
  },

  async getCustomerPortalUrl(_customerId: string): Promise<string> {
    // Razorpay has no hosted customer portal — subscription management
    // happens in-app (cancel via cancelSubscription).
    return "/";
  },

  async parseWebhook(req: Request): Promise<WebhookEvent> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set.");

    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error("Razorpay webhook signature verification failed.");
    }

    const payload = JSON.parse(raw) as {
      event?: string;
      payload?: { subscription?: { entity?: { id?: string; notes?: Record<string, string>; current_end?: number } } };
    };
    const sub = payload.payload?.subscription?.entity;
    const subscriptionId = sub?.id;
    if (!payload.event || !subscriptionId) {
      throw new Error("Razorpay webhook missing event or subscription entity.");
    }
    const renewsAt = sub?.current_end ? new Date(sub.current_end * 1000) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    switch (payload.event) {
      case "subscription.activated": {
        const userId = sub?.notes?.userId;
        if (!userId) throw new Error("subscription.activated without notes.userId — cannot map to a user.");
        return { id: subscriptionId, type: "subscription.created", userId, subscriptionId, renewsAt };
      }
      case "subscription.charged":
        return { id: subscriptionId, type: "subscription.updated", subscriptionId, renewsAt };
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.halted":
        return { id: subscriptionId, type: "subscription.canceled", subscriptionId };
      default:
        throw new Error(`Unhandled Razorpay webhook event: ${payload.event}`);
    }
  },
};
