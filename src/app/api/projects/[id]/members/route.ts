import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projectMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireProjectAccess, accessErrorResponse, type ProjectRole } from "@/lib/projectAccess";
import { logActivity } from "@/lib/activity";

/**
 * Project membership management.
 *
 *   GET    /api/projects/[id]/members          — list members (viewer+)
 *   POST   /api/projects/[id]/members          — add a member by email (owner)
 *   DELETE /api/projects/[id]/members?userId=  — remove a member (owner)
 *
 * "Invite" here = add an EXISTING Primy user by email. Email-based invites for
 * non-users (pending tokens + email) are a follow-up; the schema already
 * supports `status: "pending"` for that.
 */

const ASSIGNABLE_ROLES: ProjectRole[] = ["editor", "commenter", "viewer"];

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const rows = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        status: projectMembers.status,
        email: users.email,
        name: users.name,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.status, "active")));

    return Response.json({ members: rows });
  } catch (error) {
    console.error("[API] GET /api/projects/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    // Only owners may add members.
    try {
      await requireProjectAccess(id, userId, "owner");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    let body: { email?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = (body.role ?? "editor") as ProjectRole;
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return Response.json({ error: "Role must be editor, commenter, or viewer" }, { status: 400 });
    }

    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!target) {
      // Don't reveal whether the email exists — generic, actionable message.
      return Response.json(
        { error: "No Primy account found for that email. Ask them to sign up first." },
        { status: 404 },
      );
    }

    // Idempotent upsert: reactivate / update role if a row already exists.
    const [existing] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, target.id)))
      .limit(1);

    if (existing) {
      await db
        .update(projectMembers)
        .set({ role, status: "active", invitedBy: userId })
        .where(eq(projectMembers.id, existing.id));
    } else {
      await db.insert(projectMembers).values({
        id: nanoid(),
        projectId: id,
        userId: target.id,
        role,
        status: "active",
        invitedBy: userId,
      });
    }

    await logActivity({ projectId: id, actorId: userId, verb: "invited", meta: { email, role } });

    return Response.json({ success: true, userId: target.id, role });
  } catch (error) {
    console.error("[API] POST /api/projects/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const targetUserId = new URL(req.url).searchParams.get("userId");
    if (!targetUserId) return Response.json({ error: "userId is required" }, { status: 400 });
    if (targetUserId === userId) {
      return Response.json({ error: "You can't remove yourself" }, { status: 400 });
    }

    // Never remove an owner via this endpoint (ownership transfer is separate).
    const [member] = await db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, targetUserId)))
      .limit(1);
    if (member && member.role === "owner") {
      return Response.json({ error: "Can't remove an owner" }, { status: 400 });
    }

    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, targetUserId)));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/projects/[id]/members error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
