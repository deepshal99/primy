/**
 * Test database helper.
 *
 * Returns a Drizzle client pointed at DATABASE_URL_TEST (a Neon test
 * branch). Tests that call requireTestDb() will skip gracefully when
 * the env is missing — keeping the suite green in environments
 * without DB access.
 *
 *     test("foo", async () => {
 *       const db = await requireTestDb();
 *       if (!db) return; // skip in env without test DB
 *       // ...
 *     });
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function requireTestDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    // eslint-disable-next-line no-console
    console.warn("[tests] DATABASE_URL_TEST not set — skipping DB-dependent test");
    return null;
  }
  const client = neon(url);
  cached = drizzle(client, { schema });
  return cached;
}

/** Pure-function tests that don't need a DB use this no-op. */
export function unitTestOnly() {
  return null;
}
