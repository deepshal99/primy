# Revenue Model Plan — Primy

**Date:** 2026-06-02
**Method:** Mapped the existing billing/usage/gateway code + the real per-feature cost drivers.

TL;DR: the **plumbing is ~80% built** (plans, metering, usage UI, pricing page, gateway *interface*) but **revenue is $0** because no payment gateway is wired, `ENFORCE_PLAN_LIMITS` is off, and gateway fields are never populated. The work is integration + a margin-aware tier design, not a rebuild.

---

## What already exists (don't rebuild)
- `plans.ts`: Free + Pro ($24/mo), limits defined; `ENFORCE_PLAN_LIMITS` flag (**off**); 60-day founding-member grace.
- `withPlanLimit` + `usage` table + `incrementUsage`: atomic monthly metering of `aiMessages` and `fileUploads` (storage tracked, not enforced).
- Usage dashboard in Settings (real counters + progress bars), `LimitReachedModal` (dormant), `/pricing` page (CTAs disabled).
- `gateway.ts`: a clean `Gateway` interface + `NoopGateway`; `users.gatewayCustomerId/gatewaySubscriptionId/planRenewsAt` columns — **never written**. No checkout, no webhooks.

## The gaps (what unlocks revenue)
1. No payment gateway integration (checkout, webhooks, portal).
2. `ENFORCE_PLAN_LIMITS=false` → everyone gets Pro behavior today.
3. No plan-expiry job (Pro never downgrades).
4. File uploads/OCR/exports cost money but aren't capped.
5. No measured COGS → prices are guesses.

---

## Step 0 — Measure COGS before pricing (do first, 1 day)
You can't price margin-blind. Instrument real cost per action:
- Log OpenAI `usage` (input/output/reasoning tokens) per chat + per OCR + per embedding into a `cost_events` table (the AI SDK already returns usage; the chat route's `finish` part has it).
- Roughly, today's drivers (order-of-magnitude, **verify with real logs**):
  - **Chat message** (gpt-4.1, ~5–15K context + 1–4K out): ~**$0.01–0.05** each. `chat-deep` (gpt-5.5) is multiples higher.
  - **Image-PDF OCR** (vision): ~**$0.02–0.08** per PDF.
  - **Embeddings**: ~**$0.00001/1K tokens** — negligible.
  - **Puppeteer PDF export**: compute-seconds, ~**$0.001–0.01**.
  - **Unsplash/Pexels**: free tier.
- Margin check: Pro at **1,500 msgs/mo** could cost **$15–75** in AI alone vs a **$24** price → **the heavy tail can be unprofitable**. This is the single most important number to nail.

---

## Recommended tiers (adjust after COGS)

| | **Free** | **Pro — $24/mo** ($240/yr, ~2 mo free) | **Team — $20/seat/mo** (min 2) |
|---|---|---|---|
| Workspaces | 1 | Unlimited | Unlimited |
| AI messages / mo | 50 | **1,000** (was 1,500 — protect margin) | 1,000 / seat (pooled) |
| `chat-deep` (gpt-5.5) | — | included, sub-limit (e.g. 100/mo) | included |
| File uploads / mo | 5 | 200 | 200 / seat |
| Image-PDF **OCR** / mo | 2 | 50 | 50 / seat |
| Storage | 500 MB | 20 GB | 50 GB |
| Members per project | 1 (solo) | 3 | Unlimited |
| Watermark on shares | yes | no | no |
| Exports (PDF/PPTX/XLSX) | watermarked | full | full |
| Support | community | email | priority |

Key margin moves vs today: cap Pro AI at **1,000** (not 1,500), add a **`chat-deep` sub-limit** (gpt-5.5 is the expensive path — see latency plan), and **meter OCR + enforce file uploads** (currently counted but uncapped). Add a metered **"AI credits" top-up** ($5 / +500 msgs) so heavy users pay for their cost instead of eroding margin.

---

## Gateway choice
Founder is India-based (`.in`) and the pricing FAQ already names Razorpay. Recommendation:
- **Razorpay** for INR / India (UPI, cards) — primary for the home market.
- **Stripe** for global cards/subscriptions.
- Or start with **one** (Razorpay) and add Stripe when international demand appears.
- Implement behind the existing `Gateway` interface (`gateway.ts`) — swap `NoopGateway` for a real adapter selected by `PAYMENT_GATEWAY` env. **Regional pricing**: PPP-adjusted INR price (e.g. ₹999/mo) vs $24 globally.

---

## Build sequence (after COGS)
1. **Gateway adapter** (`RazorpayGateway`/`StripeGateway`) implementing `createCheckoutSession`, `parseWebhook`, `cancelSubscription`, `getCustomerPortalUrl`.
2. **`POST /api/checkout`** → create subscription session → redirect. Wire the `/pricing` + Settings "Upgrade" CTAs (currently disabled).
3. **`POST /api/webhooks/payment`** → verify signature → on `subscription.created/updated` set `plan="pro"`, `gatewaySubscriptionId`, `planRenewsAt`; on `canceled` revert to `free`. (Event types already modeled in `gateway.ts`.)
4. **Expiry**: a daily cron (the `cron/` infra exists) that downgrades where `planRenewsAt < now()`; or check at request time.
5. **Enforce**: meter OCR + enforce file uploads in `withPlanLimit`; wire `LimitReachedModal` to the 402 response; then flip **`ENFORCE_PLAN_LIMITS=true`** for new signups (keep founding members on grace).
6. **Customer portal** link in Settings (cancel/update card via gateway portal).
7. **Dunning**: on failed renewal, grace + email, then downgrade.

---

## Pricing strategy notes
- **Annual plan** (~2 months free) improves cash + retention; default the toggle to annual on `/pricing`.
- **Founding members**: keep the 60-day Pro grace as a launch growth lever; convert with an email sequence before expiry.
- **Team tier** is the real expansion revenue (per-seat) once collaboration (separate plan) ships — gate it on that.
- **"Bring your own key"** is intentionally declined (the FAQ says so) — keeps pricing flat and COGS controllable. Keep it that way for managed simplicity, but it caps margin on power users → that's what credit top-ups solve.
- Watch the **gpt-5.5 (`chat-deep`) cost** specifically — it's the most expensive action; its sub-limit is a deliberate margin guard.

---

## First revenue milestone (smallest shippable)
Razorpay subscription + `/api/checkout` + webhook → `plan="pro"` + working Upgrade CTA + `ENFORCE_PLAN_LIMITS=true` for new users. Everything else (Stripe, Team, credits, dunning) is iteration. Estimate: **2–4 days** once COGS is measured and a gateway account is set up.
