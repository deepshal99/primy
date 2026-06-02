import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/user/logout-all — revoke every session for the current user by
 * bumping tokenVersion. The caller should sign out + redirect afterwards (its
 * own session is included). Within ~30s every other device is logged out.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, session.user.id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/user/logout-all error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
