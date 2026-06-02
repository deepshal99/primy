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
