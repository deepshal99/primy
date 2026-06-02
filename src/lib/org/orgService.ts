import { db } from "@/db";
import { organizations, orgMembers, users, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { slugify } from "./slug";
import { hasOrgRole, type OrgRole } from "./orgRoles";
import { getUserOrg } from "./orgAccess";

// ── Org service ──
//
// All org mutations go through here so the one-org-per-user rule and role
// gating live in one place. Routes stay thin (auth + parse + call + respond).

export class OrgError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OrgError";
    this.status = status;
  }
}

/** Convert an OrgError into a Response; null for anything else (caller 500s). */
export function orgErrorResponse(error: unknown): Response | null {
  if (error instanceof OrgError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
}

/**
 * Create an org and make the caller its owner. Enforces one org per user.
 * Throws OrgError(409) if the user already belongs to an org.
 */
export async function createOrg(userId: string, name: string): Promise<OrgSummary> {
  const existing = await getUserOrg(userId);
  if (existing) throw new OrgError(409, "You already belong to an organization.");

  const trimmed = name.trim();
  if (!trimmed) throw new OrgError(400, "Organization name is required.");

  const id = nanoid();
  const slug = `${slugify(trimmed)}-${nanoid(6).toLowerCase()}`;
  await db.insert(organizations).values({ id, name: trimmed, slug, ownerId: userId });
  await db.insert(orgMembers).values({
    id: nanoid(),
    orgId: id,
    userId,
    role: "owner",
    status: "active",
  });
  return { id, name: trimmed, slug, plan: "free", role: "owner" };
}

/**
 * Authorize the caller against an org at a minimum role.
 *   - 404 when not an active member (don't leak existence)
 *   - 403 when below `min`
 */
export async function requireOrgRole(
  orgId: string,
  userId: string,
  min: OrgRole = "member"
): Promise<OrgRole> {
  const [row] = await db
    .select({ role: orgMembers.role, status: orgMembers.status })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  if (!row || row.status !== "active") throw new OrgError(404, "Not found");
  if (!hasOrgRole(row.role as OrgRole, min)) {
    throw new OrgError(403, "Insufficient permissions");
  }
  return row.role as OrgRole;
}

/** The caller's org summary, or null if they have none. */
export async function getOrgForUser(userId: string): Promise<OrgSummary | null> {
  const membership = await getUserOrg(userId);
  if (!membership) return null;
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, membership.orgId))
    .limit(1);
  if (!org) return null;
  return { ...org, role: membership.role as OrgRole };
}

export interface OrgMemberRow {
  userId: string;
  role: string;
  status: string;
  email: string;
  name: string;
}

/** List active members of an org (with user email/name). */
export async function listOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  return db
    .select({
      userId: orgMembers.userId,
      role: orgMembers.role,
      status: orgMembers.status,
      email: users.email,
      name: users.name,
    })
    .from(orgMembers)
    .innerJoin(users, eq(users.id, orgMembers.userId))
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.status, "active")));
}

/**
 * Add an existing Primy user to the org by email. Enforces one-org-per-user
 * on the target. Idempotent: reactivates / updates role on an existing row.
 * `role` may be "admin" or "member" (owner is set only by createOrg/transfer).
 */
export async function addOrgMemberByEmail(
  orgId: string,
  email: string,
  inviterId: string,
  role: "admin" | "member"
): Promise<{ userId: string; role: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new OrgError(400, "Email is required.");

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (!target) {
    throw new OrgError(404, "No Primy account found for that email. Ask them to sign up first.");
  }

  // One org per user: block if the target is an active member of another org.
  const targetOrg = await getUserOrg(target.id);
  if (targetOrg && targetOrg.orgId !== orgId) {
    throw new OrgError(409, "That user already belongs to another organization.");
  }

  const [existing] = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, target.id)))
    .limit(1);

  if (existing) {
    await db
      .update(orgMembers)
      .set({ role, status: "active", invitedBy: inviterId })
      .where(eq(orgMembers.id, existing.id));
  } else {
    await db.insert(orgMembers).values({
      id: nanoid(),
      orgId,
      userId: target.id,
      role,
      status: "active",
      invitedBy: inviterId,
    });
  }
  return { userId: target.id, role };
}

/** Remove a member from the org. Owners cannot be removed (transfer first). */
export async function removeOrgMember(orgId: string, targetUserId: string): Promise<void> {
  const [member] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)))
    .limit(1);
  if (member && member.role === "owner") {
    throw new OrgError(400, "Can't remove the owner. Transfer ownership first.");
  }
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));
}

/** Rename an org. */
export async function renameOrg(orgId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new OrgError(400, "Organization name is required.");
  await db.update(organizations).set({ name: trimmed }).where(eq(organizations.id, orgId));
}

/**
 * Transfer ownership to another active member. The new owner becomes "owner",
 * the previous owner is demoted to "admin", and organizations.ownerId moves.
 */
export async function transferOwnership(
  orgId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<void> {
  if (currentOwnerId === newOwnerId) {
    throw new OrgError(400, "That user is already the owner.");
  }
  const [target] = await db
    .select({ status: orgMembers.status })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, newOwnerId)))
    .limit(1);
  if (!target || target.status !== "active") {
    throw new OrgError(404, "That user is not an active member of this org.");
  }
  await db
    .update(orgMembers)
    .set({ role: "owner" })
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, newOwnerId)));
  await db
    .update(orgMembers)
    .set({ role: "admin" })
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, currentOwnerId)));
  await db.update(organizations).set({ ownerId: newOwnerId }).where(eq(organizations.id, orgId));
}

/**
 * Delete an org. Org-shared projects are reset to private (their orgId cleared)
 * so they don't dangle, then the org + memberships cascade-delete.
 */
export async function deleteOrg(orgId: string): Promise<void> {
  await db
    .update(projects)
    .set({ visibility: "private", orgId: null })
    .where(eq(projects.orgId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
}
