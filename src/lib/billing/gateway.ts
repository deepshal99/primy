/**
 * Payment gateway abstraction.
 *
 * The interface is stable from day one so the rest of the app can talk
 * to "the gateway" without knowing which provider it is. Concrete
 * implementations (Paddle / Lemon Squeezy / Razorpay) land post-launch.
 *
 * Until then, getGateway() returns NoopGateway — checkout and webhook
 * calls throw with a clear "not configured" error, while idempotent
 * no-op operations (cancel, portal) silently succeed so beta flows
 * don't break.
 */

import { razorpayGateway } from "./razorpay";

export type WebhookEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled";

export type WebhookEvent =
  | {
      id: string;
      type: "subscription.created";
      userId: string;
      subscriptionId: string;
      renewsAt: Date;
    }
  | {
      id: string;
      type: "subscription.updated";
      subscriptionId: string;
      renewsAt: Date;
    }
  | {
      id: string;
      type: "subscription.canceled";
      subscriptionId: string;
    };

export interface CheckoutOptions {
  userId: string;
  plan: "pro";
  successUrl: string;
  cancelUrl: string;
}

export interface Gateway {
  /** Stable identifier — useful for logs and feature flags. */
  readonly name: string;
  createCheckoutSession(opts: CheckoutOptions): Promise<{ url: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getCustomerPortalUrl(customerId: string): Promise<string>;
  parseWebhook(req: Request): Promise<WebhookEvent>;
}

/**
 * No-op gateway — used in dev/beta until a real provider is wired.
 *
 * Throws on operations that require a real backend (checkout, webhook
 * parsing). Resolves silently for idempotent admin operations
 * (cancel, portal redirect) so beta UIs that link to "manage
 * subscription" don't crash.
 */
export const noopGateway: Gateway = {
  name: "noop",

  async createCheckoutSession(_opts: CheckoutOptions): Promise<{ url: string }> {
    throw new Error(
      "Payment gateway not configured. Set PAYMENT_GATEWAY env and wire a concrete implementation."
    );
  },

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    // No-op: nothing to cancel without a real gateway.
  },

  async getCustomerPortalUrl(_customerId: string): Promise<string> {
    // No portal yet — send the user back home.
    return "/";
  },

  async parseWebhook(_req: Request): Promise<WebhookEvent> {
    throw new Error(
      "Payment gateway not configured. Webhook parsing is unavailable until a provider is wired."
    );
  },
};

/**
 * Returns the active gateway, selected by PAYMENT_GATEWAY env.
 * Unset/unknown → noopGateway (checkout/webhook throw with a clear error).
 * `razorpay` → src/lib/billing/razorpay.ts (needs RAZORPAY_* env, see file).
 */
export function getGateway(): Gateway {
  switch (process.env.PAYMENT_GATEWAY) {
    case "razorpay":
      return razorpayGateway;
    default:
      return noopGateway;
  }
}
