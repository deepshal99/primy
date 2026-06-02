import { db } from "@/db";
import { projects, projectMembers, orgMembers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

// ── Project access control ──
//
// Single source of truth for "can this user do X on this project". Replaces
// the scattered `eq(projects.userId, session.user.id)` checks. Membership
// (project_members) is authoritative; the legacy projects.userId pointer is
// honored as an implicit owner so the system stays correct before/without
// the backfill (scripts/backfill-project-members.ts).

export type ProjectRole = "owner" | "editor" | "commenter" | "viewer";

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

export interface ProjectAccess {
  projectId: string;
  userId: string;
  role: ProjectRole;
  /** true when access came from the legacy projects.userId pointer (no member row yet) */
  legacy: boolean;
}

/** Thrown by requireProjectAccess; carries the HTTP status to return. */
export class ProjectAccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ProjectAccessError";
    this.status = status;
  }
}

/**
 * Resolve a user's role on a project, or null if they have no access.
 * Active membership wins; otherwise the creator pointer counts as owner.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess | null> {
  const [member] = await db
    .select({ role: projectMembers.role, status: projectMembers.status })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (member && member.status === "active") {
    return { projectId, userId, role: member.role as ProjectRole, legacy: false };
  }

  // Legacy + org-visibility fallback. Read the project's owner pointer,
  // visibility, org, and soft-delete state in one row.
  const [project] = await db
    .select({
      userId: projects.userId,
      visibility: projects.visibility,
      orgId: projects.orgId,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;
  // Soft-deleted projects are inaccessible via the normal path (Trash only).
  if (project.deletedAt) return null;

  // The original creator is an implicit owner.
  if (project.userId === userId) {
    return { projectId, userId, role: "owner", legacy: true };
  }

  // Org-shared: any active member of the project's org gets viewer access.
  if (project.visibility === "org" && project.orgId) {
    const [orgRow] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, project.orgId),
          eq(orgMembers.userId, userId),
          eq(orgMembers.status, "active")
        )
      )
      .limit(1);
    if (orgRow) {
      return { projectId, userId, role: "viewer", legacy: false };
    }
  }

  return null;
}

/**
 * Authorize a user against a project at a minimum role. Throws
 * ProjectAccessError on failure:
 *   - 404 when the user is not a member at all (don't leak existence)
 *   - 403 when the user's role is below `minRole`
 *
 * Usage in a route:
 *   try {
 *     await requireProjectAccess(id, session.user.id, "editor");
 *   } catch (e) {
 *     const res = accessErrorResponse(e);
 *     if (res) return res;
 *     throw e;
 *   }
 */
export async function requireProjectAccess(
  projectId: string,
  userId: string,
  minRole: ProjectRole = "viewer"
): Promise<ProjectAccess> {
  const access = await getProjectAccess(projectId, userId);
  if (!access) {
    throw new ProjectAccessError(404, "Not found");
  }
  if (ROLE_RANK[access.role] < ROLE_RANK[minRole]) {
    throw new ProjectAccessError(403, "Insufficient permissions");
  }
  return access;
}

/**
 * Convert a thrown error into a Response when it's a ProjectAccessError.
 * Returns null for any other error so the caller can rethrow / 500.
 */
export function accessErrorResponse(error: unknown): Response | null {
  if (error instanceof ProjectAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}

/**
 * Idempotently record `userId` as an owner of `projectId`. Call this on every
 * project-creation path so new projects are membership-correct from birth.
 */
export async function addProjectOwner(
  projectId: string,
  userId: string
): Promise<void> {
  await db
    .insert(projectMembers)
    .values({ id: nanoid(), projectId, userId, role: "owner", status: "active" })
    .onConflictDoNothing();
}

/**
 * Return the set of project IDs the user can access — active memberships plus
 * legacy-owned projects (projects.userId). Used by the project list endpoint.
 */
export async function listAccessibleProjectIds(userId: string): Promise<string[]> {
  // 1) Active memberships, 2) legacy-owned (non-deleted).
  const [memberRows, ownedRows] = await Promise.all([
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.status, "active"))),
    db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt))),
  ]);

  const ids = new Set<string>();
  for (const r of memberRows) ids.add(r.projectId);
  for (const r of ownedRows) ids.add(r.id);

  // 3) Org-shared, non-deleted projects of the user's org.
  const [orgRow] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, "active")))
    .limit(1);

  if (orgRow) {
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, orgRow.orgId),
          eq(projects.visibility, "org"),
          isNull(projects.deletedAt)
        )
      );
    for (const r of orgProjects) ids.add(r.id);
  }

  return [...ids];
}
