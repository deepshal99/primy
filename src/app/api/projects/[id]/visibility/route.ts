import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireProjectAccess, accessErrorResponse } from "@/lib/projectAccess";
import { getUserOrg } from "@/lib/org/orgAccess";
import { logActivity } from "@/lib/activity";

/**
 * Project visibility — the private ↔ org share toggle.
 *   GET   /api/projects/[id]/visibility  — { visibility, orgId } (viewer+)
 *   PATCH /api/projects/[id]/visibility  — set visibility (owner only)
 *
 * "org" makes the project visible to every member of the owner's org
 * (retroactively + for future members). "private" reverts to owner + invitees.
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
      await requireProjectAccess(id, userId, "viewer");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const [row] = await db
      .select({ visibility: projects.visibility, orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return Response.json({ visibility: row?.visibility ?? "private", orgId: row?.orgId ?? null });
  } catch (error) {
    console.error("[API] GET /api/projects/[id]/visibility error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
      await requireProjectAccess(id, userId, "owner");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    let body: { visibility?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.visibility === "org") {
      const org = await getUserOrg(userId);
      if (!org) {
        return Response.json(
          { error: "Create an organization first (Settings → Team)." },
          { status: 400 }
        );
      }
      await db
        .update(projects)
        .set({ visibility: "org", orgId: org.orgId, updatedAt: new Date() })
        .where(eq(projects.id, id));
      await logActivity({ projectId: id, actorId: userId, verb: "shared" });
      return Response.json({ visibility: "org", orgId: org.orgId });
    }

    if (body.visibility === "private") {
      await db
        .update(projects)
        .set({ visibility: "private", orgId: null, updatedAt: new Date() })
        .where(eq(projects.id, id));
      await logActivity({ projectId: id, actorId: userId, verb: "unshared" });
      return Response.json({ visibility: "private", orgId: null });
    }

    return Response.json({ error: "visibility must be 'private' or 'org'" }, { status: 400 });
  } catch (error) {
    console.error("[API] PATCH /api/projects/[id]/visibility error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
