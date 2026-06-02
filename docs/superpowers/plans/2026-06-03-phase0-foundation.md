# Phase 0 — Foundation (Orgs + Access + Migrations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the data + logic foundation for the multi-tenant collaborative milestone: versioned migrations, an org/team tier, org-aware plan inheritance, and org-aware project access — without breaking existing single-user behavior.

**Architecture:** Add `organizations` + `orgMembers` tables and new columns to `users`/`projects` (+ soft-delete columns + `tokenUsageLog`). Resolve "company paid" through `effectivePlan` (pure) by feeding it the org's plan. Extend `projectAccess.ts` so a project shared `visibility='org'` is visible to that org's members, and so soft-deleted/archived projects drop out of listings. Ship all schema as **reviewed drizzle migrations**, baselined against the live DB so existing tables are not recreated.

**Tech Stack:** Next.js 16, Drizzle ORM (`drizzle-orm/neon-http`), drizzle-kit, Neon Postgres, Vitest. Tests mock `@/db` via a result queue (see `tests/lib/projectAccess.test.ts`).

**⚠️ Safety rule for this phase:** the migration baseline (Task 1) touches a **live prod DB**. Every migration command in Tasks 1, 5, 7 must be run **against a Neon branch / `DATABASE_URL_TEST` first** and verified before it ever points at prod. Never run an un-baselined `migrate` against production.

---

## File Structure

- `package.json` — add `db:generate`, `db:migrate`, `db:check` scripts. (modify)
- `scripts/migrate.ts` — programmatic migration runner using the neon-http migrator. (create)
- `scripts/baseline-migrations.ts` — one-off: mark the baseline migration as already-applied on an existing DB. (create)
- `src/db/schema.ts` — add `organizations`, `orgMembers`, `tokenUsageLog`; add columns to `users` + `projects` + entity tables. (modify)
- `src/lib/billing/effectivePlan.ts` — extend input with org plan; org-aware resolution. (modify)
- `tests/lib/billing/effectivePlan.test.ts` — new org-inheritance cases. (modify)
- `src/lib/org/orgAccess.ts` — `getUserOrg`, `getOrgPlanInput` helpers. (create)
- `tests/lib/org/orgAccess.test.ts` — unit tests (mocked db). (create)
- `src/lib/projectAccess.ts` — org-visibility clause in `getProjectAccess`; org + soft-delete/archive handling in `listAccessibleProjectIds`. (modify)
- `tests/lib/projectAccess.test.ts` — new org-visibility + soft-delete cases. (modify)
- `drizzle/*.sql` — generated migration files (committed, reviewed). (create, via tooling)

---

## Task 1: Versioned migration tooling + baseline

**Files:**
- Modify: `package.json:5-19` (scripts block)
- Create: `scripts/migrate.ts`
- Create: `scripts/baseline-migrations.ts`

- [ ] **Step 1: Add migration scripts to package.json**

Add these three lines to the `"scripts"` object (after `"lint:motion"`):

```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:check": "drizzle-kit check",
```

- [ ] **Step 2: Write the migration runner**

Create `scripts/migrate.ts`:

```ts
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
```

- [ ] **Step 3: Generate the baseline migration from the current schema**

The live DB already has every current table (applied via raw scripts). We generate a migration that *represents* the current schema, then mark it applied so it never re-runs on existing DBs.

Run: `npm run db:generate`
Expected: a new file like `drizzle/0001_<name>.sql` plus an updated `drizzle/meta/` snapshot. Review the SQL — it should contain `CREATE TABLE` statements for the **current** schema. Commit it as the baseline.

- [ ] **Step 4: Write the baseline marker (so existing DBs skip the baseline)**

Create `scripts/baseline-migrations.ts`:

