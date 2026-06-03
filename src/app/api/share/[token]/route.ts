import { db } from "@/db";
import { projects, knowledgeUnits, projectTables, projectDecks, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rateLimit";
import { effectivePlan } from "@/lib/billing";
import type { Plan } from "@/lib/plans";

/**
 * GET /api/share/[token] — Public endpoint (no auth).
 * Looks up the share token across projects, KUs, tables, and decks.
 *
 * Returns `ownerEffectivePlan` ("free" | "pro") so the share viewer
 * can render the "Built with Primy" watermark for free-tier owners
 * and serve a clean canvas for pro owners.
 *
 * Single indexed lookup — no caching layer per eng-review decision #7
 * (KISS, premature caching avoided). The owner's userId is already on
 * the project row; one extra `users` SELECT keyed by primary key is
 * cheap and consistent with current load.
 */

async function resolveOwnerPlan(userId: string): Promise<Plan> {
  // Single indexed lookup — no caching layer per eng-review decision #7
  // (KISS, premature caching avoided).
  const [user] = await db
    .select({ plan: users.plan, proUntil: users.proUntil })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return "free";
  return effectivePlan({ plan: user.plan, proUntil: user.proUntil });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 8) {
      return Response.json({ error: "Invalid token" }, { status: 400 });
    }

    // IP-based rate limiting to prevent token enumeration (60 req/min)
    // Use x-real-ip (set by Vercel) or last entry of x-forwarded-for (proxy-appended, not client-controlled)
    const ip = _req.headers.get("x-real-ip") || _req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
    const rateLimit = checkRateLimit(`${ip}:share`, 60, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    // 1. Check projects
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.shareToken, token), isNull(projects.deletedAt)))
      .limit(1);

    if (project) {
      const ownerEffectivePlan = await resolveOwnerPlan(project.userId);
      const [kus, tables, decks] = await Promise.all([
        db
          .select({
            id: knowledgeUnits.id,
            title: knowledgeUnits.title,
            content: knowledgeUnits.content,
            createdAt: knowledgeUnits.createdAt,
            updatedAt: knowledgeUnits.updatedAt,
          })
          .from(knowledgeUnits)
          .where(and(eq(knowledgeUnits.projectId, project.id), isNull(knowledgeUnits.deletedAt))),
        db
          .select({
            id: projectTables.id,
            title: projectTables.title,
            sheets: projectTables.sheets,
            createdAt: projectTables.createdAt,
            updatedAt: projectTables.updatedAt,
          })
          .from(projectTables)
          .where(and(eq(projectTables.projectId, project.id), isNull(projectTables.deletedAt))),
        db
          .select({
            id: projectDecks.id,
            title: projectDecks.title,
            theme: projectDecks.theme,
            style: projectDecks.style,
            slides: projectDecks.slides,
            createdAt: projectDecks.createdAt,
            updatedAt: projectDecks.updatedAt,
          })
          .from(projectDecks)
          .where(and(eq(projectDecks.projectId, project.id), isNull(projectDecks.deletedAt))),
      ]);

      return Response.json({
        type: "project",
        title: project.title,
        description: project.description,
        documents: kus,
        tables,
        decks,
        ownerEffectivePlan,
      });
    }

    // 2. Check knowledge units
    const [ku] = await db
      .select({
        id: knowledgeUnits.id,
        title: knowledgeUnits.title,
        content: knowledgeUnits.content,
        projectId: knowledgeUnits.projectId,
        createdAt: knowledgeUnits.createdAt,
        updatedAt: knowledgeUnits.updatedAt,
      })
      .from(knowledgeUnits)
      .where(and(eq(knowledgeUnits.shareToken, token), isNull(knowledgeUnits.deletedAt)))
      .limit(1);

    if (ku) {
      const [proj] = await db
        .select({ title: projects.title, userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, ku.projectId))
        .limit(1);

      const ownerEffectivePlan: Plan = proj
        ? await resolveOwnerPlan(proj.userId)
        : "free";

      return Response.json({
        type: "document",
        title: ku.title,
        content: ku.content,
        projectTitle: proj?.title || "",
        ownerEffectivePlan,
      });
    }

    // 3. Check tables
    const [table] = await db
      .select({
        id: projectTables.id,
        title: projectTables.title,
        sheets: projectTables.sheets,
        projectId: projectTables.projectId,
        createdAt: projectTables.createdAt,
        updatedAt: projectTables.updatedAt,
      })
      .from(projectTables)
      .where(and(eq(projectTables.shareToken, token), isNull(projectTables.deletedAt)))
      .limit(1);

    if (table) {
      const [proj] = await db
        .select({ title: projects.title, userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, table.projectId))
        .limit(1);

      const ownerEffectivePlan: Plan = proj
        ? await resolveOwnerPlan(proj.userId)
        : "free";

      return Response.json({
        type: "table",
        title: table.title,
        sheets: table.sheets,
        projectTitle: proj?.title || "",
        ownerEffectivePlan,
      });
    }

    // 4. Check decks
    const [deck] = await db
      .select({
        id: projectDecks.id,
        title: projectDecks.title,
        theme: projectDecks.theme,
        style: projectDecks.style,
        slides: projectDecks.slides,
        projectId: projectDecks.projectId,
        createdAt: projectDecks.createdAt,
        updatedAt: projectDecks.updatedAt,
      })
      .from(projectDecks)
      .where(and(eq(projectDecks.shareToken, token), isNull(projectDecks.deletedAt)))
      .limit(1);

    if (deck) {
      const [proj] = await db
        .select({ title: projects.title, userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, deck.projectId))
        .limit(1);

      const ownerEffectivePlan: Plan = proj
        ? await resolveOwnerPlan(proj.userId)
        : "free";

      return Response.json({
        type: "deck",
        title: deck.title,
        slides: deck.slides,
        theme: deck.theme,
        style: deck.style || null,
        projectTitle: proj?.title || "",
        ownerEffectivePlan,
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("[API] GET /api/share/[token] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
