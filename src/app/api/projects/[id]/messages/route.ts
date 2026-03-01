import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projects, messages } from "@/db/schema";
import { eq, and, desc, lt, sql } from "drizzle-orm";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// GET /api/projects/[id]/messages?before=ISO&limit=50
// Returns older messages for cursor-based pagination
export async function GET(
  req: Request,
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

    const url = new URL(req.url);
    const beforeParam = url.searchParams.get("before");
    const limitParam = url.searchParams.get("limit");

    if (!beforeParam) {
      return Response.json({ error: "Missing required query param: before" }, { status: 400 });
    }

    const beforeDate = new Date(beforeParam);
    if (isNaN(beforeDate.getTime())) {
      return Response.json({ error: "Invalid 'before' timestamp" }, { status: 400 });
    }

    const limit = Math.min(
      Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    );

    // Fetch limit+1 to determine hasMore
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.projectId, id),
          lt(messages.timestamp, beforeDate)
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Reverse to chronological order for display
    const chronological = pageRows.reverse();

    return Response.json({
      messages: chronological.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime(),
        attachments: m.attachments,
      })),
      hasMore,
    });
  } catch (error) {
    console.error("[API] GET /api/projects/[id]/messages error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
