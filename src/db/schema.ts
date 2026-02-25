import {
  pgTable,
  text,
  timestamp,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";

// ── Users ──
// Uses text IDs to accept NextAuth-generated user IDs (not always UUIDs)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
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
  (table) => [index("projects_user_id_idx").on(table.userId)]
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
  (table) => [index("ku_project_id_idx").on(table.projectId)]
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
  (table) => [index("pt_project_id_idx").on(table.projectId)]
);

// ── Project Diagrams ──
export const projectDiagrams = pgTable(
  "project_diagrams",
  {
    id: text("id").primaryKey(), // client-provided nanoid
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull().default("Untitled Diagram"),
    diagramType: varchar("diagram_type", { length: 20 }).notNull().default("mermaid"), // "mermaid" | "chart"
    source: text("source").notNull().default(""),
    shareToken: varchar("share_token", { length: 32 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("pd_project_id_idx").on(table.projectId)]
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
