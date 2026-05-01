/**
 * withPlanLimit — higher-order function that wraps a Next.js route
 * handler with auth, plan resolution, and usage metering.
 *
 * Order of operations:
 *
 *   1. Resolve session via NextAuth. If absent → 401.
 *   2. Fetch (plan, proUntil) for the user. If user not found → 401.
 *   3. Compute effective plan via effectivePlan(...).
 *   4. If !planLimitsEnforced(): skip the cap check, but STILL increment
 *      counters so we have data when the flag flips on.
 *   5. If enforced: read current usage. If at-or-over the per-month
 *      cap → 402 with a structured body. Otherwise increment then call
 *      the handler.
 *
 * Counter rollback on handler failure: NOT implemented. Per the v1.0
 * spec, counter drift is preferred over the complexity of compensating
 * transactions. Treat the counter as best-effort metering, not a
 * financial ledger. (If we ever metered actual paid usage events,
 * revisit.)
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { effectivePlan } from "./effectivePlan";
import { getUsage, incrementUsage } from "./usage";
import {
  PLAN_LIMITS,
  planLimitsEnforced,
  type MeteredResource,
  type Plan,
} from "@/lib/plans";

export interface PlanCtx {
  userId: string;
  plan: Plan;
}

export interface WithPlanLimitOptions {
  /** Which counter to gate on. */
  resource: MeteredResource;
  /**
   * Per-call cost. Defaults to 1. For storage, pass the file size in
   * bytes. For aiMessages and fileUploads, leave at default.
   */
  amount?: number;
}

type RouteHandler<T extends Response | Promise<Response>> = (
  req: NextRequest,
  ctx: PlanCtx
) => T;

/** Maps the resource short-name to the corresponding PLAN_LIMITS key. */
const LIMIT_KEY: Record<MeteredResource, keyof (typeof PLAN_LIMITS)["free"]> = {
  aiMessages: "aiMessagesPerMonth",
  fileUploads: "fileUploadsPerMonth",
};

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export function withPlanLimit<T extends Response | Promise<Response>>(
  handler: RouteHandler<T>,
  opts: WithPlanLimitOptions
): (req: NextRequest) => Promise<Response> {
  const amount = opts.amount ?? 1;

  return async (req: NextRequest): Promise<Response> => {
    // 1. Auth gate.
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return unauthorized();

    // 2. Read user row (single indexed query).
    const rows = await db
      .select({ plan: users.plan, proUntil: users.proUntil })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const userRow = rows?.[0];
    if (!userRow) return unauthorized();

    // 3. Resolve effective plan.
    const plan = effectivePlan({
      plan: userRow.plan,
      proUntil: userRow.proUntil ?? null,
    });

    // 4. Enforcement: when flag is OFF, increment for telemetry but
    //    skip cap check. When ON, check cap before incrementing.
    if (planLimitsEnforced()) {
      const used = await getUsage(userId);
      const usedForResource = used[opts.resource];
      const limit = PLAN_LIMITS[plan][LIMIT_KEY[opts.resource]] as number;

      if (Number.isFinite(limit) && usedForResource >= limit) {
        return Response.json(
          {
            error: "plan_limit_exceeded",
            plan,
            resource: opts.resource,
            limit,
            used: usedForResource,
          },
          { status: 402 }
        );
      }
    }

    // 5. Increment counter atomically. If this throws, the request
    //    fails before the handler runs — counter is consistent.
    await incrementUsage(userId, opts.resource, amount);

    // 6. Forward to handler. Exceptions propagate; counter does not
    //    roll back (see header docstring).
    return await handler(req, { userId, plan });
  };
}