```ts
/**
 * One-off: mark ALL currently-present migration files as already-applied,
 * WITHOUT running their SQL — for a DB that already has the schema (built
 * via the old raw scripts). After this, `npm run db:migrate` only runs
 * genuinely new migrations.
 *
 * Run ONCE per existing DB (prod + any long-lived branch):
 *   DATABASE_URL=<target> npx tsx scripts/baseline-migrations.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`;

  const dir = "./drizzle";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    const existing = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`;
    if (existing.length) {
      console.log(`[baseline] already marked: ${f}`);
      continue;
    }
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
    console.log(`[baseline] marked applied (no SQL run): ${f}`);
  }
  console.log("[baseline] done.");
}

main().catch((e) => {
  console.error("[baseline] failed:", e);
  process.exit(1);
});
```

> Note: drizzle's neon-http migrator hashes by file content (sha256). If a future drizzle-kit version changes the journal format, re-verify against `drizzle/meta/_journal.json`. The marker above is intentionally simple and idempotent.

- [ ] **Step 5: Verify baseline on a throwaway Neon branch**

On a **Neon branch clone** (NOT prod): run `DATABASE_URL=<branch-url> npx tsx scripts/baseline-migrations.ts`, then `DATABASE_URL=<branch-url> npm run db:migrate`.
Expected: baseline marks the existing migration(s) applied; `db:migrate` reports "no pending" (or applies only genuinely new ones). No `CREATE TABLE` errors for existing tables.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/migrate.ts scripts/baseline-migrations.ts drizzle/
git commit -m "build(db): versioned migrations (db:generate/db:migrate) + baseline marker"
```

---

## Task 2: Org-aware plan inheritance (pure logic, TDD)

**Files:**
- Modify: `src/lib/billing/effectivePlan.ts`
- Test: `tests/lib/billing/effectivePlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/billing/effectivePlan.test.ts` (inside the file, after the existing `effectivePlan` describe block):

```ts
describe("effectivePlan — org inheritance", () => {
  test("free user in a pro org → 'pro'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "pro", orgProUntil: null }, NOW)
    ).toBe("pro");
  });

  test("free user in a free org → 'free'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: null }, NOW)
    ).toBe("free");
  });

  test("free user, org on grace (orgProUntil future) → 'pro'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: FUTURE }, NOW)
    ).toBe("pro");
  });

  test("free user, org grace expired → 'free'", () => {
    expect(
      effectivePlan({ plan: "free", proUntil: null, orgPlan: "free", orgProUntil: PAST }, NOW)
    ).toBe("free");
  });

  test("no org fields (undefined) behaves exactly as before → 'free'", () => {
    expect(effectivePlan({ plan: "free", proUntil: null }, NOW)).toBe("free");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/billing/effectivePlan.test.ts`
Expected: the new "org inheritance" cases FAIL (org fields ignored / type error).

- [ ] **Step 3: Extend the input type and resolution**

In `src/lib/billing/effectivePlan.ts`, replace the `PlanResolutionInput` interface and the `effectivePlan` function with:

```ts
export interface PlanResolutionInput {
  /** Raw stored value: "free" | "pro" — anything else is treated as free. */
  plan: string;
  /** Grace-period override; "pro" while proUntil > now(). */
  proUntil: Date | null;
  /** The user's org plan, if they belong to one. "pro" grants pro to all members. */
  orgPlan?: string | null;
  /** Org grace-period override; "pro" while orgProUntil > now(). */
  orgProUntil?: Date | null;
}

/**
 * Resolves the effective plan for a user.
 *
 *   - "pro" if the user's own plan === "pro"      (personal real sub)
 *   - "pro" if the user's proUntil > now()        (personal grace)
 *   - "pro" if the user's org plan === "pro"      (company paid)
 *   - "pro" if the user's orgProUntil > now()     (org grace)
 *   - "free" otherwise (including malformed values)
 */
export function effectivePlan(input: PlanResolutionInput, now: Date = new Date()): Plan {
  if (input.plan === "pro") return "pro";
  if (input.proUntil instanceof Date && input.proUntil.getTime() > now.getTime()) {
    return "pro";
  }
  if (input.orgPlan === "pro") return "pro";
  if (input.orgProUntil instanceof Date && input.orgProUntil.getTime() > now.getTime()) {
    return "pro";
  }
  return "free";
}
```

(Leave `isOnGracePeriod` unchanged — personal grace only.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/billing/effectivePlan.test.ts`
Expected: PASS (all old + new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/effectivePlan.ts tests/lib/billing/effectivePlan.test.ts
git commit -m "feat(billing): org plan inheritance in effectivePlan (company-paid)"
```

---

## Task 3: Schema — orgs, members, super-admin, project visibility, soft-delete, token log

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the `isSuperAdmin` column to users**

In `src/db/schema.ts`, inside the `users` table definition, add after the `createdAt` line (line 36):

```ts
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
```

- [ ] **Step 2: Add visibility / org / lifecycle columns to projects**

In the `projects` table, add after the `status` line (line 66):

```ts
    visibility: varchar("visibility", { length: 10 }).notNull().default("private"), // private | org
    orgId: text("org_id"), // set when shared to an org (FK added below in indexes note)
    archivedAt: timestamp("archived_at"), // owner-archived; hidden from active board
    deletedAt: timestamp("deleted_at"), // soft delete -> Trash
```

And add to the `projects` index array (after the share-token index, line 73):

```ts
    index("projects_org_id_idx").on(table.orgId),
    index("projects_visibility_idx").on(table.visibility),
```

- [ ] **Step 3: Add `deletedAt` to entity tables + folders**

Add `deletedAt: timestamp("deleted_at"),` after the `updatedAt` line in each of: `folders`, `knowledgeUnits`, `projectTables`, `projectDecks`, `projectPages`.

```ts
    deletedAt: timestamp("deleted_at"), // soft delete -> Trash
```

- [ ] **Step 4: Add `organizations` and `orgMembers` tables**

Add at the end of `src/db/schema.ts` (after `migrationLogs`):

```ts
// ── Organizations (the company tier) ──
//
// A user belongs to at most one org (enforced in app logic + a unique index
// on active membership). The org's plan is inherited by all members via
// effectivePlan (orgPlan). ownerId is the creating user.
export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(), // nanoid
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | pro
    proUntil: timestamp("pro_until"), // org grace override
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("orgs_owner_idx").on(table.ownerId)]
);

// ── Org Members ──
// roles: owner | admin | member. One active membership per user (a partial
// unique index would be ideal; we enforce single-org in app logic and add a
// plain index here).
export const orgMembers = pgTable(
  "org_members",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"), // owner | admin | member
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | pending | removed
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("org_members_org_user_idx").on(table.orgId, table.userId),
    index("org_members_user_idx").on(table.userId),
    index("org_members_org_idx").on(table.orgId),
  ]
);

