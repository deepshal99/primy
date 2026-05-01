# Payment Gateway Integration Plan

Plan for picking + wiring the payment gateway when ready to flip `ENFORCE_PLAN_LIMITS=true`.

The billing system is gateway-agnostic by design. The `Gateway` interface in `src/lib/billing/gateway.ts` is the only contract you fulfill; everything else (usage metering, plan resolution, withPlanLimit, JWT caching) is already done.

---

## Comparison table

| Capability | Paddle | Lemon Squeezy | Razorpay | DodoPayments | Stripe |
|---|---|---|---|---|---|
| Available for India-based founder | ✅ | ✅ | ✅ (native) | ✅ | ❌ |
| Merchant of record | ✅ | ✅ | ❌ | ✅ | ❌ |
| Handles VAT/GST/sales-tax globally | ✅ | ✅ | India only | ✅ | ❌ |
| Currencies (USD pricing for global SaaS) | ~30 | ~135 | INR strong | ~25 | ~135 |
| Subscription support | Excellent | Excellent | Good | Good | Excellent |
| Webhook reliability | Excellent | Excellent | Good | Improving | Excellent |
| Customer portal (self-serve cancel/upgrade) | ✅ Hosted | ✅ Hosted | ✅ Hosted | ✅ Hosted | ✅ Hosted |
| Transaction fees | 5% + $0.50 | 5% + $0.50 | 2-3% INR / 4.5% intl | 4-5% | 2.9% + $0.30 |
| Monthly fee | $0 | $0 | $0 | $0 | $0 |
| Time to first transaction | 1-3 days (KYC) | Hours-1 day | 2-7 days (KYC India) | 1-3 days | N/A India |
| Indian KYC & PAN required | Yes (light) | Yes (light) | Yes (heavy, GST) | Yes (light) | N/A |
| Best for | Global B2B SaaS | Indie SaaS, fast launch | India-first SaaS | Newer entrant | Not viable for IN |

---

## Recommendation: Lemon Squeezy

**Pick Lemon Squeezy for v1.0 launch.**

Reasoning, mapped to Drafta's situation:

1. **Merchant of record** = they handle all global tax compliance. Solo founder, India-based, global audience — you do not have time to file VAT/GST/sales-tax in 30 jurisdictions. Hard requirement.
2. **Fastest time to first transaction.** You can be live in hours, not days. Paddle's KYC is similarly light but Lemon Squeezy's onboarding flow is famously fast.
3. **Indie-friendly DX.** Their docs target small founders. Webhook signing is straightforward. Test mode is generous.
4. **Same merchant-of-record model as Paddle**, similar fees. So if Lemon Squeezy doesn't work out, switch is one file.
5. **Acquired by Stripe (2024) but still operates independently.** You get the upside of Stripe's platform stability without Stripe's "available in" restrictions on Indian merchants.

**Fallback chain (if Lemon Squeezy KYC fails or rejects):**
1. Paddle (same model, similar fees)
2. DodoPayments (newer, India-friendly)
3. Razorpay (Indian customers only — not ideal for USD-priced global SaaS but workable)

You'll never need Stripe given your situation.

---

## Concrete integration steps

The billing core is already done. You're filling out one file: `src/lib/billing/gateways/lemonsqueezy.ts`. Plus a few wiring tasks.

### Day 1 — Account setup + product creation

1. Sign up at `lemonsqueezy.com`. Use your business email.
2. Complete KYC: PAN, business name, address, bank details for payouts. Allow 24h for verification.
3. Create one product: "Drafta Pro"
   - Variant: Monthly subscription, $24 USD
   - (Optional) Variant: Annual subscription, $240 USD (16% discount)
4. Note your Store ID and Product ID — you'll need them in env vars.
5. Generate an API key (full access for now). Note your webhook signing secret.
6. Add to `.env.local` and Vercel env:
   ```
   LEMON_SQUEEZY_API_KEY=...
   LEMON_SQUEEZY_STORE_ID=...
   LEMON_SQUEEZY_PRODUCT_ID=...
   LEMON_SQUEEZY_VARIANT_ID_MONTHLY=...
   LEMON_SQUEEZY_WEBHOOK_SECRET=...
   PAYMENT_GATEWAY=lemonsqueezy
   ```

### Day 2 — Webhook handler

Create `src/app/api/billing/webhook/route.ts`:

