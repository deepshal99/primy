/**
 * projectAccess — unit tests with a mocked db.
 *
 * No real DB. We mock `@/db` so the `select().from().where().limit()` chain
 * pulls successive results from a queue, letting us script the two lookups
 * getProjectAccess performs (membership row, then legacy creator pointer).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

// db mock: each `...where().limit()` (and bare `...where()`) call shifts the
// next scripted result off `queue`.
let queue: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const result = queue.length ? queue.shift() : [];
          const thenable = Promise.resolve(result);
          // Support both `.where(...).limit(1)` and `.where(...)` (no limit).
          return Object.assign(thenable, { limit: async () => result });
        },
      }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoNothing: async () => undefined }),
    }),
  },
}));

vi.mock("nanoid", () => ({ nanoid: () => "test-id" }));

import {
  getProjectAccess,
  requireProjectAccess,
  ProjectAccessError,
  listAccessibleProjectIds,
} from "@/lib/projectAccess";

beforeEach(() => {
  queue = [];
});

describe("getProjectAccess", () => {
  test("active member resolves to its role", async () => {
    queue = [[{ role: "editor", status: "active" }]];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toEqual({ projectId: "p1", userId: "u1", role: "editor", legacy: false });
  });

  test("no membership + legacy creator pointer → implicit owner", async () => {
    queue = [[], [{ userId: "u1" }]]; // member miss, then project.userId === u1
    const access = await getProjectAccess("p1", "u1");
    expect(access).toMatchObject({ role: "owner", legacy: true });
  });

  test("pending membership falls through to legacy owner check", async () => {
    queue = [[{ role: "editor", status: "pending" }], [{ userId: "u1" }]];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toMatchObject({ role: "owner", legacy: true });
  });

  test("no membership + different creator → null (no access)", async () => {
    queue = [[], [{ userId: "someone-else" }]];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toBeNull();
  });

  test("no membership + no project row → null", async () => {
    queue = [[], []];
    const access = await getProjectAccess("p1", "u1");
    expect(access).toBeNull();
  });
});

describe("requireProjectAccess — role gating", () => {
  test("editor meets viewer minimum → returns access", async () => {
    queue = [[{ role: "editor", status: "active" }]];
    const access = await requireProjectAccess("p1", "u1", "viewer");
    expect(access.role).toBe("editor");
  });

  test("viewer below editor minimum → 403", async () => {
    queue = [[{ role: "viewer", status: "active" }]];
    await expect(requireProjectAccess("p1", "u1", "editor")).rejects.toMatchObject({
      status: 403,
    });
  });

  test("commenter below editor minimum → 403", async () => {
    queue = [[{ role: "commenter", status: "active" }]];
    await expect(requireProjectAccess("p1", "u1", "editor")).rejects.toBeInstanceOf(
      ProjectAccessError
    );
  });

  test("editor below owner minimum → 403", async () => {
    queue = [[{ role: "editor", status: "active" }]];
    await expect(requireProjectAccess("p1", "u1", "owner")).rejects.toMatchObject({
      status: 403,
    });
  });

  test("owner meets owner minimum → ok", async () => {
    queue = [[{ role: "owner", status: "active" }]];
    const access = await requireProjectAccess("p1", "u1", "owner");
    expect(access.role).toBe("owner");
  });

  test("non-member → 404 (no existence leak)", async () => {
    queue = [[], []];
    await expect(requireProjectAccess("p1", "u1", "viewer")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("getProjectAccess — org visibility", () => {
  test("non-member, project visibility='org' and user in that org → viewer", async () => {
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

describe("listAccessibleProjectIds — org + soft-delete", () => {
  test("merges member rows, legacy-owned, and org-shared; dedupes", async () => {
    queue = [
      [{ projectId: "p1" }], // membership rows
      [{ id: "p2" }], // legacy-owned (not deleted)
      [{ orgId: "o1" }], // user's org
      [{ id: "p2" }, { id: "p3" }], // org-shared, non-deleted (p2 dupe)
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
