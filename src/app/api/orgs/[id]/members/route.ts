import { auth } from "@/lib/auth";
import {
  requireOrgRole,
  listOrgMembers,
  addOrgMemberByEmail,
  removeOrgMember,
  orgErrorResponse,
} from "@/lib/org/orgService";

/**
 * Org membership management.
 *   GET    /api/orgs/[id]/members          — list members (member+)
 *   POST   /api/orgs/[id]/members          — add an existing user by email (admin+)
 *   DELETE /api/orgs/[id]/members?userId=  — remove a member (admin+)
 *
 * "Invite" here = add an EXISTING Primy user by email. Email-token invites for
 * non-users land in W5 (the schema already supports status:"pending").
 */

const ASSIGNABLE: ("admin" | "member")[] = ["admin", "member"];

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

    const members = await listOrgMembers(id);
    return Response.json({ members });
  } catch (error) {
    console.error("[API] GET /api/orgs/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    let body: { email?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const role = (body.role ?? "member") as "admin" | "member";
    if (!ASSIGNABLE.includes(role)) {
      return Response.json({ error: "Role must be admin or member" }, { status: 400 });
    }

    try {
      await requireOrgRole(id, userId, "admin");
      const result = await addOrgMemberByEmail(id, body.email ?? "", userId, role);
      return Response.json({ success: true, ...result });
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }
  } catch (error) {
    console.error("[API] POST /api/orgs/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const targetUserId = new URL(req.url).searchParams.get("userId");
    if (!targetUserId) return Response.json({ error: "userId is required" }, { status: 400 });

    try {
      // Admins can remove members; anyone may remove themselves (leave).
      if (targetUserId !== userId) {
        await requireOrgRole(id, userId, "admin");
      } else {
        await requireOrgRole(id, userId, "member");
      }
      await removeOrgMember(id, targetUserId);
      return Response.json({ success: true });
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }
  } catch (error) {
    console.error("[API] DELETE /api/orgs/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
