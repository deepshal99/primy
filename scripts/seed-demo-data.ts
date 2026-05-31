/**
 * Seed fresh demo data for the local dev admin (admin@drafta.local).
 *
 * Wipes the admin's existing projects, then creates a handful of realistic
 * team projects — each with a document, a spreadsheet, a deck, an HTML visual
 * page, owner + teammate membership, activity events, and a couple of file
 * rows. Idempotent: re-running rebuilds the demo set from scratch.
 *
 * Run: npm run seed:demo
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  users,
  projects,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projectPages,
  projectMembers,
  activityEvents,
  files,
} from "@/db/schema";

const ADMIN_EMAIL = "admin@drafta.local";
const TEAMMATE_EMAIL = "maya@drafta.local";

// ── A small builder for polished, self-contained HTML visual pages ──
interface Stat { value: string; label: string }
interface Section { heading: string; body: string; tag?: string }
function buildVisualPage(opts: {
  kicker: string;
  title: string;
  subtitle: string;
  accent: string;
  stats: Stat[];
  sections: Section[];
}): string {
  const { kicker, title, subtitle, accent, stats, sections } = opts;
  const statCards = stats
    .map(
      (s) => `<div class="stat"><div class="stat-v">${s.value}</div><div class="stat-l">${s.label}</div></div>`
    )
    .join("");
  const sectionCards = sections
    .map(
      (s) => `<article class="card"><div class="card-top">${s.tag ? `<span class="pill">${s.tag}</span>` : ""}<h3>${s.heading}</h3></div><p>${s.body}</p></article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;color:#171717;background:#fafafa;line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:880px;margin:0 auto;padding:56px 32px 80px}
  .hero{background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);border-radius:20px;padding:44px 40px;color:#fff;position:relative;overflow:hidden}
  .hero::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.12)}
  .kicker{text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:600;opacity:.9}
  .hero h1{font-size:34px;font-weight:700;letter-spacing:-.02em;margin:10px 0 8px;max-width:640px}
  .hero p{font-size:16px;opacity:.92;max-width:560px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:-28px 8px 0;position:relative;z-index:2}
  .stat{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:18px 20px;box-shadow:0 6px 20px rgba(0,0,0,.05)}
  .stat-v{font-size:26px;font-weight:700;letter-spacing:-.02em;color:${accent}}
  .stat-l{font-size:12.5px;color:#737373;margin-top:2px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}
  .card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:22px;transition:transform .15s ease,box-shadow .15s ease}
  .card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.07)}
  .card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .card h3{font-size:16px;font-weight:600;letter-spacing:-.01em}
  .card p{font-size:14px;color:#525252}
  .pill{font-size:11px;font-weight:600;color:${accent};background:${accent}1a;padding:3px 9px;border-radius:999px}
  .foot{margin-top:38px;text-align:center;font-size:12px;color:#a3a3a3}
  @media(max-width:680px){.grid{grid-template-columns:1fr}.hero h1{font-size:27px}}
</style></head>
<body><div class="wrap">
  <header class="hero"><div class="kicker">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></header>
  <section class="stats">${statCards}</section>
  <section class="grid">${sectionCards}</section>
  <p class="foot">Drafta · living document — edits to the source keep this page in sync</p>
</div></body></html>`;
}

// ── Spreadsheet helper: build Fortune/Univer celldata from a 2D array ──
function sheetFromRows(name: string, rows: (string | number)[][]) {
  const celldata: { r: number; c: number; v: { v: string | number; m?: string; bl?: number } }[] = [];
  rows.forEach((row, r) =>
    row.forEach((val, c) => {
      celldata.push({ r, c, v: { v: val, m: String(val), ...(r === 0 ? { bl: 1 } : {}) } });
    })
  );
  return [{ name, order: 0, status: 1, celldata, row: Math.max(50, rows.length + 10), column: 26 }];
}

function titleSlide(title: string, subtitle: string) {
  return { id: nanoid(), layout: "title" as const, title, subtitle };
}
function bulletsSlide(title: string, bullets: string[]) {
  return { id: nanoid(), layout: "bullets" as const, title, bullets };
}
function statsSlide(title: string, stats: { value: string; label: string }[]) {
  return { id: nanoid(), layout: "stats" as const, title, stats };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[seed] DATABASE_URL not set. Aborting.");
    process.exit(1);
  }
  const db = drizzle(neon(url));

  // Resolve admin
  const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (!admin) {
    console.error(`[seed] ${ADMIN_EMAIL} not found. Run: npm run dev:admin first.`);
    process.exit(1);
  }

  // Ensure a teammate user exists (for membership demo)
  let [maya] = await db.select().from(users).where(eq(users.email, TEAMMATE_EMAIL)).limit(1);
  if (!maya) {
    const passwordHash = await bcrypt.hash("maya", 12);
    [maya] = await db
      .insert(users)
      .values({ id: nanoid(), name: "Maya Chen", email: TEAMMATE_EMAIL, passwordHash, plan: "pro", hasOnboarded: true })
      .returning();
    console.log("[seed] Created teammate maya@drafta.local");
  }

  // Wipe admin's existing projects (cascades to entities/members/activity/files)
  const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, admin.id));
  if (existing.length > 0) {
    await db.delete(projects).where(inArray(projects.id, existing.map((p) => p.id)));
    console.log(`[seed] Removed ${existing.length} existing admin project(s).`);
  }

  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

  // ── Project definitions ──
  const defs = [
    {
      title: "Acme Rebrand — Q3 Launch",
      description: "Client engagement: rebrand strategy, launch budget, and the kickoff deck.",
      projectType: "Design",
      purpose: "Deliver Acme's Q3 rebrand: positioning, visual identity, and a launch plan the whole team works from.",
      audience: "Acme leadership + our delivery pod",
      voice: "Confident, warm, precise",
      client: "Acme Inc.",
      timeline: "Launch Sept 30",
      ku: {
        title: "Creative Brief",
        content:
          "# Acme Rebrand — Creative Brief\n\n## The problem\nAcme reads as dated and enterprise-heavy. Younger buyers bounce.\n\n## The idea\nReposition Acme as the **approachable expert** — sharp, warm, human.\n\n## Deliverables\n- New wordmark + palette\n- Messaging house\n- Launch site + deck\n\n## Success\nLift demo-request conversion by 25% within 60 days of launch.",
      },
      table: {
        title: "Launch Budget",
        rows: [
          ["Workstream", "Owner", "Budget", "Status"],
          ["Brand identity", "Maya", 18000, "In progress"],
          ["Launch site", "Dev pod", 24000, "Scoping"],
          ["Paid launch", "Growth", 30000, "Planned"],
          ["Total", "", 72000, ""],
        ],
      },
      deck: {
        title: "Kickoff Deck",
        slides: [
          titleSlide("Acme Rebrand", "Q3 Launch — kickoff"),
          bulletsSlide("Why now", ["Brand reads dated", "Buyers skew younger", "Competitors feel warmer"]),
          statsSlide("Targets", [
            { value: "+25%", label: "Demo conversion" },
            { value: "60d", label: "To impact" },
            { value: "3", label: "Deliverables" },
          ]),
        ],
      },
      page: buildVisualPage({
        kicker: "Creative Brief",
        title: "Acme Rebrand — at a glance",
        subtitle: "The approachable expert: sharp, warm, human. Everything the pod needs on one page.",
        accent: "#fa5d19",
        stats: [
          { value: "+25%", label: "Demo conversion goal" },
          { value: "$72k", label: "Launch budget" },
          { value: "Sept 30", label: "Go-live" },
        ],
        sections: [
          { tag: "Problem", heading: "Dated & enterprise-heavy", body: "Acme reads cold to younger buyers, who bounce before booking a demo." },
          { tag: "Idea", heading: "The approachable expert", body: "Reposition around warmth + authority: confident, human, never corporate." },
          { tag: "Deliverables", heading: "Identity → Site → Deck", body: "New wordmark and palette, a messaging house, and a launch site + deck." },
          { tag: "Success", heading: "Conversion, in 60 days", body: "Lift demo-request conversion 25% within two months of launch." },
        ],
      }),
      teammate: true,
    },
    {
      title: "Product Strategy 2026",
      description: "PRD, roadmap metrics, and the board update — one source of truth.",
      projectType: "Research",
      purpose: "Align the team on the 2026 product bets and the metrics that prove them.",
      audience: "Founders, eng leads, board",
      voice: "Direct, evidence-led",
      client: null,
      timeline: "Board review — Feb",
      ku: {
        title: "2026 PRD — North Star",
        content:
          "# 2026 Product Strategy\n\n## North star\nActivated teams (2+ members, 3+ artifacts in week 1).\n\n## Bets\n1. **Team SSOT** — shared memory + living links\n2. **Visual pages** — docs become interactive HTML\n3. **Seat-based pricing**\n\n## Non-goals\nNative mobile, SSO/enterprise — revisit post-traction.",
      },
      table: {
        title: "Roadmap Metrics",
        rows: [
          ["Quarter", "Bet", "Metric", "Target"],
          ["Q1", "Team SSOT", "Activated teams", 120],
          ["Q2", "Living links", "Artifacts w/ link", "35%"],
          ["Q3", "Visual pages", "Pages created", 800],
          ["Q4", "Pricing", "Net revenue retention", "118%"],
        ],
      },
      deck: {
        title: "Board Update",
        slides: [
          titleSlide("Product Strategy 2026", "Board update"),
          bulletsSlide("Three bets", ["Team source of truth", "Living links", "Visual HTML pages"]),
          statsSlide("Where we're headed", [
            { value: "120", label: "Activated teams" },
            { value: "118%", label: "NRR target" },
            { value: "3", label: "Core bets" },
          ]),
        ],
      },
      page: buildVisualPage({
        kicker: "Strategy on a page",
        title: "2026 Product Strategy",
        subtitle: "Three bets, one north star: activated teams who live in Drafta.",
        accent: "#2a6dfb",
        stats: [
          { value: "120", label: "Activated teams (Q1)" },
          { value: "35%", label: "Artifacts w/ a live link" },
          { value: "118%", label: "Net revenue retention" },
        ],
        sections: [
          { tag: "Bet 1", heading: "Team source of truth", body: "Shared project memory + living links so a team's work stays true to source." },
          { tag: "Bet 2", heading: "Living links", body: "A number in a deck is the cell in the sheet — change the source, everything updates." },
          { tag: "Bet 3", heading: "Visual HTML pages", body: "Turn any document into a designed, interactive page in one click." },
          { tag: "Pricing", heading: "Seat-based", body: "Generous usage, priced per seat — teams expand as they invite." },
        ],
      }),
      teammate: false,
    },
    {
      title: "Content Engine",
      description: "Editorial calendar, campaign notes, and a shareable one-pager.",
      projectType: "Marketing",
      purpose: "Run a consistent content engine: plan, produce, and report from one place.",
      audience: "Growth + content team",
      voice: "Punchy, useful, no fluff",
      client: null,
      timeline: "Always-on",
      ku: {
        title: "Campaign Notes — Launch Week",
        content:
          "# Launch Week — Content Plan\n\n## Theme\n\"Stop copy-pasting from ChatGPT.\"\n\n## Channels\n- LinkedIn (founder POV)\n- X thread (build-in-public)\n- Newsletter\n\n## Cadence\nDaily for 5 days, recap on day 6.",
      },
      table: {
        title: "Editorial Calendar",
        rows: [
          ["Date", "Channel", "Topic", "Owner", "Status"],
          ["Mon", "LinkedIn", "Why one source of truth", "Sam", "Draft"],
          ["Tue", "X", "Living links demo", "Sam", "Scheduled"],
          ["Wed", "Newsletter", "Visual pages", "Lee", "Idea"],
          ["Thu", "LinkedIn", "Customer story", "Sam", "Idea"],
        ],
      },
      deck: {
        title: "Campaign Readout",
        slides: [
          titleSlide("Launch Week", "Content readout"),
          bulletsSlide("What shipped", ["5 posts", "1 thread", "1 newsletter"]),
          statsSlide("Results", [
            { value: "240k", label: "Impressions" },
            { value: "3.1%", label: "CTR" },
            { value: "+412", label: "Signups" },
          ]),
        ],
      },
      page: buildVisualPage({
        kicker: "Campaign one-pager",
        title: "Launch Week — Content Engine",
        subtitle: "One theme, five days, every channel — and the numbers that came back.",
        accent: "#9061ff",
        stats: [
          { value: "240k", label: "Impressions" },
          { value: "3.1%", label: "Click-through" },
          { value: "+412", label: "Signups" },
        ],
        sections: [
          { tag: "Theme", heading: "Stop copy-pasting from ChatGPT", body: "One sharp message carried across every channel for the week." },
          { tag: "Channels", heading: "LinkedIn · X · Newsletter", body: "Founder POV on LinkedIn, build-in-public on X, depth in the newsletter." },
          { tag: "Cadence", heading: "Daily for five days", body: "A post a day, then a recap — momentum without burning the team out." },
          { tag: "Result", heading: "412 new signups", body: "240k impressions at a 3.1% CTR drove the best week of the quarter." },
        ],
      }),
      teammate: false,
    },
  ];

  for (const def of defs) {
    const projectId = nanoid();
    await db.insert(projects).values({
      id: projectId,
      userId: admin.id,
      title: def.title,
      description: def.description,
      projectType: def.projectType,
      purpose: def.purpose,
      audience: def.audience,
      voice: def.voice,
      client: def.client,
      timeline: def.timeline,
      status: "active",
      updatedAt: ago(20),
    });

    // Owner membership
    await db.insert(projectMembers).values({ id: nanoid(), projectId, userId: admin.id, role: "owner", status: "active" });

    const kuId = nanoid();
    await db.insert(knowledgeUnits).values({
      id: kuId, projectId, title: def.ku.title, content: def.ku.content, updatedAt: ago(40),
    });
    await db.insert(projectTables).values({
      id: nanoid(), projectId, title: def.table.title, sheets: sheetFromRows("Sheet1", def.table.rows), updatedAt: ago(30),
    });
    await db.insert(projectDecks).values({
      id: nanoid(), projectId, title: def.deck.title, theme: "light", slides: def.deck.slides, updatedAt: ago(25),
    });
    await db.insert(projectPages).values({
      id: nanoid(), projectId, title: `${def.title.split("—")[0].trim()} — Visual`, html: def.page, editableFields: [], sourceKuId: kuId, updatedAt: ago(10),
    });

    // Activity feed
    await db.insert(activityEvents).values([
      { id: nanoid(), projectId, actorId: admin.id, verb: "created", entityType: "ku", meta: { title: def.ku.title }, createdAt: ago(40) },
      { id: nanoid(), projectId, actorId: admin.id, verb: "created", entityType: "deck", meta: { title: def.deck.title }, createdAt: ago(25) },
      { id: nanoid(), projectId, actorId: admin.id, verb: "created", entityType: "page", meta: { title: "Visual page" }, createdAt: ago(10) },
    ]);

    // Teammate + a couple of uploaded files on the flagship project
    if (def.teammate) {
      await db.insert(projectMembers).values({ id: nanoid(), projectId, userId: maya.id, role: "editor", invitedBy: admin.id, status: "active" });
      await db.insert(activityEvents).values({ id: nanoid(), projectId, actorId: admin.id, verb: "invited", meta: { email: TEAMMATE_EMAIL }, createdAt: ago(35) });
      await db.insert(files).values([
        { id: nanoid(), userId: admin.id, projectId, blobUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", originalName: "Acme-brand-audit.pdf", mimeType: "application/pdf", bytes: 184320, extractedTextLength: 4200 },
        { id: nanoid(), userId: admin.id, projectId, blobUrl: "https://file-examples.com/storage/fe/2017/02/file-sample_100kB.docx", originalName: "Stakeholder-interviews.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: 102400, extractedTextLength: 8800 },
      ]);
    }

    console.log(`[seed] Created "${def.title}"`);
  }

  console.log(`[seed] Done. ${defs.length} demo projects for ${ADMIN_EMAIL}.`);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
