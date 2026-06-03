/**
 * resolveEffectivePlan — the single DB-backed entry point for "what plan is
 * this user effectively on, right now".
 *
 * It reads the user's own (plan, proUntil) AND their org's (plan, proUntil)
 * and folds both through the pure `effectivePlan`. Centralizing this here stops
 * the per-site drift that previously let org-paid ("company paid") members
 * resolve as free anywhere a route hand-rolled `effectivePlan({ plan, proUntil })`
 * without the org fields.
 *
 * Returns "free" when the user row is absent — callers that need a 401 for a
 * missing user should check that separately.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Plan } from "@/lib/plans";
import { getOrgPlanInput } from "@/lib/org/orgAccess";
import { effectivePlan } from "./effectivePlan";

export async function resolveEffectivePlan(userId: string): Promise<Plan> {
  const [rows, org] = await Promise.all([
    db
      .select({ plan: users.plan, proUntil: users.proUntil })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getOrgPlanInput(userId),
  ]);
  const userRow = rows[0];
  if (!userRow) return "free";
  return effectivePlan({
    plan: userRow.plan,
    proUntil: userRow.proUntil ?? null,
    orgPlan: org.orgPlan,
    orgProUntil: org.orgProUntil,
  });
}