```ts
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!;

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = hmac.update(rawBody).digest("hex");
  // timing-safe compare
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(digest, "hex")
  );
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature");
  if (!verifySignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const { meta, data } = event;
  const userId = meta?.custom_data?.user_id;
  const subscriptionId = data?.id;

  if (!userId) {
    console.error("[webhook] missing user_id in custom_data");
    return new Response("ok", { status: 200 }); // 200 to avoid retries on bad webhooks
  }

  const renewsAt = data?.attributes?.renews_at
    ? new Date(data.attributes.renews_at)
    : null;

  switch (meta.event_name) {
    case "subscription_created":
    case "subscription_resumed":
      await db
        .update(users)
        .set({
          plan: "pro",
          gatewaySubscriptionId: subscriptionId,
          gatewayCustomerId: data.attributes.customer_id?.toString(),
          planRenewsAt: renewsAt,
        })
        .where(eq(users.id, userId));
      break;

    case "subscription_updated":
      await db
        .update(users)
        .set({ planRenewsAt: renewsAt })
        .where(eq(users.id, userId));
      break;

    case "subscription_cancelled":
    case "subscription_expired":
      await db
        .update(users)
        .set({
          plan: "free",
          planRenewsAt: null,
          // keep gatewaySubscriptionId for audit trail
        })
        .where(eq(users.id, userId));
      break;
  }

  return new Response("ok", { status: 200 });
}
```

Important: pass `custom_data: { user_id: <id> }` in the checkout URL when generating it (next step), so the webhook can correlate back.

Also add idempotency: store `event.meta.event_id` in a table or Redis cache; ignore replays. (The gateway-agnostic webhook scaffold in `tests/api/billing-webhook.test.ts` already tests this contract.)

### Day 3 — `createCheckoutSession` implementation

Create `src/lib/billing/gateways/lemonsqueezy.ts`:

