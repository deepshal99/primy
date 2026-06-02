/**
 * Idempotent schema application for Phase 0 (multi-tenant foundation).
 *
 * Applies the org/visibility/soft-delete/token-log additions directly via
 * Neon HTTP — matching the existing apply-team-ssot-schema.ts pattern and
 * sidestepping drizzle-kit baseline complexity on the already-push'd DB.
 * Safe to re-run (every statement is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *
 * Adds:
 *  - users.is_super_admin
 *  - projects.visibility / org_id / archived_at / deleted_at (+ indexes)
 *  - deleted_at on folders / knowledge_units / project_tables /
 *    project_decks / project_pages
 *  - organizations, org_members, token_usage_log (+ indexes)
 *  - a migration_logs audit row
 *
 * Run: DATABASE_URL=<target> npx tsx scripts/apply-phase-0-orgs.ts
 * (Run against a Neon branch first; verify; then prod.)
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

  console.log("[phase0] applying org/visibility/soft-delete/token-log schema ...");

  // ── users ──
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false`;

  // ── projects ──
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility varchar(10) NOT NULL DEFAULT 'private'`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id text`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamp`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  await sql`CREATE INDEX IF NOT EXISTS projects_org_id_idx ON projects (org_id)`;
  await sql`CREATE INDEX IF NOT EXISTS projects_visibility_idx ON projects (visibility)`;

  // ── soft-delete on entity tables + folders ──
  await sql`ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  await sql`ALTER TABLE knowledge_units ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  await sql`ALTER TABLE project_tables ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  await sql`ALTER TABLE project_decks ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  await sql`ALTER TABLE project_pages ADD COLUMN IF NOT EXISTS deleted_at timestamp`;

  // ── organizations ──
  await sql`CREATE TABLE IF NOT EXISTS organizations (
    id text PRIMARY KEY,
    name varchar(200) NOT NULL,
    slug varchar(100) NOT NULL UNIQUE,
    plan varchar(20) NOT NULL DEFAULT 'free',
    pro_until timestamp,
    owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS orgs_owner_idx ON organizations (owner_id)`;

  // ── org_members ──
  await sql`CREATE TABLE IF NOT EXISTS org_members (
    id text PRIMARY KEY,
    org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role varchar(20) NOT NULL DEFAULT 'member',
    status varchar(20) NOT NULL DEFAULT 'active',
    invited_by text REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS org_members_org_user_idx ON org_members (org_id, user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS org_members_user_idx ON org_members (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS org_members_org_idx ON org_members (org_id)`;

  // ── token_usage_log ──
  await sql`CREATE TABLE IF NOT EXISTS token_usage_log (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id text,
    task varchar(40) NOT NULL,
    model varchar(60) NOT NULL,
    input_tokens integer NOT NULL DEFAULT 0,
    output_tokens integer NOT NULL DEFAULT 0,
    est_cost_cents integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS token_log_user_idx ON token_usage_log (user_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS token_log_org_idx ON token_usage_log (org_id, created_at)`;

  // ── audit row ──
  await sql`INSERT INTO migration_logs (id, name, notes) VALUES (${nanoid()}, ${"phase-0-orgs"}, ${"orgs + org_members + token_usage_log + project visibility/soft-delete columns"})`;

  console.log("[phase0] done.");
}

main().catch((e) => {
  console.error("[phase0] failed:", e);
  process.exit(1);
});
