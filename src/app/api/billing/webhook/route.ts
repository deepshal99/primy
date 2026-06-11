import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getGateway } from "@/lib/billing";
import { log } from "@/lib/log";

/**
 * POST /api/billing/webhook — gateway subscription events.
 *
 * Auth = the gateway's webhook signature (verified inside parseWebhook);
 * no session. With the noop gateway this endpoint rejects everything, so it
 * is safe to ship before a provider is wired.
 *
 *   subscription.created  → plan=pro + store subscription id + renewal date
 *   subscription.updated  → refresh renewal date
 *   subscription.canceled → plan=free (proUntil grace, if any, still applies
 *                           via effectivePlan)
 */
export async function POST(req: Request) {
  const gateway = getGateway();
  let event;
  try {
    event = await gateway.parseWebhook(req);
  } catch (err) {
    log.warn("billing.webhook", err, { gateway: gateway.name });
    return Response.json({ error: "Invalid webhook" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "subscription.created":
        await db
          .update(users)
          .set({
            plan: "pro",
            gatewaySubscriptionId: event.subscriptionId,
            planRenewsAt: event.renewsAt,
          })
          .where(eq(users.id, event.userId));
        break;
      case "subscription.updated":
        await db
          .update(users)
          .set({ planRenewsAt: event.renewsAt })
          .where(eq(users.gatewaySubscriptionId, event.subscriptionId));
        break;
      case "subscription.canceled":
        await db
          .update(users)
          .set({ plan: "free", planRenewsAt: null })
          .where(eq(users.gatewaySubscriptionId, event.subscriptionId));
        break;
    }
    log.info("billing.webhook", `applied ${event.type}`, { gateway: gateway.name, subscriptionId: event.subscriptionId });
    return Response.json({ received: true });
  } catch (err) {
    log.error("billing.webhook", err, { eventType: event.type });
    // 500 → gateway retries the delivery.
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
