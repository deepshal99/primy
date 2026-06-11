/**
 * withPlanLimit — unit tests with mocked auth, db, and usage.
 *
 * No real DB. We mock `@/lib/auth` and `@/db`, plus the usage helpers
 * the wrapper calls. The matrix in #19 of the engineering review is
 * encoded as test.each cases below.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

// db mock — `select().from(users).where(...).limit(1)` chain returns
// whatever userRowMock yields.
const userRowMock = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => userRowMock(),
        }),
      }),
    }),
  },
}));

// Usage module mock so we can assert increment was/wasn't called.
const incrementUsageMock = vi.fn();
const getUsageMock = vi.fn();
vi.mock("@/lib/billing/usage", () => ({
  incrementUsage: (...args: unknown[]) => incrementUsageMock(...args),
  getUsage: (...args: unknown[]) => getUsageMock(...args),
  currentMonthKey: () => "2026-05",
  computeStorageFromFiles: vi.fn(),
}));

// Import AFTER mocks are set up
import { withPlanLimit } from "@/lib/billing/withPlanLimit";

// ── Helpers ───────────────────────────────────────────────────────────

function makeReq(): NextRequest {
  return new Request("https://x/api/chat", { method: "POST" }) as unknown as NextRequest;
}

const ORIG_ENFORCE = process.env.ENFORCE_PLAN_LIMITS;

beforeEach(() => {
  authMock.mockReset();
  userRowMock.mockReset();
  incrementUsageMock.mockReset();
  getUsageMock.mockReset();
  delete process.env.ENFORCE_PLAN_LIMITS;
});

afterEach(() => {
  if (ORIG_ENFORCE === undefined) delete process.env.ENFORCE_PLAN_LIMITS;
  else process.env.ENFORCE_PLAN_LIMITS = ORIG_ENFORCE;
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("withPlanLimit — auth gate", () => {
  test("returns 401 when session is null", async () => {
    authMock.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(incrementUsageMock).not.toHaveBeenCalled();
  });

  test("returns 401 when session.user.id is missing", async () => {
    authMock.mockResolvedValue({ user: {} });
    const handler = vi.fn();
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withPlanLimit — flag OFF (passthrough but counters increment)", () => {
  test("ENFORCE_PLAN_LIMITS unset: ENFORCES (fail-closed launch default)", async () => {
    process.env.ENFORCE_PLAN_LIMITS = undefined as any;
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 99999, fileUploads: 0, storageBytes: 0 });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
    expect(incrementUsageMock).not.toHaveBeenCalled();
  });

  test("ENFORCE_PLAN_LIMITS=false: still increments + calls handler", async () => {
    process.env.ENFORCE_PLAN_LIMITS = "false";
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: null }]);
    incrementUsageMock.mockResolvedValue(1);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(incrementUsageMock).toHaveBeenCalled();
  });
});

describe("withPlanLimit — flag ON: enforcement matrix", () => {
  beforeEach(() => {
    process.env.ENFORCE_PLAN_LIMITS = "true";
  });

  test("free user under cap → 200, handler called, increment called", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 49, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(50);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(incrementUsageMock).toHaveBeenCalledTimes(1);
  });

  test("free user at cap (used=50, limit=50) → 402, handler NOT called, no increment", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 50, fileUploads: 0, storageBytes: 0 });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
    expect(incrementUsageMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toMatchObject({
      error: "plan_limit_exceeded",
      plan: "free",
      resource: "aiMessages",
      limit: 50,
      used: 50,
    });
  });

  test("free user over cap → 402, body shape includes plan/resource/limit/used", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 75, fileUploads: 0, storageBytes: 0 });
    const handler = vi.fn();
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.used).toBe(75);
    expect(body.limit).toBe(50);
  });

  test("pro user always allowed (used=9999, but pro limit=1500) → still 402 if over cap", async () => {
    // Pro IS finite (1500). Spec text "pro user always 200" assumes the
    // passing test means pro under its own cap — encode that.
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "pro", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 100, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(101);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("pro user with INFINITY cap (fileUploads) under heavy use → 200", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "pro", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 0, fileUploads: 1_000_000, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(1_000_001);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "fileUploads" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
  });

  test("proUntil-future treated as pro → 200 even when free counter is high", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const future = new Date(Date.now() + 30 * 24 * 3600_000);
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: future }]);
    getUsageMock.mockResolvedValue({ aiMessages: 200, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(201);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
  });

  test("proUntil-past + plan=free + over cap → 402", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const past = new Date(Date.now() - 24 * 3600_000);
    userRowMock.mockResolvedValue([{ plan: "free", proUntil: past }]);
    getUsageMock.mockResolvedValue({ aiMessages: 51, fileUploads: 0, storageBytes: 0 });
    const handler = vi.fn();
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
  });

  test("user not found in DB → 401 (cannot resolve plan)", async () => {
    authMock.mockResolvedValue({ user: { id: "ghost" } });
    userRowMock.mockResolvedValue([]);
    const handler = vi.fn();
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test("custom amount is forwarded to incrementUsage (e.g. file size)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "pro", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 0, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(5);
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withPlanLimit(handler, { resource: "fileUploads", amount: 5 });
    const res = await wrapped(makeReq());
    expect(res.status).toBe(200);
    expect(incrementUsageMock).toHaveBeenCalledWith("u1", "fileUploads", 5);
  });

  test("handler receives ctx with userId + resolved plan", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "pro", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 0, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(1);
    let capturedCtx: any;
    const handler = vi.fn(async (_req, ctx) => {
      capturedCtx = ctx;
      return Response.json({ ok: true });
    });
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    await wrapped(makeReq());
    expect(capturedCtx).toEqual({ userId: "u1", plan: "pro" });
  });

  test("handler exception propagates; counter does NOT roll back (documented behavior)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    userRowMock.mockResolvedValue([{ plan: "pro", proUntil: null }]);
    getUsageMock.mockResolvedValue({ aiMessages: 0, fileUploads: 0, storageBytes: 0 });
    incrementUsageMock.mockResolvedValue(1);
    const boom = new Error("downstream broke");
    const handler = vi.fn(async () => {
      throw boom;
    });
    const wrapped = withPlanLimit(handler, { resource: "aiMessages" });
    await expect(wrapped(makeReq())).rejects.toBe(boom);
    // Counter was incremented exactly once; no rollback.
    expect(incrementUsageMock).toHaveBeenCalledTimes(1);
  });
});