// ── Token Usage Log (AI cost telemetry) ──
//
// One row per AI call. Token counts come straight from the provider
// response. Powers /admin spend views and future usage-based billing.
export const tokenUsageLog = pgTable(
  "token_usage_log",
  {
    id: text("id").primaryKey(), // nanoid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id"), // nullable; the user's org at call time
    task: varchar("task", { length: 40 }).notNull(), // chat | deck-generate | ...
    model: varchar("model", { length: 60 }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estCostCents: integer("est_cost_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("token_log_user_idx").on(table.userId, table.createdAt),
    index("token_log_org_idx").on(table.orgId, table.createdAt),
  ]
);
```

- [ ] **Step 5: Typecheck the schema**

Run: `npx tsc --noEmit`
Expected: no type errors from `schema.ts`.

- [ ] **Step 6: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0002_<name>.sql` adding the new tables + `ALTER TABLE` for the new columns. **Review the SQL** — it must be only `CREATE TABLE organizations/org_members/token_usage_log` and `ADD COLUMN` statements; it must NOT drop or recreate existing tables.

- [ ] **Step 7: Apply on a Neon test branch + commit**

Run: `DATABASE_URL=<branch-url> npm run db:migrate`
Expected: applies cleanly.

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): organizations, org_members, token_usage_log + project visibility/soft-delete columns"
```

---

## Task 4: Org access helpers (TDD, mocked db)

**Files:**
- Create: `src/lib/org/orgAccess.ts`
- Test: `tests/lib/org/orgAccess.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/org/orgAccess.test.ts`:

```ts
/**
 * orgAccess — unit tests with a mocked db (queue pattern from projectAccess.test.ts).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

let queue: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const result = queue.length ? queue.shift() : [];
          const thenable = Promise.resolve(result);
          return Object.assign(thenable, { limit: async () => result });
        },
      }),
    }),
  },
}));

import { getUserOrg, getOrgPlanInput } from "@/lib/org/orgAccess";

beforeEach(() => {
  queue = [];
});

describe("getUserOrg", () => {
  test("returns the active org membership", async () => {
    queue = [[{ orgId: "o1", role: "member", status: "active" }]];
    const org = await getUserOrg("u1");
    expect(org).toEqual({ orgId: "o1", role: "member" });
  });

  test("no membership → null", async () => {
    queue = [[]];
    const org = await getUserOrg("u1");
    expect(org).toBeNull();
  });
});

describe("getOrgPlanInput", () => {
  test("returns org plan + proUntil for a member", async () => {
    queue = [
      [{ orgId: "o1", role: "member", status: "active" }], // getUserOrg
      [{ plan: "pro", proUntil: null }], // org row
    ];
    const input = await getOrgPlanInput("u1");
    expect(input).toEqual({ orgPlan: "pro", orgProUntil: null });
  });

  test("no org → empty inheritance object", async () => {
    queue = [[]]; // getUserOrg miss
    const input = await getOrgPlanInput("u1");
    expect(input).toEqual({ orgPlan: null, orgProUntil: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/org/orgAccess.test.ts`
Expected: FAIL ("Cannot find module '@/lib/org/orgAccess'").

- [ ] **Step 3: Implement the helpers**

Create `src/lib/org/orgAccess.ts`:

```ts
import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface UserOrg {
  orgId: string;
  role: string; // owner | admin | member
}

/** The user's single active org membership, or null. */
export async function getUserOrg(userId: string): Promise<UserOrg | null> {
  const [row] = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role, status: orgMembers.status })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, "active")))
    .limit(1);
  if (!row) return null;
  return { orgId: row.orgId, role: row.role };
}

