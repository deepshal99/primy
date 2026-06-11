import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, files, organizations, orgMembers } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { del } from "@vercel/blob";
import { log } from "@/lib/log";

/**
 * POST /api/user/delete — permanent account deletion (right-to-be-forgotten).
 *
 * Body: { confirm: "DELETE" } — explicit, typed confirmation.
 *
 * Refuses while the user OWNS an org that still has other members (transfer
 * or delete the org first — silently dissolving a team underneath its
 * members is worse than asking). Otherwise: uploaded blobs are deleted
 * best-effort, then the user row — every FK cascades (projects, entities,
 * messages, files, memberships, tokens, usage).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: { confirm?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (body.confirm !== "DELETE") {
      return Response.json({ error: 'Confirmation required. Send { "confirm": "DELETE" }.' }, { status: 400 });
    }

    // Owned org with other active members → must transfer or delete it first.
    const ownedOrgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    for (const org of ownedOrgs) {
      const [otherMember] = await db
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, org.id), ne(orgMembers.userId, userId)))
        .limit(1);
      if (otherMember) {
        return Response.json(
          { error: `You own the team "${org.name}" which still has members. Transfer ownership or delete the team first.` },
          { status: 409 }
        );
      }
    }

    // Blob objects don't cascade with DB rows — delete them first, best-effort.
    const userFiles = await db.select({ blobUrl: files.blobUrl }).from(files).where(eq(files.userId, userId));
    if (userFiles.length > 0) {
      try {
        await del(userFiles.map((f) => f.blobUrl));
      } catch (blobErr) {
        log.warn("user.delete", "blob cleanup failed (continuing with account deletion)", {
          userId,
          err: blobErr instanceof Error ? blobErr.message : String(blobErr),
        });
      }
    }

    await db.delete(users).where(eq(users.id, userId));
    log.info("user.delete", "account deleted", { userId });
    return Response.json({ success: true });
  } catch (error) {
    log.error("user.delete", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
