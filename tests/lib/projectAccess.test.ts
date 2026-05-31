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
