import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import {
  computeStorageFromFiles,
  currentMonthKey,
  getUsage,
  incrementUsage,
} from "@/lib/billing/usage";
import { requireTestDb } from "../../helpers/db";
import { files, usage, users } from "@/db/schema";

describe("currentMonthKey", () => {
  test("returns YYYY-MM format", () => {
    const key = currentMonthKey(new Date("2026-05-01T12:00:00Z"));
    expect(key).toBe("2026-05");
  });

  test("zero-pads single-digit months", () => {
    expect(currentMonthKey(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01");
    expect(currentMonthKey(new Date("2026-09-15T00:00:00Z"))).toBe("2026-09");
  });

  test("uses UTC, not local time (boundary at 23:30 UTC on last day)", () => {
    // 2026-05-31T23:30:00Z must still be in May regardless of TZ
    expect(currentMonthKey(new Date("2026-05-31T23:30:00Z"))).toBe("2026-05");
    // 2026-06-01T00:30:00Z is June, not May
    expect(currentMonthKey(new Date("2026-06-01T00:30:00Z"))).toBe("2026-06");
  });

  test("uses now() default when not provided", () => {
    const key = currentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });
});

// DB-dependent tests — skip gracefully if DATABASE_URL_TEST missing.
describe("usage DB integration", () => {
  let db: Awaited<ReturnType<typeof requireTestDb>> = null;
  let testUserIds: string[] = [];

  beforeAll(async () => {
    db = await requireTestDb();
  });

  afterAll(async () => {
    if (!db || testUserIds.length === 0) return;
    // Cleanup in reverse FK order: usage, files, users
    for (const id of testUserIds) {
      await db.delete(files).where(eq(files.userId, id));
      await db.delete(usage).where(eq(usage.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  async function makeUser(): Promise<string> {
    if (!db) throw new Error("no db");
    const id = `test-${nanoid(10)}`;
    await db.insert(users).values({
      id,
      name: "Test User",
      email: `${id}@test.local`,
      passwordHash: "x",
    });
    testUserIds.push(id);
    return id;
  }

  test("incrementUsage creates row on first call, returns 1", async () => {
    if (!db) return;
    const userId = await makeUser();
    const v = await incrementUsage(userId, "aiMessages");
    expect(v).toBe(1);
  });

  test("incrementUsage increments existing row", async () => {
    if (!db) return;
    const userId = await makeUser();
    await incrementUsage(userId, "aiMessages");
    await incrementUsage(userId, "aiMessages");
    const v = await incrementUsage(userId, "aiMessages");
    expect(v).toBe(3);
  });

  test("incrementUsage with custom amount (storageBytes)", async () => {
    if (!db) return;
    const userId = await makeUser();
    const v1 = await incrementUsage(userId, "storageBytes", 1024);
    expect(v1).toBe(1024);
    const v2 = await incrementUsage(userId, "storageBytes", 2048);
    expect(v2).toBe(3072);
  });

  test("concurrent increments are race-free (10 parallel → 10)", async () => {
    if (!db) return;
    const userId = await makeUser();
    await Promise.all(
      Array.from({ length: 10 }, () => incrementUsage(userId, "aiMessages"))
    );
    const final = await getUsage(userId);
    expect(final.aiMessages).toBe(10);
  });

  test("getUsage returns zeros for new user", async () => {
    if (!db) return;
    const userId = await makeUser();
    const u = await getUsage(userId);
    expect(u).toEqual({ aiMessages: 0, fileUploads: 0, storageBytes: 0 });
  });

  test("getUsage reflects increments across resources", async () => {
    if (!db) return;
    const userId = await makeUser();
    await incrementUsage(userId, "aiMessages");
    await incrementUsage(userId, "fileUploads");
    await incrementUsage(userId, "fileUploads");
    await incrementUsage(userId, "storageBytes", 5000);
    const u = await getUsage(userId);
    expect(u.aiMessages).toBe(1);
    expect(u.fileUploads).toBe(2);
    expect(u.storageBytes).toBe(5000);
  });

  test("computeStorageFromFiles sums non-deleted files only", async () => {
    if (!db) return;
    const userId = await makeUser();
    // Insert 3 files; soft-delete one.
    await db.insert(files).values([
      {
        id: nanoid(),
        userId,
        blobUrl: "https://x/1",
        originalName: "a",
        mimeType: "text/plain",
        bytes: 100,
      },
      {
        id: nanoid(),
        userId,
        blobUrl: "https://x/2",
        originalName: "b",
        mimeType: "text/plain",
        bytes: 200,
      },
      {
        id: nanoid(),
        userId,
        blobUrl: "https://x/3",
        originalName: "c",
        mimeType: "text/plain",
        bytes: 400,
        deletedAt: new Date(),
      },
    ]);
    const total = await computeStorageFromFiles(userId);
    expect(total).toBe(300);
  });

  test("computeStorageFromFiles returns 0 for user with no files", async () => {
    if (!db) return;
    const userId = await makeUser();
    expect(await computeStorageFromFiles(userId)).toBe(0);
  });
});
