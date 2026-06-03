/**
 * Idempotent: create the email_codes table (passwordless login codes).
 * Run: DATABASE_URL=<target> npx tsx scripts/apply-email-codes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { nanoid } from "nanoid";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  await sql`CREATE TABLE IF NOT EXISTS email_codes (
    email text PRIMARY KEY,
    code_hash text NOT NULL,
    expires_at timestamp NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO migration_logs (id, name, notes) VALUES (${nanoid()}, ${"email-codes"}, ${"passwordless login codes table"})`;
  console.log("[email-codes] done.");
}

main().catch((e) => {
  console.error("[email-codes] failed:", e);
  process.exit(1);
});
