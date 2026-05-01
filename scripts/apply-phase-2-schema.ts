/**
 * Idempotent schema application for Phase 2.
 *
 * Applies all the schema changes from src/db/schema.ts directly via
 * Neon HTTP — bypassing drizzle-kit's interactive prompts. Safe to
 * re-run.
 *
 * - Adds users.plan, users.pro_until, users.gateway_*, users.plan_renews_at
 * - Drops project_diagrams (Phase 1 cleanup)
 * - Creates usage, files, artifact_snapshots, migration_logs
 * - Adds all required indexes
 *
 * Run: npx tsx scripts/apply-phase-2-schema.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const sql = neon(url);

  console.log("[schema] Applying Phase 2 schema (idempotent)...");

  // ── Drop legacy diagrams table (Phase 1 cleanup) ──
  console.log("[schema] Dropping project_diagrams (if exists)...");
  await sql`DROP TABLE IF EXISTS "project_diagrams"`;

  // ── users: add plan, pro_until, gateway fields ──
  console.log("[schema] Extending users table...");
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" varchar(20) NOT NULL DEFAULT 'free'`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pro_until" timestamp`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gateway_customer_id" varchar(100)`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gateway_subscription_id" varchar(100)`;
  await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_renews_at" timestamp`;

  // ── usage table ──
  console.log("[schema] Creating usage table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "usage" (
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "month" varchar(7) NOT NULL,
      "ai_messages" integer NOT NULL DEFAULT 0,
      "file_uploads" integer NOT NULL DEFAULT 0,
      "storage_bytes" bigint NOT NULL DEFAULT 0,
      "updated_at" timestamp NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("user_id", "month")
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "usage_user_idx" ON "usage" ("user_id")`;

  // ── files table ──
  console.log("[schema] Creating files table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "files" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "project_id" text REFERENCES "projects"("id") ON DELETE CASCADE,
      "message_id" text REFERENCES "messages"("id") ON DELETE SET NULL,
      "blob_url" varchar(500) NOT NULL,
      "original_name" varchar(500) NOT NULL,
      "mime_type" varchar(100) NOT NULL,
      "bytes" bigint NOT NULL,
      "extracted_text_length" integer NOT NULL DEFAULT 0,
      "share_token" varchar(32) UNIQUE,
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "deleted_at" timestamp
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "files_user_idx" ON "files" ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "files_project_idx" ON "files" ("project_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "files_message_idx" ON "files" ("message_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "files_share_token_idx" ON "files" ("share_token")`;

  // ── artifact_snapshots table ──
  console.log("[schema] Creating artifact_snapshots table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "artifact_snapshots" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "artifact_type" varchar(20) NOT NULL,
      "artifact_id" text NOT NULL,
      "label" varchar(100),
      "content" jsonb NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "snap_artifact_idx" ON "artifact_snapshots" ("artifact_type", "artifact_id", "created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "snap_user_idx" ON "artifact_snapshots" ("user_id", "created_at")`;

  // ── migration_logs table ──
  console.log("[schema] Creating migration_logs table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "migration_logs" (
      "id" text PRIMARY KEY,
      "name" varchar(100) NOT NULL,
      "notes" text,
      "artifact_url" varchar(500),
      "run_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;

  console.log("[schema] All Phase 2 schema applied.");
}

main().catch((err) => {
  console.error("[schema] Failed:", err);
  process.exit(1);
});
