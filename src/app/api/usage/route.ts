import { auth } from "@/lib/auth";
import { getUsage, currentMonthKey } from "@/lib/billing";

/**
 * GET /api/usage
 * Returns the signed-in user's current-month usage row:
 *   { month, aiMessages, fileUploads, storageBytes }
 *
 * Returns zeros for fields that haven't been incremented yet (no row
 * is created on read — only writes create rows). The response is the
 * single source of truth for client-side usage display.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const usage = await getUsage(session.user.id);
    return Response.json({
      month: currentMonthKey(),
      ...usage,
    });
  } catch (err) {
    console.error("[API] GET /api/usage error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
