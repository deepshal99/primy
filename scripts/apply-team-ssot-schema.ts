/**
 * Idempotent schema application + backfill for the Team-SSOT rebranding
 * (Phase 1 foundation).
 *
 * Applies the new collaboration schema from src/db/schema.ts directly via
 * Neon HTTP — bypassing drizzle-kit's interactive prompts. Safe to re-run.
 *
 * - Adds projects.purpose / audience / voice / key_facts / client /
 *   timeline / status (project front-matter context store)
 * - Creates project_members, share_links, activity_events + indexes
 * - Backfills one owner project_members row per existing project from the
 *   legacy projects.user_id pointer (idempotent via unique index)
 * - Writes a migration_logs audit row
 *
 * Run: npx tsx scripts/apply-team-ssot-schema.ts
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

  console.log("[ssot] Applying Team-SSOT schema (idempotent)...");

  // ── projects: add front-matter context columns ──
  console.log("[ssot] Extending projects with context columns...");
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "purpose" text`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "audience" text`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "voice" text`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "key_facts" text`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client" varchar(255)`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "timeline" varchar(255)`;
  await sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active'`;

  // ── project_members table (access-control backbone) ──
  console.log("[ssot] Creating project_members table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "project_members" (
      "id" text PRIMARY KEY,
      "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role" varchar(20) NOT NULL DEFAULT 'editor',
      "invited_by" text REFERENCES "users"("id") ON DELETE SET NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "project_members_project_user_idx" ON "project_members" ("project_id", "user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "project_members_user_idx" ON "project_members" ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "project_members_project_idx" ON "project_members" ("project_id")`;

  // ── share_links table ──
  console.log("[ssot] Creating share_links table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "share_links" (
      "id" text PRIMARY KEY,
      "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "entity_id" text,
      "entity_type" varchar(20),
      "token" varchar(32) NOT NULL UNIQUE,
      "permission" varchar(10) NOT NULL DEFAULT 'view',
      "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
      "expires_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "share_links_token_idx" ON "share_links" ("token")`;
  await sql`CREATE INDEX IF NOT EXISTS "share_links_project_idx" ON "share_links" ("project_id")`;

  // ── activity_events table ──
  console.log("[ssot] Creating activity_events table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "activity_events" (
      "id" text PRIMARY KEY,
      "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
      "verb" varchar(40) NOT NULL,
      "entity_id" text,
      "entity_type" varchar(20),
      "meta" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "activity_project_idx" ON "activity_events" ("project_id", "created_at")`;

  // ── project_pages table (HTML visual documents) ──
  console.log("[ssot] Creating project_pages table...");
  await sql`
    CREATE TABLE IF NOT EXISTS "project_pages" (
      "id" text PRIMARY KEY,
      "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "title" varchar(500) NOT NULL DEFAULT 'Untitled Page',
      "html" text NOT NULL DEFAULT '',
      "editable_fields" jsonb DEFAULT '[]'::jsonb,
      "source_ku_id" text,
      "share_token" varchar(32) UNIQUE,
      "created_at" timestamp NOT NULL DEFAULT NOW(),
      "updated_at" timestamp NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "pp_project_id_idx" ON "project_pages" ("project_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "pp_share_token_idx" ON "project_pages" ("share_token")`;

  // ── Backfill: one owner membership per existing project ──
  // Idempotent — the unique (project_id, user_id) index makes re-runs no-ops.
  console.log("[ssot] Backfilling owner memberships...");
  const backfilled = await sql`
    INSERT INTO "project_members" ("id", "project_id", "user_id", "role", "status")
    SELECT gen_random_uuid()::text, p."id", p."user_id", 'owner', 'active'
    FROM "projects" p
    ON CONFLICT ("project_id", "user_id") DO NOTHING
    RETURNING "id"
  `;
  console.log(`[ssot] Backfill inserted ${backfilled.length} owner rows.`);

  // ── Audit log ──
  await sql`
    INSERT INTO "migration_logs" ("id", "name", "notes")
    VALUES (
      gen_random_uuid()::text,
      'team-ssot-schema',
      ${`Created project_members/share_links/activity_events + project context columns. Backfilled ${backfilled.length} owner memberships.`}
    )
  `;

  console.log("[ssot] Team-SSOT schema + backfill complete.");
}

main().catch((err) => {
  console.error("[ssot] Failed:", err);
  process.exit(1);
});
