/**
 * Mark an organization as Pro ("company paid") — every member then inherits
 * Pro automatically (via effectivePlan's org inheritance). There is no UI for
 * this on purpose; it's an operator action.
 *
 * Usage:
 *   npx tsx scripts/set-org-pro.ts                 # list all orgs
 *   npx tsx scripts/set-org-pro.ts "Pixeldust"     # set the matching org to Pro
 *   npx tsx scripts/set-org-pro.ts "Pixeldust" free  # revert to Free
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);

  const query = process.argv[2];
  const plan = (process.argv[3] || "pro").toLowerCase();

  if (!query) {
    const orgs = await sql`SELECT name, slug, plan FROM organizations ORDER BY created_at DESC`;
    if (orgs.length === 0) {
      console.log("No organizations yet. Create one in the app: Settings -> Team -> Create organization.");
      return;
    }
    console.log("Organizations:");
    for (const o of orgs) console.log(`  - ${o.name}  (slug: ${o.slug})  plan: ${o.plan}`);
    console.log('\nTo set one Pro: npx tsx scripts/set-org-pro.ts "<name or slug>"');
    return;
  }

  if (plan !== "pro" && plan !== "free") {
    console.error('Plan must be "pro" or "free".');
    process.exit(1);
  }

  const q = `%${query.toLowerCase()}%`;
  const matches = await sql`
    SELECT id, name, slug FROM organizations
    WHERE lower(name) LIKE ${q} OR lower(slug) LIKE ${q}
  `;
  if (matches.length === 0) {
    console.error(`No org matched "${query}". Run with no argument to list orgs.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`"${query}" matched ${matches.length} orgs — be more specific:`);
    for (const m of matches) console.error(`  - ${m.name} (slug: ${m.slug})`);
    process.exit(1);
  }

  const org = matches[0];
  await sql`UPDATE organizations SET plan = ${plan} WHERE id = ${org.id}`;
  console.log(`✅ "${org.name}" is now ${plan.toUpperCase()}. All its members inherit ${plan}.`);
}

main().catch((e) => {
  console.error("[set-org-pro] failed:", e);
  process.exit(1);
});
