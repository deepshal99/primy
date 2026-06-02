/**
 * Apply pending drizzle migrations in order, idempotently.
 * Records applied migrations in the drizzle.__drizzle_migrations journal.
 * Run: npm run db:migrate   (uses DATABASE_URL from .env.local / env)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle({ client: neon(url) });
  console.log("[db:migrate] applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[db:migrate] done.");
}

main().catch((e) => {
  console.error("[db:migrate] failed:", e);
  process.exit(1);
});
