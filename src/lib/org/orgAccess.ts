import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// ── Org access helpers ──
//
// A user belongs to at most one org. These helpers resolve that single
// membership and the org's plan, feeding effectivePlan's org inheritance
// (the "company paid" path).

export interface UserOrg {
  orgId: string;
  role: string; // owner | admin | member
}

/** The user's single active org membership, or null. */
export async function getUserOrg(userId: string): Promise<UserOrg | null> {
  const [row] = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role, status: orgMembers.status })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, "active")))
    .limit(1);
  if (!row) return null;
  return { orgId: row.orgId, role: row.role };
}

/** Org plan fields to feed effectivePlan. Empty when the user has no org. */
export async function getOrgPlanInput(
  userId: string
): Promise<{ orgPlan: string | null; orgProUntil: Date | null }> {
  const org = await getUserOrg(userId);
  if (!org) return { orgPlan: null, orgProUntil: null };
  const [row] = await db
    .select({ plan: organizations.plan, proUntil: organizations.proUntil })
    .from(organizations)
    .where(eq(organizations.id, org.orgId))
    .limit(1);
  return { orgPlan: row?.plan ?? null, orgProUntil: row?.proUntil ?? null };
}
