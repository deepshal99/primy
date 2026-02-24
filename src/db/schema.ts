import {
  pgTable,
  text,
  timestamp,
  jsonb,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

// ── Users ──
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Projects ──
// Uses text IDs to accept client-generated nanoid values
export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // client-provided nanoid
  userId: uuid("user_id")
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Knowledge Units (Documents) ──
export const knowledgeUnits = pgTable("knowledge_units", {
  id: text("id").primaryKey(), // client-provided nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull().default("Untitled Document"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Project Tables (Spreadsheets) ──
export const projectTables = pgTable("project_tables", {
  id: text("id").primaryKey(), // client-provided nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull().default("Untitled Table"),
  sheets: jsonb("sheets").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Messages (Chat history per project) ──
export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // client-provided nanoid
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<any[]>().default([]),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
