import {
  pgTable,
  text,
  timestamp,
  jsonb,
  varchar,
  boolean,
  bigint,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Users ──
// Uses text IDs to accept NextAuth-generated user IDs (not always UUIDs)
//
// Plan resolution: effective plan is "pro" when plan === 'pro' OR
// proUntil > now(). proUntil is the founding-member / promo override.
// gateway* fields are populated only after a real payment gateway is
// wired (Paddle / Lemon Squeezy / Razorpay — chosen post-launch).
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Bumped on password reset/change and "log out everywhere"; the JWT carries
  // the value it was minted with, and a stale value invalidates the session.
  tokenVersion: integer("token_version").notNull().default(0),
  hasOnboarded: boolean("has_onboarded").default(false).notNull(),
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // "free" | "pro"
  proUntil: timestamp("pro_until"), // nullable — promo / founding-member grace
  gatewayCustomerId: varchar("gateway_customer_id", { length: 100 }),
  gatewaySubscriptionId: varchar("gateway_subscription_id", { length: 100 }),
  planRenewsAt: timestamp("plan_renews_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Projects ──
// Uses text IDs to accept client-generated nanoid values
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull().default("New Project"),
    description: text("description"),
    projectType: varchar("project_type", { length: 50 }),
    memory: jsonb("memory").$type<{
      tone?: string;
      audience?: string;
      goals?: string;
      customInstructions?: string;
    }>().default({}),
    // ── Project context (front matter) — the ONE source the home header,
    // the Brain, and Settings → Context-for-AI all read from. Do not fork
    // this into separate stores (PRD §9.3 coherence rule).
    purpose: text("purpose"), // 1–2 sentence "what this project is + its goal"
    audience: text("audience"),
    voice: text("voice"), // voice / tone for the AI
    keyFacts: text("key_facts"),
    client: varchar("client", { length: 255 }), // agency projects
    timeline: varchar("timeline", { length: 255 }), // due date / timeframe (free text)
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | archived
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_share_token_idx").on(table.shareToken),
  ]
);

// ── Folders (in-project grouping for the Workspaces tree + board) ──
//
// Optional one-level grouping of entities inside a project. Entities carry a
// nullable folderId (set null on folder delete, so entities survive as
// "Unfiled"). position drives manual ordering in the sidebar/board.
export const folders = pgTable(
  "folders",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull().default("New Folder"),
    color: varchar("color", { length: 20 }).notNull().default("#FFB43F"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("folders_project_id_idx").on(table.projectId)]
);

// ── Knowledge Units (Documents) ──
export const knowledgeUnits = pgTable(
  "knowledge_units",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull().default("Untitled Document"),
    content: text("content").notNull().default(""),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("ku_project_id_idx").on(table.projectId),
    index("ku_share_token_idx").on(table.shareToken),
  ]
);

// ── Project Tables (Spreadsheets) ──
export const projectTables = pgTable(
  "project_tables",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull().default("Untitled Table"),
    sheets: jsonb("sheets").notNull().default([]),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pt_project_id_idx").on(table.projectId),
    index("pt_share_token_idx").on(table.shareToken),
  ]
);

// ── Project Decks (Presentations) ──
export const projectDecks = pgTable(
  "project_decks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull().default("Untitled Deck"),
    theme: varchar("theme", { length: 20 }).notNull().default("light"),
    style: jsonb("style"),
    slides: jsonb("slides").notNull().default([]),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pdk_project_id_idx").on(table.projectId),
    index("pdk_share_token_idx").on(table.shareToken),
  ]
);

// ── Project Pages (HTML visual documents) ──
//
// A first-class entity (mirrors decks/sheets) for AI-generated, fully
// editable HTML documents — a doc turned into a visual, well-organized,
// interactive page. `html` is the full standalone markup; `editableFields`
// declares the regions the AI marked editable; `sourceKuId` links back to
// the document this page was visualized from (nullable).
export const projectPages = pgTable(
  "project_pages",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull().default("Untitled Page"),
    html: text("html").notNull().default(""),
    editableFields: jsonb("editable_fields").$type<unknown[]>().default([]),
    sourceKuId: text("source_ku_id"), // optional: the doc this was visualized from
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pp_project_id_idx").on(table.projectId),
    index("pp_share_token_idx").on(table.shareToken),
  ]
);

// ── Password Reset Tokens ──
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("prt_user_id_idx").on(table.userId)]
);

// ── Login throttle (brute-force / credential-stuffing protection) ──
// Durable, cross-instance (the in-memory limiter doesn't survive serverless).
// `key` is "email:<addr>" or "ip:<addr>". Rows are short-lived and cleared on
// a successful login.
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  fails: integer("fails").notNull().default(0),
  firstFailAt: timestamp("first_fail_at").notNull().defaultNow(),
  lockedUntil: timestamp("locked_until"),
});

