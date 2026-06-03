import { db } from "@/db";
import { knowledgeUnits, projectTables, projectDecks, projectPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectAccess, type ProjectRole } from "@/lib/projectAccess";

export type ArtifactType = "ku" | "table" | "deck" | "page";

export function isValidArtifactType(t: string): t is ArtifactType {
  return t === "ku" || t === "table" || t === "deck" || t === "page";
}

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

/**
 * Shared artifact authorization — resolve an artifact (ku/table/deck) to its
 * parent project and check the user's membership role against `minRole`.
 * Returns false on any miss so callers can 404 without leaking existence.
 *
 * Single source of truth for snapshot routes (list/create, read, restore),
 * which previously each carried an identical copy of this + ROLE_RANK.
 */
export async function canAccessArtifact(
  userId: string,
  type: ArtifactType,
  artifactId: string,
  minRole: ProjectRole
): Promise<boolean> {
  try {
    const tableMap = { ku: knowledgeUnits, table: projectTables, deck: projectDecks, page: projectPages } as const;
    const t = tableMap[type];
    const [row] = await db
      .select({ projectId: t.projectId })
      .from(t)
      .where(eq(t.id, artifactId))
      .limit(1);
    if (!row) return false;
    const access = await getProjectAccess(row.projectId, userId);
    return !!access && ROLE_RANK[access.role] >= ROLE_RANK[minRole];
  } catch (err) {
    // Deny on error, but log it — a transient DB failure shouldn't be silently
    // indistinguishable from a legitimate access denial.
    console.error("[Primy] canAccessArtifact error:", err);
    return false;
  }
}
