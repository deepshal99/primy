import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Ensure the authenticated user has a row in the users table.
 * Handles the case where the DB was reset but the browser
 * still holds a valid JWT from a previous session.
 */
export async function ensureUserExists(session: {
  user: { id: string; name?: string | null; email?: string | null };
}) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (existing.length === 0) {
    await db
      .insert(users)
      .values({
        id: session.user.id,
        name: session.user.name || session.user.email?.split("@")[0] || "User",
        email: session.user.email || `${session.user.id}@placeholder.local`,
        passwordHash: "MIGRATED_SESSION",
      })
      .onConflictDoNothing();
  }
}
