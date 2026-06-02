import { auth } from "@/lib/auth";
import { createOrg, getOrgForUser, orgErrorResponse } from "@/lib/org/orgService";

/**
 * Organizations (collection).
 *   GET  /api/orgs   — the caller's org summary (or { org: null })
 *   POST /api/orgs   — create an org and become its owner (one org per user)
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getOrgForUser(userId);
    return Response.json({ org });
  } catch (error) {
    console.error("[API] GET /api/orgs error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireSession();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { name?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const org = await createOrg(userId, body.name ?? "");
      return Response.json({ org });
    } catch (e) {
      const res = orgErrorResponse(e);
      if (res) return res;
      throw e;
    }
  } catch (error) {
    console.error("[API] POST /api/orgs error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
