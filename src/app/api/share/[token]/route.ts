import { db } from "@/db";
import { projects, knowledgeUnits, projectTables, projectDiagrams, projectDecks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/share/[token] — Public endpoint (no auth).
 * Looks up the share token across projects, KUs, tables, and diagrams.
 */

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
      .where(eq(projects.shareToken, token))
      .limit(1);

    if (project) {
      const [kus, tables, diagrams, decks] = await Promise.all([
        db
          .select({
            id: knowledgeUnits.id,
            title: knowledgeUnits.title,
            content: knowledgeUnits.content,
            createdAt: knowledgeUnits.createdAt,
            updatedAt: knowledgeUnits.updatedAt,
          })
          .from(knowledgeUnits)
          .where(eq(knowledgeUnits.projectId, project.id)),
        db
          .select({
            id: projectTables.id,
            title: projectTables.title,
            sheets: projectTables.sheets,
            createdAt: projectTables.createdAt,
            updatedAt: projectTables.updatedAt,
          })
          .from(projectTables)
          .where(eq(projectTables.projectId, project.id)),
        db
          .select({
            id: projectDiagrams.id,
            title: projectDiagrams.title,
            diagramType: projectDiagrams.diagramType,
            source: projectDiagrams.source,
            createdAt: projectDiagrams.createdAt,
            updatedAt: projectDiagrams.updatedAt,
          })
          .from(projectDiagrams)
          .where(eq(projectDiagrams.projectId, project.id)),
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
          .where(eq(projectDecks.projectId, project.id)),
      ]);

      return Response.json({
        type: "project",
        title: project.title,
        description: project.description,
        documents: kus,
        tables,
        diagrams,
        decks,
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
      .where(eq(knowledgeUnits.shareToken, token))
      .limit(1);

    if (ku) {
      const [proj] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, ku.projectId))
        .limit(1);

      return Response.json({
        type: "document",
        title: ku.title,
        content: ku.content,
        projectTitle: proj?.title || "",
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
      .where(eq(projectTables.shareToken, token))
      .limit(1);

    if (table) {
      const [proj] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, table.projectId))
        .limit(1);

      return Response.json({
        type: "table",
        title: table.title,
        sheets: table.sheets,
        projectTitle: proj?.title || "",
      });
    }

    // 4. Check diagrams
    const [diagram] = await db
      .select({
        id: projectDiagrams.id,
        title: projectDiagrams.title,
        diagramType: projectDiagrams.diagramType,
        source: projectDiagrams.source,
        projectId: projectDiagrams.projectId,
        createdAt: projectDiagrams.createdAt,
        updatedAt: projectDiagrams.updatedAt,
      })
      .from(projectDiagrams)
      .where(eq(projectDiagrams.shareToken, token))
      .limit(1);

    if (diagram) {
      const [proj] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, diagram.projectId))
        .limit(1);

      return Response.json({
        type: "diagram",
        title: diagram.title,
        diagramType: diagram.diagramType,
        source: diagram.source,
        projectTitle: proj?.title || "",
      });
    }

    // 5. Check decks
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
      .where(eq(projectDecks.shareToken, token))
      .limit(1);

    if (deck) {
      const [proj] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, deck.projectId))
        .limit(1);

      return Response.json({
        type: "deck",
        title: deck.title,
        slides: deck.slides,
        theme: deck.theme,
        style: deck.style || null,
        projectTitle: proj?.title || "",
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("[API] GET /api/share/[token] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
