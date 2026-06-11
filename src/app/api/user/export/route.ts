import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, projects, knowledgeUnits, projectTables, projectDecks, projectPages, messages, files } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { log } from "@/lib/log";

/**
 * GET /api/user/export — full personal data export (GDPR/data-portability).
 * Returns a single JSON download: profile + every project the user CREATED
 * (with docs, sheets, decks, pages, chat messages) + uploaded-file metadata.
 * Shared-but-not-owned workspaces are excluded — that data belongs to its
 * creator's export.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const [profile] = await db
      .select({ id: users.id, email: users.email, name: users.name, plan: users.plan, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

    const ownProjects = await db.select().from(projects).where(eq(projects.userId, userId));
    const projectIds = ownProjects.map((p) => p.id);

    const [kus, tables, decks, pages, msgs, uploads] = projectIds.length
      ? await Promise.all([
          db.select().from(knowledgeUnits).where(inArray(knowledgeUnits.projectId, projectIds)),
          db.select().from(projectTables).where(inArray(projectTables.projectId, projectIds)),
          db.select().from(projectDecks).where(inArray(projectDecks.projectId, projectIds)),
          db.select().from(projectPages).where(inArray(projectPages.projectId, projectIds)),
          db.select().from(messages).where(inArray(messages.projectId, projectIds)),
          db.select({ id: files.id, originalName: files.originalName, mimeType: files.mimeType, bytes: files.bytes, blobUrl: files.blobUrl, createdAt: files.createdAt }).from(files).where(eq(files.userId, userId)),
        ])
      : [[], [], [], [], [], []];

    const byProject = <T extends { projectId: string | null }>(rows: T[], id: string) =>
      rows.filter((r) => r.projectId === id);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile,
      projects: ownProjects.map((p) => ({
        ...p,
        documents: byProject(kus, p.id),
        sheets: byProject(tables, p.id),
        decks: byProject(decks, p.id),
        pages: byProject(pages, p.id),
        messages: byProject(msgs, p.id),
      })),
      uploadedFiles: uploads,
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="primy-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    log.error("user.export", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