```ts
import type { Gateway, CheckoutOptions, WebhookEvent } from "../gateway";

const API_BASE = "https://api.lemonsqueezy.com/v1";
const API_KEY = process.env.LEMON_SQUEEZY_API_KEY!;
const STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID!;
const VARIANT_ID = process.env.LEMON_SQUEEZY_VARIANT_ID_MONTHLY!;

export const lemonSqueezyGateway: Gateway = {
  name: "lemonsqueezy",

  async createCheckoutSession(opts: CheckoutOptions) {
    const res = await fetch(`${API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { custom: { user_id: opts.userId } },
            product_options: {
              redirect_url: opts.successUrl,
            },
          },
          relationships: {
            store: { data: { type: "stores", id: STORE_ID } },
            variant: { data: { type: "variants", id: VARIANT_ID } },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`LS checkout failed: ${res.status}`);
    const json = await res.json();
    return { url: json.data.attributes.url };
  },

  async cancelSubscription(subscriptionId: string) {
    await fetch(`${API_BASE}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
  },

  async getCustomerPortalUrl(customerId: string) {
    // Lemon Squeezy gives a per-subscription portal URL via the
    // subscription resource; fetch the latest subscription for the
    // customer and return its update_payment_method URL.
    const res = await fetch(
      `${API_BASE}/customers/${customerId}?include=subscriptions`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );
    const json = await res.json();
    const sub = json.included?.find((x: any) => x.type === "subscriptions");
    return sub?.attributes?.urls?.customer_portal ?? "/";
  },

  async parseWebhook(req: Request): Promise<WebhookEvent> {
    // Webhooks are handled in /api/billing/webhook directly; this
    // method exists for parity with the interface but is unused
    // because Lemon Squeezy webhooks don't go through getGateway().
    throw new Error("Use /api/billing/webhook directly for Lemon Squeezy");
  },
};
```

Update `src/lib/billing/gateway.ts` `getGateway()`:

```ts
export function getGateway(): Gateway {
  if (process.env.PAYMENT_GATEWAY === "lemonsqueezy") {
    // Dynamic import to avoid loading gateway code in environments
    // that don't use it.
    const { lemonSqueezyGateway } = require("./gateways/lemonsqueezy");
    return lemonSqueezyGateway;
  }
  return noopGateway;
}
```

### Day 4 — Customer portal route

Create `src/app/api/billing/portal/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getGateway } from "@/lib/billing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [u] = await db
    .select({ gatewayCustomerId: users.gatewayCustomerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!u?.gatewayCustomerId) {
    return Response.json({ error: "No active subscription" }, { status: 404 });
  }

  const url = await getGateway().getCustomerPortalUrl(u.gatewayCustomerId);
  return Response.redirect(url);
}
```

Wire the "Manage subscription" button in the Settings → Billing tab to `/api/billing/portal`.

Create `src/app/api/billing/checkout/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { getGateway } from "@/lib/billing";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const origin = process.env.NEXTAUTH_URL ?? "https://drafta.so";
  const url = await getGateway().createCheckoutSession({
    userId: session.user.id,
    plan: "pro",
    successUrl: `${origin}/app?checkout=success`,
    cancelUrl: `${origin}/pricing?checkout=cancel`,
  });
  return Response.json({ url });
}
```

Wire the "Upgrade to Pro" button in the LimitReachedModal + Settings → Billing → POST `/api/billing/checkout`, then `window.location = data.url`.

### Day 5 — End-to-end test on sandbox

1. Use Lemon Squeezy test mode (toggle in dashboard).
2. Sign up a test user in your local Drafta.
3. Trigger upgrade from the Settings → Billing tab.
4. Complete fake checkout with the test card.
5. Verify webhook fires → `users.plan` is `pro` in DB.
6. Try to exceed the free limit → confirm 200 (not 402) since user is now Pro.
7. Cancel via customer portal → verify webhook → `users.plan` reverts to `free`.

### Day 6 — Production deploy

1. Set production env vars in Vercel: `LEMON_SQUEEZY_*`, `PAYMENT_GATEWAY=lemonsqueezy`, `ENFORCE_PLAN_LIMITS=true`.
2. Redeploy.
3. First production transaction — buy your own Pro subscription ($24) to test end-to-end.
4. Monitor `[webhook]` logs in Vercel for the first 24 hours; ensure no signature failures.

---

## Gotchas / risks specific to Lemon Squeezy

1. **Subscription email mismatch.** If a user signs up in Drafta with email A, then completes checkout with email B, the customer is correlated by `custom_data.user_id`, not email. Make sure the checkout always passes `user_id`.
2. **Test mode != production mode.** Webhook events from test mode won't fire in production and vice-versa. Don't accidentally use a test webhook secret in prod.
3. **Refunds are a manual action in their dashboard.** No automated refund API for indie tier. If a user asks for a refund, do it manually within 24h to maintain trust.
4. **VAT shows up in the customer's checkout but not in your revenue.** Don't be surprised when your monthly statement is lower than 24× subscriptions — Lemon Squeezy keeps the tax portion.
5. **Annual plans need a separate variant ID.** If you add an annual tier later, you need a second variant in the same product.

---

## What to do if Lemon Squeezy fails

If KYC takes >7 days or you hit any blocker:

1. **Switch to Paddle.** Same merchant-of-record model. Replace `src/lib/billing/gateways/lemonsqueezy.ts` with `paddle.ts`. Update `getGateway()`. The `Gateway` interface stays the same — webhook handler is the only file with non-trivial diff.
2. **If Paddle fails: DodoPayments.** Newer but India-friendly merchant of record.
3. **If you decide to focus on Indian customers first: Razorpay.** Switch USD pricing to INR (₹2,000/mo Pro), update PLAN_LIMITS pricing constant, redo positioning for India market. This is a different go-to-market — only do this if global launch is genuinely failing.

---

## Final checklist before flipping `ENFORCE_PLAN_LIMITS=true`

- [ ] KYC complete; gateway is in production mode
- [ ] Webhook endpoint live; signature verification tested
- [ ] Checkout flow works end-to-end with a real card
- [ ] Cancellation flow works end-to-end
- [ ] LimitReachedModal upgrade CTA wired to `/api/billing/checkout`
- [ ] Settings → Billing tab "Upgrade" + "Manage subscription" buttons wired
- [ ] Founding-member grace migration ran (`npm run migrate:grace`) — existing users won't hit walls
- [ ] Sentry or Vercel log alerts for webhook failures
- [ ] Manual test: hit free limit with a non-Pro test user, verify 402 response and modal
- [ ] Manual test: pro user can exceed free limits without 402
- [ ] Communicate to existing users (in-app banner): "Pro pricing now live. You're free until [date] as a founding member."
- [ ] Update `.env.example` with the new vars (without values)
- [ ] Tag the deploy as `v1.0-payments-live` in git

Once all boxes are checked: flip the flag, deploy, watch the first 24 hours of webhook logs.
