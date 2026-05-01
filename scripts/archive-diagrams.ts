/**
 * One-off archival script: dumps the contents of the project_diagrams table
 * to a timestamped JSON file under .archive/ before the table is dropped.
 *
 * Usage:
 *   npx tsx scripts/archive-diagrams.ts
 *
 * Behaviour:
 *   - Reads all rows from project_diagrams
 *   - Writes them to .archive/diagrams-{ISO-timestamp}.json (gitignored)
 *   - Logs the count to console
 *   - Exits cleanly (with no error) if the table does not exist or is empty
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(url);

  // Check whether the table exists before reading from it. This keeps the
  // script idempotent — if it has already been run and the table has been
  // dropped, we exit cleanly instead of throwing.
  const existsRows = (await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'project_diagrams'
    ) AS exists
  `) as Array<{ exists: boolean }>;

  const tableExists = existsRows[0]?.exists ?? false;
  if (!tableExists) {
    console.log("No diagrams to archive (table project_diagrams does not exist).");
    return;
  }

  const rows = (await sql`SELECT * FROM project_diagrams`) as unknown[];

  if (!rows.length) {
    console.log("No diagrams to archive (table is empty).");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = resolve(process.cwd(), ".archive");
  const outPath = resolve(archiveDir, `diagrams-${timestamp}.json`);

  await mkdir(archiveDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(rows, null, 2), "utf8");

  console.log(`Archived ${rows.length} diagram row(s) to ${outPath}`);
}

main().catch((err) => {
  console.error("[archive-diagrams] Failed:", err);
  process.exit(1);
});
