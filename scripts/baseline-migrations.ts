/**
 * One-off: mark ALL currently-present migration files as already-applied,
 * WITHOUT running their SQL — for a DB that already has the schema (built
 * via the old raw scripts). After this, `npm run db:migrate` only runs
 * genuinely new migrations.
 *
 * Run ONCE per existing DB (prod + any long-lived branch):
 *   DATABASE_URL=<target> npx tsx scripts/baseline-migrations.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`;

  const dir = "./drizzle";
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    const existing = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`;
    if (existing.length) {
      console.log(`[baseline] already marked: ${f}`);
      continue;
    }
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
    console.log(`[baseline] marked applied (no SQL run): ${f}`);
  }
  console.log("[baseline] done.");
}

main().catch((e) => {
  console.error("[baseline] failed:", e);
  process.exit(1);
});
