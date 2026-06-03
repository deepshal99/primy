import { auth } from "@/lib/auth";
import { requireProjectAccess, accessErrorResponse } from "@/lib/projectAccess";
import { listActivity } from "@/lib/activity";

/** GET /api/projects/[id]/activity — recent project activity (viewer+). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
      await requireProjectAccess(id, session.user.id, "viewer");
    } catch (e) {
      const res = accessErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const events = await listActivity(id, 20);
    return Response.json({ events });
  } catch (error) {
    console.error("[API] GET /api/projects/[id]/activity error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