/** Org plan fields to feed effectivePlan. Empty when the user has no org. */
export async function getOrgPlanInput(
  userId: string
): Promise<{ orgPlan: string | null; orgProUntil: Date | null }> {
  const org = await getUserOrg(userId);
  if (!org) return { orgPlan: null, orgProUntil: null };
  const [row] = await db
    .select({ plan: organizations.plan, proUntil: organizations.proUntil })
    .from(organizations)
    .where(eq(organizations.id, org.orgId))
    .limit(1);
  return { orgPlan: row?.plan ?? null, orgProUntil: row?.proUntil ?? null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/org/orgAccess.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/org/orgAccess.ts tests/lib/org/orgAccess.test.ts
git commit -m "feat(org): getUserOrg + getOrgPlanInput helpers"
```

---

## Task 5: Org-aware project access (TDD, mocked db)

**Files:**
- Modify: `src/lib/projectAccess.ts`
- Test: `tests/lib/projectAccess.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/lib/projectAccess.test.ts`, the mock currently provides only `select` and `insert`. The org-visibility path needs to read the project's `visibility` + `orgId` and then check org membership. Add this describe block at the end of the file:

```ts
describe("getProjectAccess — org visibility", () => {
  test("non-member, project visibility='org' and user in that org → viewer", async () => {
    // 1) member miss, 2) project row with visibility=org + orgId,
    // 3) org membership hit
    queue = [
      [], // projectMembers miss
      [{ userId: "creator", visibility: "org", orgId: "o1", deletedAt: null }],
      [{ orgId: "o1" }], // user is in org o1
    ];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toMatchObject({ role: "viewer", legacy: false });
  });

  test("non-member, project visibility='org' but user NOT in that org → null", async () => {
    queue = [
      [],
      [{ userId: "creator", visibility: "org", orgId: "o1", deletedAt: null }],
      [], // not in org
    ];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toBeNull();
  });

  test("non-member, private project → null (no org leak)", async () => {
    queue = [
      [],
      [{ userId: "creator", visibility: "private", orgId: null, deletedAt: null }],
    ];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toBeNull();
  });

  test("soft-deleted project → null even for the creator", async () => {
    queue = [
      [],
      [{ userId: "u1", visibility: "private", orgId: null, deletedAt: new Date() }],
    ];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/projectAccess.test.ts`
Expected: the new org-visibility cases FAIL (current code only checks `project.userId`).

- [ ] **Step 3: Update `getProjectAccess`**

In `src/lib/projectAccess.ts`, update imports (line 2) to include the org tables:

```ts
import { projects, projectMembers, orgMembers } from "@/db/schema";
```

Replace the legacy-fallback block (current lines 59-70) with:

```ts
  // Legacy + org-visibility fallback. Read the project's owner pointer,
  // visibility, org, and soft-delete state in one row.
  const [project] = await db
    .select({
      userId: projects.userId,
      visibility: projects.visibility,
      orgId: projects.orgId,
      deletedAt: projects.deletedAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;
  // Soft-deleted projects are inaccessible via the normal path (Trash only).
  if (project.deletedAt) return null;

  // The original creator is an implicit owner.
  if (project.userId === userId) {
    return { projectId, userId, role: "owner", legacy: true };
  }

  // Org-shared: any active member of the project's org gets viewer access.
  if (project.visibility === "org" && project.orgId) {
    const [orgRow] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, project.orgId),
          eq(orgMembers.userId, userId),
          eq(orgMembers.status, "active")
        )
      )
      .limit(1);
    if (orgRow) {
      return { projectId, userId, role: "viewer", legacy: false };
    }
  }

  return null;
```

> Note: org members get `viewer` by default. Owners grant higher roles to specific people via `projectMembers` (Task is in W2/W4 plans). This keeps org-shared access read-by-default, edit-by-invite.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/projectAccess.test.ts`
Expected: PASS (existing + new cases). The existing "legacy creator" tests still pass because the project row now also carries `visibility/orgId/deletedAt`, but those tests script `[{ userId: "u1" }]` → `deletedAt` is `undefined` (falsy) so the creator path still returns owner.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectAccess.ts tests/lib/projectAccess.test.ts
git commit -m "feat(access): org-visibility + soft-delete aware getProjectAccess"
```

---

## Task 6: Org-aware, soft-delete-aware project listing (TDD, mocked db)

**Files:**
- Modify: `src/lib/projectAccess.ts` (`listAccessibleProjectIds`)
- Test: `tests/lib/projectAccess.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/projectAccess.test.ts`:

```ts
describe("listAccessibleProjectIds — org + soft-delete", () => {
  test("merges member rows, legacy-owned, and org-shared; dedupes", async () => {
    queue = [
      [{ projectId: "p1" }], // membership rows
      [{ id: "p2" }], // legacy-owned (not deleted)
      [{ orgId: "o1" }], // getUserOrg-style: user's org
      [{ id: "p2" }, { id: "p3" }], // org-shared, non-deleted projects (p2 dupe)
    ];
    const ids = await listAccessibleProjectIds("u1");
    expect([...ids].sort()).toEqual(["p1", "p2", "p3"]);
  });

  test("no org → just member + legacy-owned", async () => {
    queue = [
      [{ projectId: "p1" }],
      [{ id: "p2" }],
      [], // no org membership
    ];
    const ids = await listAccessibleProjectIds("u1");
    expect([...ids].sort()).toEqual(["p1", "p2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/projectAccess.test.ts`
Expected: the new "org + soft-delete" cases FAIL.

- [ ] **Step 3: Update `listAccessibleProjectIds`**

Replace the function body (current lines 132-145) with:

```ts
export async function listAccessibleProjectIds(userId: string): Promise<string[]> {
  // 1) Active memberships, 2) legacy-owned (non-deleted).
  const [memberRows, ownedRows] = await Promise.all([
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.status, "active"))),
    db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt))),
  ]);

  const ids = new Set<string>();
  for (const r of memberRows) ids.add(r.projectId);
  for (const r of ownedRows) ids.add(r.id);

  // 3) Org-shared, non-deleted projects of the user's org.
  const [orgRow] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, "active")))
    .limit(1);

  if (orgRow) {
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, orgRow.orgId),
          eq(projects.visibility, "org"),
          isNull(projects.deletedAt)
        )
      );
    for (const r of orgProjects) ids.add(r.id);
  }

  return [...ids];
}
```

Update the drizzle import (line 3) to add `isNull`:

```ts
import { and, eq, isNull } from "drizzle-orm";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/projectAccess.test.ts`
Expected: PASS.

> Note: the mock returns `[]` for any extra `.where()` call, so the "no org" case (3rd queue item `[]`) makes the `orgRow` lookup miss and skips the org-projects query — matching the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectAccess.ts tests/lib/projectAccess.test.ts
git commit -m "feat(access): org-shared + soft-delete aware project listing"
```

---

## Task 7: Full suite + build gate, then production migration

**Files:** none (verification + deploy)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (no regressions in `plans`, `usage`, `projectAccess`, etc.).

- [ ] **Step 2: Typecheck + build + motion lint**

Run: `npx tsc --noEmit && npm run lint:motion && npm run build`
Expected: clean build, motion lint 0 errors.

- [ ] **Step 3: Baseline + migrate PRODUCTION (careful, one-time)**

Only after a Neon-branch dry run (Tasks 1 & 3) succeeded:
1. `DATABASE_URL=<prod> npx tsx scripts/baseline-migrations.ts` (marks pre-existing schema applied; the new `0002` is NOT yet in the journal so it WILL run next).
2. `DATABASE_URL=<prod> npm run db:migrate` (applies only `0002` — the new orgs/columns).
Expected: `0002` applies; existing tables untouched. Verify in Neon that `organizations`, `org_members`, `token_usage_log` exist and `projects` has `visibility/org_id/archived_at/deleted_at`.

- [ ] **Step 4: Commit any journal/meta updates and push**

```bash
git add drizzle/
git commit -m "chore(db): record phase-0 migration journal"
git push origin <branch>
```

---

## Self-Review notes (author)
- **Spec coverage:** W8 migration tooling (Task 1, 7) ✓; W0 schema (Task 3) ✓; plan inheritance / "company paid" (Task 2, 4) ✓; org-visibility access + soft-delete exclusion (Task 5, 6) ✓. Activity-events *writing*, token-log *writes*, and the UI for orgs/visibility/trash are **out of scope here** — they live in the W1–W7 plans (this phase only lays schema + access + plan logic).
- **Type consistency:** `PlanResolutionInput.orgPlan/orgProUntil` (Task 2) consumed by `getOrgPlanInput` return shape (Task 4) — names match. `getProjectAccess` org clause (Task 5) and `listAccessibleProjectIds` (Task 6) both read `projects.visibility/orgId/deletedAt` and `orgMembers.status='active'` consistently.
- **No placeholders:** every code step contains complete code; every command has expected output.
- **Risk:** Task 1/7 baseline against prod is the one irreversible-ish step — gated behind a Neon-branch dry run and explicit verification.