// ── Messages (Chat history per project) ──
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    attachments: jsonb("attachments").$type<any[]>().default([]),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [index("msg_project_id_idx").on(table.projectId)]
);

// ── Usage (per-user, per-month metering) ──
//
// One row per (userId, month) combination. month format: "2026-05".
// Increments are atomic via INSERT ... ON CONFLICT DO UPDATE in
// src/lib/billing/usage.ts. No "reset" job needed — month key advances
// naturally; old rows stay for historical analytics.
export const usage = pgTable(
  "usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: varchar("month", { length: 7 }).notNull(), // "YYYY-MM"
    aiMessages: integer("ai_messages").notNull().default(0),
    fileUploads: integer("file_uploads").notNull().default(0),
    storageBytes: bigint("storage_bytes", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.month] }),
    index("usage_user_idx").on(table.userId),
  ]
);

// ── Files (workspace + chat uploads) ──
//
// Source of truth for storage usage and orphan recovery. /api/upload
// writes a row in the same transaction as the Vercel Blob upload —
// failures roll back both. messageId / projectId are nullable to
// support workspace-scope and loose attachments respectively.
//
// Storage usage = SUM(bytes) WHERE userId = ? AND deletedAt IS NULL.
export const files = pgTable(
  "files",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    blobUrl: varchar("blob_url", { length: 500 }).notNull(),
    originalName: varchar("original_name", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    extractedTextLength: integer("extracted_text_length").notNull().default(0),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // soft delete for orphan recovery
  },
  (table) => [
    index("files_user_idx").on(table.userId),
    index("files_project_idx").on(table.projectId),
    index("files_message_idx").on(table.messageId),
    index("files_share_token_idx").on(table.shareToken),
  ]
);

// ── Artifact Snapshots (version history per artifact) ──
//
// Plan-aware retention: 5 free / 20 pro per artifact. Pruned weekly
// by /api/cron/prune-snapshots. content holds the full artifact state
// at snapshot time (jsonb — Postgres TOAST'd compression handles bulk).
export const artifactSnapshots = pgTable(
  "artifact_snapshots",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artifactType: varchar("artifact_type", { length: 20 }).notNull(), // "ku" | "table" | "deck"
    artifactId: text("artifact_id").notNull(),
    label: varchar("label", { length: 100 }), // "after AI edit", "manual save", etc.
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("snap_artifact_idx").on(table.artifactType, table.artifactId, table.createdAt),
    index("snap_user_idx").on(table.userId, table.createdAt),
  ]
);

// ── Project Members (team access control — the backbone) ──
//
// Replaces the implicit single-owner model. Every project read/write
// authorizes against this table (see src/lib/auth/projectAccess.ts).
// The legacy projects.userId pointer is kept as the creator reference and
// is treated as an implicit "owner" until backfill creates explicit rows.
// roles: owner | editor | commenter | viewer (ranked in projectAccess.ts).
export const projectMembers = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("editor"),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | pending | removed
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_members_project_user_idx").on(table.projectId, table.userId),
    index("project_members_user_idx").on(table.userId),
    index("project_members_project_idx").on(table.projectId),
  ]
);

// ── Share Links (view/edit convenience layer atop membership) ──
//
// Generalizes the legacy projects.shareToken into named, scoped, expirable
// links. entityId null = whole-project link. permission view | edit.
export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entityId: text("entity_id"), // null = whole-project link
    entityType: varchar("entity_type", { length: 20 }), // ku | table | deck | page
    token: varchar("token", { length: 32 }).notNull().unique(),
    permission: varchar("permission", { length: 10 }).notNull().default("view"), // view | edit
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("share_links_token_idx").on(table.token),
    index("share_links_project_idx").on(table.projectId),
  ]
);

// ── Activity Events (project activity feed) ──
//
// Append-only stream powering the project-home recent-activity strip and
// team accountability. verb: created | edited | deleted | invited |
// shared | commented | joined ... entity* nullable for project-level events.
export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    verb: varchar("verb", { length: 40 }).notNull(),
    entityId: text("entity_id"),
    entityType: varchar("entity_type", { length: 20 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("activity_project_idx").on(table.projectId, table.createdAt)]
);

// ── Migration Logs (audit trail for one-off scripts) ──
//
// Used by archive-diagrams.ts, founding-member grace migration, and
// future one-off operations to keep an auditable record of what ran,
// when, against what user set, and where any artifacts (blob archives)
// were stored.
export const migrationLogs = pgTable(
  "migration_logs",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    notes: text("notes"),
    artifactUrl: varchar("artifact_url", { length: 500 }),
    runAt: timestamp("run_at").defaultNow().notNull(),
  }
);
