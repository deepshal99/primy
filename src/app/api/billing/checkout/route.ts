import { auth } from "@/lib/auth";
import { getGateway } from "@/lib/billing";
import { log } from "@/lib/log";

/**
 * POST /api/billing/checkout — start a Pro subscription checkout.
 * Returns { url } to redirect the user to the gateway-hosted page.
 * With the noop gateway this returns 503 with a clear message, so the
 * upgrade UI can ship before the provider is live.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const gateway = getGateway();
  try {
    const { url } = await gateway.createCheckoutSession({
      userId: session.user.id,
      plan: "pro",
      successUrl: `${origin}/app?upgraded=1`,
      cancelUrl: `${origin}/pricing`,
    });
    return Response.json({ url });
  } catch (err) {
    log.error("billing.checkout", err, { gateway: gateway.name, userId: session.user.id });
    return Response.json(
      { error: "Checkout isn't available yet. Please try again later or contact support." },
      { status: 503 }
    );
  }
}
