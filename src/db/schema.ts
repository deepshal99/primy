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
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_share_token_idx").on(table.shareToken),
  ]
);

// ── Knowledge Units (Documents) ──
export const knowledgeUnits = pgTable(
  "knowledge_units",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
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
