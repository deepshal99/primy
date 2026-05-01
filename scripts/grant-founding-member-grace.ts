/**
 * One-off migration: grant 60-day Pro grace to all current free users.
 *
 * Run once before flipping ENFORCE_PLAN_LIMITS=true in production so
 * pre-launch users aren't surprise-throttled.
 *
 * Usage:
 *   npm run migrate:grace
 *   # or directly:
 *   npx tsx scripts/grant-founding-member-grace.ts
 *
 * Idempotency:
 *   - Eligible:   plan === 'free' AND (proUntil IS NULL OR proUntil <= now())
 *   - Skipped:    plan === 'pro'   (real subscription — never overridden)
 *   - Skipped:    proUntil > now() (already on grace — not extended silently)
 *
 *   Re-running on someone whose grace has expired refreshes it. That's
 *   the desired behavior for "second wave" promo runs.
 *
 * Audit:
 *   Writes a row to migration_logs ("grant-founding-member-grace") with
 *   the affected user count and the new grace expiry timestamp.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, isNull, or, lte, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { users, migrationLogs } from "@/db/schema";
import { FOUNDING_MEMBER_GRACE_DAYS } from "@/lib/plans";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const client = neon(url);
  const db = drizzle(client);

  const now = new Date();
  const graceUntil = new Date(
    now.getTime() + FOUNDING_MEMBER_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  console.log(
    `[grace] Granting Pro grace until ${graceUntil.toISOString()} ` +
      `(${FOUNDING_MEMBER_GRACE_DAYS} days from now)...`
  );

  // Eligible:
  //   plan === 'free' AND (proUntil IS NULL OR proUntil <= now())
  // Skip:
  //   plan === 'pro'        — real sub, never override
  //   proUntil >  now()     — already on grace, don't extend silently
  const result = await db
    .update(users)
    .set({ proUntil: graceUntil })
    .where(
      and(
        eq(users.plan, "free"),
        or(isNull(users.proUntil), lte(users.proUntil, now))
      )
    )
    .returning({ id: users.id });

  const affected = result.length;
  console.log(`[grace] Updated ${affected} user(s).`);

  // Audit trail.
  await db.insert(migrationLogs).values({
    id: nanoid(),
    name: "grant-founding-member-grace",
    notes:
      `Granted ${FOUNDING_MEMBER_GRACE_DAYS}-day Pro grace to ${affected} user(s) ` +
      `(until ${graceUntil.toISOString()})`,
    artifactUrl: null,
  });

  console.log("[grace] Migration log written. Done.");
}

main().catch((err) => {
  console.error("[grace] Failed:", err);
  process.exit(1);
});
