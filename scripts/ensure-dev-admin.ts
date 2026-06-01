/**
 * Ensure a local-only dev admin user exists.
 *
 *   email:    admin@primy.local
 *   password: admin
 *   plan:     "pro" (no proUntil expiry, so it stays Pro forever)
 *
 * Idempotent — safe to run multiple times. Only ever run against
 * local Neon branches; the credentials are well-known.
 *
 * The dev-only "Sign in as admin (dev)" button on /login uses
 * these credentials. The button is gated by NODE_ENV !== "production"
 * so it never renders in a deployed build.
 *
 * Usage:
 *   npm run dev:admin
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { users } from "@/db/schema";

const DEV_ADMIN_EMAIL = "admin@primy.local";
const DEV_ADMIN_PASSWORD = "admin";
const DEV_ADMIN_NAME = "Dev Admin";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[dev-admin] DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const client = neon(url);
  const db = drizzle(client);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEV_ADMIN_EMAIL))
    .limit(1);

  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);

  if (existing.length > 0) {
    // Refresh password + ensure plan='pro' so dev surface always has Pro.
    await db
      .update(users)
      .set({
        passwordHash,
        plan: "pro",
        proUntil: null, // real Pro, no expiry
        hasOnboarded: true,
      })
      .where(eq(users.email, DEV_ADMIN_EMAIL));
    console.log(`[dev-admin] Refreshed existing user (${DEV_ADMIN_EMAIL}).`);
  } else {
    await db.insert(users).values({
      id: nanoid(),
      email: DEV_ADMIN_EMAIL,
      name: DEV_ADMIN_NAME,
      passwordHash,
      plan: "pro",
      proUntil: null,
      hasOnboarded: true,
    });
    console.log(`[dev-admin] Created new user (${DEV_ADMIN_EMAIL}).`);
  }

  console.log(`[dev-admin] Credentials: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  console.log(`[dev-admin] Done.`);
}

main().catch((err) => {
  console.error("[dev-admin] Failed:", err);
  process.exit(1);
});
