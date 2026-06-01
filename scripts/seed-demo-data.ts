/**
 * Seed fresh demo data for the local dev admin (admin@primy.local).
 *
 * Wipes the admin's existing projects, then creates a set of realistic team
 * workspaces — each with in-project FOLDERS plus documents, spreadsheets,
 * decks, and HTML visual pages (filed into folders, with real content),
 * owner + teammate membership, activity events, and a couple of file rows.
 * Idempotent: re-running rebuilds the demo set from scratch.
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
  folders,
  knowledgeUnits,
  projectTables,
  projectDecks,
  projectPages,
  projectMembers,
  activityEvents,
  files,
} from "@/db/schema";

const ADMIN_EMAIL = "admin@primy.local";
const TEAMMATE_EMAIL = "maya@primy.local";

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
  <p class="foot">Primy · living document — edits to the source keep this page in sync</p>
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

type SlideT = ReturnType<typeof titleSlide> | ReturnType<typeof bulletsSlide> | ReturnType<typeof statsSlide>;
type PageOpts = Parameters<typeof buildVisualPage>[0];

interface FolderDef { key: string; name: string; color: string }
interface KuDef { title: string; content: string; folder?: string }
interface TableDef { title: string; rows: (string | number)[][]; folder?: string }
interface DeckDef { title: string; slides: SlideT[]; folder?: string }
interface PageDef { title: string; opts: PageOpts; folder?: string }
interface ProjectDef {
  title: string; description: string; projectType: string; purpose: string;
  audience: string; voice: string; client: string | null; timeline: string; teammate: boolean;
  folders: FolderDef[]; kus: KuDef[]; tables: TableDef[]; decks: DeckDef[]; pages: PageDef[];
}

const F = { blue: "#4285F4", green: "#42c366", amber: "#FFB43F", purple: "#8757D7", pink: "#F073A7", teal: "#67CEC8", orange: "#FF7A2F" };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[seed] DATABASE_URL not set. Aborting.");
    process.exit(1);
  }
  const db = drizzle(neon(url));

  const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (!admin) {
    console.error(`[seed] ${ADMIN_EMAIL} not found. Run: npm run dev:admin first.`);
    process.exit(1);
  }

  let [maya] = await db.select().from(users).where(eq(users.email, TEAMMATE_EMAIL)).limit(1);
  if (!maya) {
    const passwordHash = await bcrypt.hash("maya", 12);
    [maya] = await db
      .insert(users)
      .values({ id: nanoid(), name: "Maya Chen", email: TEAMMATE_EMAIL, passwordHash, plan: "pro", hasOnboarded: true })
      .returning();
    console.log("[seed] Created teammate maya@primy.local");
  }

  // Wipe admin's existing projects (cascades to folders/entities/members/activity/files)
  const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, admin.id));
  if (existing.length > 0) {
    await db.delete(projects).where(inArray(projects.id, existing.map((p) => p.id)));
    console.log(`[seed] Removed ${existing.length} existing admin project(s).`);
  }

  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);
  const page = (kicker: string, title: string, subtitle: string, accent: string, stats: Stat[], sections: Section[]): PageOpts =>
    ({ kicker, title, subtitle, accent, stats, sections });

  const defs: ProjectDef[] = [
    {
      title: "Acme Rebrand — Q3 Launch",
      description: "Client engagement: rebrand strategy, launch budget, and the kickoff deck.",
      projectType: "Design", purpose: "Deliver Acme's Q3 rebrand: positioning, identity, and a launch plan the whole team works from.",
      audience: "Acme leadership + our delivery pod", voice: "Confident, warm, precise", client: "Acme Inc.", timeline: "Launch Sept 30", teammate: true,
      folders: [
        { key: "strategy", name: "Strategy", color: F.blue },
        { key: "assets", name: "Brand Assets", color: F.purple },
        { key: "launch", name: "Launch", color: F.amber },
      ],
      kus: [
        { folder: "strategy", title: "Creative Brief", content: "# Acme Rebrand — Creative Brief\n\n## The problem\nAcme reads as dated and enterprise-heavy. Younger buyers bounce.\n\n## The idea\nReposition Acme as the **approachable expert** — sharp, warm, human.\n\n## Deliverables\n- New wordmark + palette\n- Messaging house\n- Launch site + deck\n\n## Success\nLift demo-request conversion by 25% within 60 days of launch." },
        { folder: "strategy", title: "Messaging House", content: "# Messaging House\n\n## Promise\nThe approachable expert.\n\n## Pillars\n1. **Warmth** — human, never corporate\n2. **Authority** — we've done this 100 times\n3. **Speed** — from idea to live in days\n\n## Proof points\n- 4.9★ across 200 reviews\n- 60-day average time-to-value\n- Used by 3 Fortune-500 teams" },
      ],
      tables: [
        { folder: "launch", title: "Launch Budget", rows: [["Workstream", "Owner", "Budget", "Status"], ["Brand identity", "Maya", 18000, "In progress"], ["Launch site", "Dev pod", 24000, "Scoping"], ["Paid launch", "Growth", 30000, "Planned"], ["Total", "", 72000, ""]] },
      ],
      decks: [
        { folder: "strategy", title: "Kickoff Deck", slides: [titleSlide("Acme Rebrand", "Q3 Launch — kickoff"), bulletsSlide("Why now", ["Brand reads dated", "Buyers skew younger", "Competitors feel warmer"]), statsSlide("Targets", [{ value: "+25%", label: "Demo conversion" }, { value: "60d", label: "To impact" }, { value: "3", label: "Deliverables" }])] },
      ],
      pages: [
        { folder: "assets", title: "Acme — Visual", opts: page("Creative Brief", "Acme Rebrand — at a glance", "The approachable expert: sharp, warm, human. Everything the pod needs on one page.", "#FF7A2F", [{ value: "+25%", label: "Demo conversion goal" }, { value: "$72k", label: "Launch budget" }, { value: "Sept 30", label: "Go-live" }], [{ tag: "Problem", heading: "Dated & enterprise-heavy", body: "Acme reads cold to younger buyers, who bounce before booking a demo." }, { tag: "Idea", heading: "The approachable expert", body: "Reposition around warmth + authority: confident, human, never corporate." }, { tag: "Deliverables", heading: "Identity → Site → Deck", body: "New wordmark and palette, a messaging house, and a launch site + deck." }, { tag: "Success", heading: "Conversion, in 60 days", body: "Lift demo-request conversion 25% within two months of launch." }]) },
      ],
    },
    {
      title: "Product Strategy 2026",
      description: "PRD, roadmap metrics, and the board update — one source of truth.",
      projectType: "Research", purpose: "Align the team on the 2026 product bets and the metrics that prove them.",
      audience: "Founders, eng leads, board", voice: "Direct, evidence-led", client: null, timeline: "Board review — Feb", teammate: false,
      folders: [
        { key: "planning", name: "Planning", color: F.blue },
        { key: "metrics", name: "Metrics", color: F.green },
      ],
      kus: [
        { folder: "planning", title: "2026 PRD — North Star", content: "# 2026 Product Strategy\n\n## North star\nActivated teams (2+ members, 3+ artifacts in week 1).\n\n## Bets\n1. **Team SSOT** — shared memory + living links\n2. **Visual pages** — docs become interactive HTML\n3. **Seat-based pricing**\n\n## Non-goals\nNative mobile, SSO/enterprise — revisit post-traction." },
      ],
      tables: [
        { folder: "metrics", title: "Roadmap Metrics", rows: [["Quarter", "Bet", "Metric", "Target"], ["Q1", "Team SSOT", "Activated teams", 120], ["Q2", "Living links", "Artifacts w/ link", "35%"], ["Q3", "Visual pages", "Pages created", 800], ["Q4", "Pricing", "Net revenue retention", "118%"]] },
      ],
      decks: [
        { folder: "planning", title: "Board Update", slides: [titleSlide("Product Strategy 2026", "Board update"), bulletsSlide("Three bets", ["Team source of truth", "Living links", "Visual HTML pages"]), statsSlide("Where we're headed", [{ value: "120", label: "Activated teams" }, { value: "118%", label: "NRR target" }, { value: "3", label: "Core bets" }])] },
      ],
      pages: [
        { title: "Strategy — Visual", opts: page("Strategy on a page", "2026 Product Strategy", "Three bets, one north star: activated teams who live in Primy.", "#4285F4", [{ value: "120", label: "Activated teams (Q1)" }, { value: "35%", label: "Artifacts w/ a live link" }, { value: "118%", label: "Net revenue retention" }], [{ tag: "Bet 1", heading: "Team source of truth", body: "Shared project memory + living links so a team's work stays true to source." }, { tag: "Bet 2", heading: "Living links", body: "A number in a deck is the cell in the sheet — change the source, everything updates." }, { tag: "Bet 3", heading: "Visual HTML pages", body: "Turn any document into a designed, interactive page in one click." }, { tag: "Pricing", heading: "Seat-based", body: "Generous usage, priced per seat — teams expand as they invite." }]) },
      ],
    },
    {
      title: "Content Engine",
      description: "Editorial calendar, campaign notes, and a shareable one-pager.",
      projectType: "Marketing", purpose: "Run a consistent content engine: plan, produce, and report from one place.",
      audience: "Growth + content team", voice: "Punchy, useful, no fluff", client: null, timeline: "Always-on", teammate: false,
      folders: [
        { key: "calendar", name: "Calendar", color: F.amber },
        { key: "reports", name: "Reports", color: F.pink },
      ],
      kus: [
        { folder: "calendar", title: "Campaign Notes — Launch Week", content: "# Launch Week — Content Plan\n\n## Theme\n\"Stop copy-pasting from ChatGPT.\"\n\n## Channels\n- LinkedIn (founder POV)\n- X thread (build-in-public)\n- Newsletter\n\n## Cadence\nDaily for 5 days, recap on day 6." },
      ],
      tables: [
        { folder: "calendar", title: "Editorial Calendar", rows: [["Date", "Channel", "Topic", "Owner", "Status"], ["Mon", "LinkedIn", "Why one source of truth", "Sam", "Draft"], ["Tue", "X", "Living links demo", "Sam", "Scheduled"], ["Wed", "Newsletter", "Visual pages", "Lee", "Idea"], ["Thu", "LinkedIn", "Customer story", "Sam", "Idea"]] },
      ],
      decks: [
        { folder: "reports", title: "Campaign Readout", slides: [titleSlide("Launch Week", "Content readout"), bulletsSlide("What shipped", ["5 posts", "1 thread", "1 newsletter"]), statsSlide("Results", [{ value: "240k", label: "Impressions" }, { value: "3.1%", label: "CTR" }, { value: "+412", label: "Signups" }])] },
      ],
      pages: [
        { folder: "reports", title: "Launch Week — Visual", opts: page("Campaign one-pager", "Launch Week — Content Engine", "One theme, five days, every channel — and the numbers that came back.", "#8757D7", [{ value: "240k", label: "Impressions" }, { value: "3.1%", label: "Click-through" }, { value: "+412", label: "Signups" }], [{ tag: "Theme", heading: "Stop copy-pasting from ChatGPT", body: "One sharp message carried across every channel for the week." }, { tag: "Channels", heading: "LinkedIn · X · Newsletter", body: "Founder POV on LinkedIn, build-in-public on X, depth in the newsletter." }, { tag: "Cadence", heading: "Daily for five days", body: "A post a day, then a recap — momentum without burning the team out." }, { tag: "Result", heading: "412 new signups", body: "240k impressions at a 3.1% CTR drove the best week of the quarter." }]) },
      ],
    },
    {
      title: "Investor Update — Series A",
      description: "The narrative, the numbers, and the deck for the Series A round.",
      projectType: "Finance", purpose: "Tell a crisp Series A story backed by clean metrics the partners can trust.",
      audience: "Existing investors + new partners", voice: "Calm, candid, numbers-first", client: null, timeline: "Send first week of March", teammate: true,
      folders: [
        { key: "narrative", name: "Narrative", color: F.purple },
        { key: "numbers", name: "Numbers", color: F.green },
      ],
      kus: [
        { folder: "narrative", title: "Investor Memo", content: "# Series A — Investor Memo\n\n## TL;DR\nGrowing 18% MoM, $1.4M ARR, raising $8M to own the team-SSOT category.\n\n## Why now\nAI made content cheap; teams drown in scattered docs. We're the source of truth.\n\n## The ask\n$8M at a $42M post — 18 months of runway to 10k activated teams.\n\n## Risks\n- Incumbents bolt on AI → we win on coherence, not features.\n- Hiring pace → 6 key roles already in pipeline." },
      ],
      tables: [
        { folder: "numbers", title: "KPI Dashboard", rows: [["Metric", "Q4", "Q1", "Target"], ["ARR", "$0.9M", "$1.4M", "$3M"], ["MoM growth", "12%", "18%", "15%"], ["Net retention", "104%", "111%", "120%"], ["Activated teams", 60, 128, 400]] },
        { folder: "numbers", title: "Cap Table (Pre-A)", rows: [["Holder", "Shares", "% Owned"], ["Founders", 6500000, "65%"], ["Seed investors", 2000000, "20%"], ["Option pool", 1500000, "15%"]] },
      ],
      decks: [
        { folder: "narrative", title: "Series A Deck", slides: [titleSlide("Primy", "Series A — the source of truth for teams"), bulletsSlide("Why we win", ["Coherence, not feature soup", "Living links across docs/sheets/decks", "Project memory that compounds"]), statsSlide("Traction", [{ value: "$1.4M", label: "ARR" }, { value: "18%", label: "MoM growth" }, { value: "111%", label: "Net retention" }])] },
      ],
      pages: [
        { title: "Update — Visual", opts: page("Investor update", "Series A — at a glance", "18% MoM, $1.4M ARR, raising $8M to own the category.", "#9B78D8", [{ value: "$1.4M", label: "ARR" }, { value: "18%", label: "MoM growth" }, { value: "$8M", label: "Raising" }], [{ tag: "Story", heading: "The source of truth", body: "Teams drown in scattered docs; we make one coherent, living workspace." }, { tag: "Numbers", heading: "Clean and climbing", body: "$1.4M ARR, 111% net retention, 128 activated teams and accelerating." }, { tag: "Ask", heading: "$8M at $42M post", body: "18 months of runway to 10k activated teams and category ownership." }, { tag: "Team", heading: "Hiring six key roles", body: "Pipeline already full for the leaders who get us to the next stage." }]) },
      ],
    },
    {
      title: "Hiring — Eng 2026",
      description: "Roles, interview rubric, and the candidate pipeline for the year.",
      projectType: "People", purpose: "Hire 6 engineers in 2026 with a fair, fast, consistent process.",
      audience: "Hiring managers + interviewers", voice: "Structured, humane", client: null, timeline: "Rolling", teammate: false,
      folders: [
        { key: "roles", name: "Roles", color: F.blue },
        { key: "pipeline", name: "Pipeline", color: F.teal },
      ],
      kus: [
        { folder: "roles", title: "Hiring Plan 2026", content: "# Eng Hiring Plan — 2026\n\n## Headcount\n6 engineers: 3 product, 2 platform, 1 design-eng.\n\n## Priorities\n1. Senior product eng (Q1)\n2. Platform/infra (Q2)\n3. Design engineer (Q2)\n\n## Sourcing\n- Referrals first (40% of hires)\n- Targeted outbound\n- 2 trusted agencies" },
        { folder: "roles", title: "Interview Rubric", content: "# Interview Rubric\n\n## Signals (1–4)\n- **Problem solving** — decomposes ambiguity\n- **Craft** — clean, tested, readable\n- **Collaboration** — raises the room\n- **Ownership** — drives to done\n\n## Bar\nAvg ≥ 3.0 with no 1s. Two yeses required to advance." },
      ],
      tables: [
        { folder: "pipeline", title: "Candidate Pipeline", rows: [["Candidate", "Role", "Stage", "Owner"], ["A. Rivera", "Sr Product Eng", "Onsite", "Maya"], ["J. Park", "Platform", "Tech screen", "Sam"], ["L. Osei", "Design Eng", "Recruiter", "Lee"], ["M. Singh", "Product Eng", "Offer", "Maya"]] },
      ],
      decks: [
        { folder: "roles", title: "Hiring Kickoff", slides: [titleSlide("Eng Hiring 2026", "Fair, fast, consistent"), bulletsSlide("How we run it", ["Structured rubric", "Two-yes rule", "48h decisions"]), statsSlide("Goal", [{ value: "6", label: "Engineers" }, { value: "40%", label: "From referrals" }, { value: "48h", label: "Decision SLA" }])] },
      ],
      pages: [],
    },
    {
      title: "Customer Research",
      description: "Interview notes, a research log, and synthesized findings.",
      projectType: "Research", purpose: "Turn customer conversations into clear, shared product signal.",
      audience: "Product + design", voice: "Curious, neutral", client: null, timeline: "Ongoing", teammate: false,
      folders: [
        { key: "interviews", name: "Interviews", color: F.orange },
        { key: "synthesis", name: "Synthesis", color: F.teal },
      ],
      kus: [
        { folder: "interviews", title: "Interview — Acme (Maya)", content: "# Interview — Maya, Acme\n\n## Context\nDesign lead, 12-person pod, drowning in Figma + Docs + Slack.\n\n## Pains\n- \"I copy-paste numbers between the deck and the sheet.\"\n- \"Nobody knows which doc is current.\"\n\n## Quote\n> \"If one place was just *true*, I'd move my whole team.\"\n\n## Signal\nStrong pull for living links + one source of truth." },
        { folder: "synthesis", title: "Synthesis — Top Themes", content: "# Synthesis — Top Themes (n=14)\n\n## 1. Source-of-truth anxiety (12/14)\nTeams can't tell which artifact is current.\n\n## 2. Copy-paste tax (11/14)\nNumbers re-typed across deck/sheet/doc.\n\n## 3. Context loss (9/14)\nNew members take weeks to get oriented.\n\n## Implication\nLead with living links + project memory." },
      ],
      tables: [
        { folder: "interviews", title: "Research Log", rows: [["Date", "Person", "Role", "Theme", "Signal"], ["May 2", "Maya", "Design lead", "Source of truth", "Strong"], ["May 4", "Devon", "PM", "Copy-paste tax", "Strong"], ["May 6", "Priya", "Founder", "Context loss", "Medium"], ["May 9", "Theo", "Eng lead", "Living links", "Strong"]] },
      ],
      decks: [],
      pages: [
        { folder: "synthesis", title: "Findings — Visual", opts: page("Research readout", "What customers told us", "Fourteen conversations, three loud themes — and what to build next.", "#67CEC8", [{ value: "14", label: "Interviews" }, { value: "12/14", label: "Source-of-truth pain" }, { value: "3", label: "Clear themes" }], [{ tag: "Theme 1", heading: "Source-of-truth anxiety", body: "Teams can't tell which artifact is current — trust erodes fast." }, { tag: "Theme 2", heading: "The copy-paste tax", body: "The same number gets re-typed across deck, sheet, and doc." }, { tag: "Theme 3", heading: "Context loss", body: "New teammates take weeks to find their footing in scattered files." }, { tag: "Next", heading: "Lead with living links", body: "One coherent workspace where the source updates everything downstream." }]) },
      ],
    },
  ];

  for (const def of defs) {
    const projectId = nanoid();
    await db.insert(projects).values({
      id: projectId, userId: admin.id, title: def.title, description: def.description, projectType: def.projectType,
      purpose: def.purpose, audience: def.audience, voice: def.voice, client: def.client, timeline: def.timeline,
      status: "active", updatedAt: ago(20),
    });
    await db.insert(projectMembers).values({ id: nanoid(), projectId, userId: admin.id, role: "owner", status: "active" });

    // Folders (keyed → id)
    const fid: Record<string, string> = {};
    let pos = 0;
    for (const f of def.folders) {
      const id = nanoid();
      fid[f.key] = id;
      await db.insert(folders).values({ id, projectId, name: f.name, color: f.color, position: pos++, updatedAt: ago(46) });
    }

    let firstKuId = "";
    let i = 0;
    for (const k of def.kus) {
      const id = nanoid();
      if (!firstKuId) firstKuId = id;
      await db.insert(knowledgeUnits).values({ id, projectId, folderId: k.folder ? fid[k.folder] : null, title: k.title, content: k.content, updatedAt: ago(42 - i * 2) });
      i++;
    }
    for (const t of def.tables) {
      await db.insert(projectTables).values({ id: nanoid(), projectId, folderId: t.folder ? fid[t.folder] : null, title: t.title, sheets: sheetFromRows("Sheet1", t.rows), updatedAt: ago(30) });
    }
    for (const d of def.decks) {
      await db.insert(projectDecks).values({ id: nanoid(), projectId, folderId: d.folder ? fid[d.folder] : null, title: d.title, theme: "light", slides: d.slides, updatedAt: ago(25) });
    }
    for (const pg of def.pages) {
      await db.insert(projectPages).values({ id: nanoid(), projectId, folderId: pg.folder ? fid[pg.folder] : null, title: pg.title, html: buildVisualPage(pg.opts), editableFields: [], sourceKuId: firstKuId || null, updatedAt: ago(10) });
    }

    await db.insert(activityEvents).values([
      { id: nanoid(), projectId, actorId: admin.id, verb: "created", entityType: "ku", meta: { title: def.kus[0]?.title ?? "Document" }, createdAt: ago(42) },
      { id: nanoid(), projectId, actorId: admin.id, verb: "created", entityType: "page", meta: { title: "Visual page" }, createdAt: ago(10) },
    ]);

    if (def.teammate) {
      await db.insert(projectMembers).values({ id: nanoid(), projectId, userId: maya.id, role: "editor", invitedBy: admin.id, status: "active" });
      await db.insert(activityEvents).values({ id: nanoid(), projectId, actorId: admin.id, verb: "invited", meta: { email: TEAMMATE_EMAIL }, createdAt: ago(35) });
      await db.insert(files).values([
        { id: nanoid(), userId: admin.id, projectId, blobUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", originalName: "brand-audit.pdf", mimeType: "application/pdf", bytes: 184320, extractedTextLength: 4200 },
        { id: nanoid(), userId: admin.id, projectId, blobUrl: "https://file-examples.com/storage/fe/2017/02/file-sample_100kB.docx", originalName: "stakeholder-interviews.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: 102400, extractedTextLength: 8800 },
      ]);
    }

    console.log(`[seed] Created "${def.title}" (${def.folders.length} folders, ${def.kus.length + def.tables.length + def.decks.length + def.pages.length} files)`);
  }

  console.log(`[seed] Done. ${defs.length} demo workspaces for ${ADMIN_EMAIL}.`);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
