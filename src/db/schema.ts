import {
  pgTable,
  text,
  timestamp,
  jsonb,
  varchar,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ── Users ──
// Uses text IDs to accept NextAuth-generated user IDs (not always UUIDs)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  hasOnboarded: boolean("has_onboarded").default(false).notNull(),
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
