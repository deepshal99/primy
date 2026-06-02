import { auth } from "@/lib/auth";
import {
  requireOrgRole,
  listOrgMembers,
  renameOrg,
  transferOwnership,
  deleteOrg,
  getOrgForUser,
  orgErrorResponse,
} from "@/lib/org/orgService";

/**
 * A single organization.
 *   GET    /api/orgs/[id]  — org summary + members (member+)
 *   PATCH  /api/orgs/[id]  — rename (admin+) or transfer ownership (owner)
 *   DELETE /api/orgs/[id]  — delete the org (owner)
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
      await requireOrgRole(id, userId, "member");
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const [org, members] = await Promise.all([getOrgForUser(userId), listOrgMembers(id)]);
    return Response.json({ org, members });
  } catch (error) {
    console.error("[API] GET /api/orgs/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    let body: { name?: string; transferTo?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      if (typeof body.transferTo === "string") {
        await requireOrgRole(id, userId, "owner");
        await transferOwnership(id, userId, body.transferTo);
        return Response.json({ success: true, transferred: true });
      }
      if (typeof body.name === "string") {
        await requireOrgRole(id, userId, "admin");
        await renameOrg(id, body.name);
        return Response.json({ success: true });
      }
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }
  } catch (error) {
    console.error("[API] PATCH /api/orgs/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
      await requireOrgRole(id, userId, "owner");
      await deleteOrg(id);
      return Response.json({ success: true });
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }
  } catch (error) {
    console.error("[API] DELETE /api/orgs/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
