import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * POST /api/projects/[id]/share — Generate share token for a project
 * DELETE /api/projects/[id]/share — Remove share token (unshare)
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const [project] = await db
      .select({ id: projects.id, shareToken: projects.shareToken })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // If already shared, return existing token
    if (project.shareToken) {
      return Response.json({ shareToken: project.shareToken });
    }

    const token = nanoid(16);

    await db
      .update(projects)
      .set({ shareToken: token, updatedAt: new Date() })
      .where(eq(projects.id, id));

    return Response.json({ shareToken: token });
  } catch (error) {
    console.error("[API] POST /api/projects/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(projects)
      .set({ shareToken: null, updatedAt: new Date() })
      .where(eq(projects.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/projects/[id]/share error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
