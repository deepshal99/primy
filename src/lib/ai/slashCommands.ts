/**
 * Magic slash commands — registry of one-shot AI generators.
 *
 * Each command provides:
 *   - Menu metadata (label, description, icon, tier)
 *   - A `systemPromptFor(ctx)` function that returns a focused
 *     augmentation appended AFTER the base SYSTEM_PROMPT. The
 *     augmentation specifies WHAT to produce (structure, tone,
 *     output block) — operation block conventions are owned by
 *     the base prompt and must not be redefined here.
 *
 * Plan tiers:
 *   - "starter" — available on free + pro
 *   - "pro" — gated to pro plan; PLAN_LIMITS.fullSlashCommands enables
 *
 * Slash commands ARE NOT a separate metered resource — they share the
 * same aiMessages counter through the chat endpoint.
 */
import {
  FileText,
  BarChart3,
  Mail,
  Briefcase,
  Calendar,
  Notebook,
  FileSignature,
  Layout,
  ChartLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SlashCommandTier = "starter" | "pro";

export interface SlashCommand {
  /** Identifier and trigger text after `/`. e.g. "proposal" → "/proposal" */
  name: string;
  /** Short label shown in the menu */
  label: string;
  /** Brief description shown beside the label */
  description: string;
  /** Lucide icon for the menu */
  icon: LucideIcon;
  /** Plan tier required to run this command */
  tier: SlashCommandTier;
  /**
   * Returns the system-prompt augmentation. Composed AFTER the base
   * system prompt. Receives optional context for personalization.
   * Must stay under ~400 words.
   */
  systemPromptFor: (ctx?: { projectTitle?: string }) => string;
  /** Operation types this command typically produces — used for UX hints */
  expectedOps: ("docops" | "sheetops" | "deckops" | "kuops" | "tableops")[];
}

const proj = (ctx?: { projectTitle?: string }) =>
  ctx?.projectTitle ? `"${ctx.projectTitle}"` : "the current project";

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Starter set (free + pro) ───────────────────────────────────────────
  {
    name: "proposal",
    label: "Proposal",
    description: "Draft a project proposal with scope, deliverables, and pricing",
    icon: Briefcase,
    tier: "starter",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /proposal

The user invoked /proposal. Produce a polished, client-ready project proposal as a SINGLE document using \`\`\`kuops\`\`\` CREATE — never inline text in chat.

Treat the user's slash context as the brief (client name, project type, scope hints). Use ${proj(ctx)} memory and any uploaded files for tone, audience, and specifics. If critical details are missing (price, timeline) make reasonable, clearly-labeled assumptions rather than asking — the user wants output, not an interview.

Required sections, in this order:
1. **Executive Summary** — 2–4 sentences. The problem, the proposed approach, the outcome.
2. **Objectives** — 3–5 bulleted goals tied to measurable outcomes.
3. **Scope of Work** — what is included. Use sub-headings (Discovery / Design / Build / Launch) when relevant. Bulleted, concrete.
4. **Deliverables** — explicit artifacts the client receives. Each as a one-line bullet.
5. **Timeline** — phased table or bulleted weeks. Include start, milestone dates, and final delivery.
6. **Pricing** — itemized line items with subtotals and total. Use a markdown table. State currency.
7. **Terms** — payment schedule (e.g. 50% upfront / 50% on delivery), revisions policy, IP transfer.
8. **Next Steps** — 2–3 actions to move forward. Include a clear CTA (sign, schedule call).

Tone: professional, confident, direct. No filler ("we are excited to..."), no marketing fluff. Specific over generic. Numbers where possible.

Title format: \`Proposal — <Client Name>\` if a client is named, otherwise \`Project Proposal\`.

After the kuops block, include 2–3 follow-up suggestions in a <suggestions> JSON array (e.g. "Add a case study section", "Generate a matching SOW", "Create a project timeline sheet").`,
  },

  {
    name: "brief",
    label: "Brief",
    description: "Create a concise project brief from your notes",
    icon: FileText,
    tier: "starter",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /brief

The user invoked /brief. Produce a tight, one-page project brief as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Use the user's slash context plus ${proj(ctx)} memory, attached files, and any referenced documents. The brief must be skimmable in under a minute.

Required structure:
1. **Project** — one-sentence description of what is being built/done.
2. **Background** — 2–3 sentences on why this matters now.
3. **Goals** — 3 bullets. Each goal is measurable.
4. **Audience** — primary user/customer in one bullet; secondary in another.
5. **Success Metrics** — 2–4 concrete numbers (e.g. "+15% conversion", "<2s p95 load").
6. **Scope** — In: 3–5 bullets. Out: 2–3 bullets. Be explicit about exclusions.
7. **Constraints** — budget, timeline, tech, resourcing. One bullet each that applies.
8. **Risks & Mitigations** — top 2–3 risks with a one-line mitigation each.
9. **Owners** — who is responsible. Use placeholders if unknown ("[Owner TBD]").

Tone: dense, declarative, business-direct. Cut adjectives. Bullets over paragraphs. Aim for ~250–400 words total.

Title format: \`Brief — <Project Name>\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions>.`,
  },

  {
    name: "recap",
    label: "Recap",
    description: "Summarize meeting notes or chat history into a clear recap",
    icon: Notebook,
    tier: "starter",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /recap

The user invoked /recap. Produce a structured meeting/discussion recap as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Source material: the user's slash context (raw notes / transcript), any uploaded files, recent chat history, and ${proj(ctx)} context. Synthesize — do not transcribe verbatim.

Required structure:
1. **Meeting** — one line: title, date (use today if unspecified), attendees if mentioned.
2. **TL;DR** — 2–3 bullets capturing the headline outcomes.
3. **Decisions** — bulleted list of every clear decision made. Each starts with a decisive verb.
4. **Discussion Highlights** — 3–6 bullets covering the substantive points. Group by topic if natural.
5. **Action Items** — markdown table with columns: Action | Owner | Due. Pull owners from the source; use "[Unassigned]" if missing.
6. **Open Questions** — bullets of items left unresolved.
7. **Next Meeting** — date/topic if mentioned, otherwise omit.

Tone: neutral, factual, third-person. No editorializing. Strip filler from quoted speech. Preserve specific names, numbers, and dates from the source.

Title format: \`Recap — <Topic>, <YYYY-MM-DD>\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions> (e.g. "Send recap to attendees", "Track action items in a sheet", "Schedule follow-up").`,
  },

  {
    name: "email",
    label: "Email",
    description: "Draft a professional email or follow-up",
    icon: Mail,
    tier: "starter",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /email

The user invoked /email. Produce a ready-to-send email as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Use the slash context to identify recipient, purpose (intro, follow-up, request, update, decline), and any specific points to hit. Pull from ${proj(ctx)} memory for tone (default to professional but warm) and signature.

Required structure (rendered as plain document content the user will copy):

**Subject:** <clear, specific, under 60 chars — no clickbait, no "Quick question">

**To:** <recipient if known, else placeholder>

---

<Greeting line — match tone>

<Opening: 1 sentence stating purpose. No "I hope this finds you well." filler.>

<Body: 1–3 short paragraphs. Be specific. Include any numbers/dates/links the user provided. Use a tight bulleted list if there are 3+ discrete points.>

<Close: 1 sentence with a clear next step or ask. Make the requested action obvious.>

<Sign-off — Best, / Thanks, — followed by sender name placeholder if not specified>

Rules:
- Keep total length 80–180 words unless the context demands more.
- No exclamation points beyond one. No emojis unless the slash context explicitly uses them.
- Lead with what matters; never bury the ask.
- If the user says "follow-up", reference the prior thread context briefly.

Title format: \`Email — <Subject summary>\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions> (e.g. "Make it shorter", "Add a calendar link", "Draft a reply for if they say no").`,
  },

  // ── Pro set (pro-only) ─────────────────────────────────────────────────
  {
    name: "status",
    label: "Status update",
    description: "Generate this week's status update with progress, risks, and next steps",
    icon: ChartLine,
    tier: "pro",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /status

The user invoked /status. Produce a weekly status update as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Pull source material from the slash context, recent chat, attached files, and ${proj(ctx)} memory. Use today's date for the report period; assume a Monday-to-Friday cadence if no other cadence is implied.

Required structure:
1. **Period** — one line: project name and date range (e.g. "Week of MMM D – MMM D").
2. **Status** — single colored indicator: 🟢 On Track / 🟡 At Risk / 🔴 Off Track. Choose based on the source — default to 🟢 if neutral.
3. **Highlights** — 3–5 bullets of what shipped or progressed this period. Lead with verbs: "Shipped...", "Decided...", "Hired...".
4. **Metrics** — 3–5 KPIs with this-period vs last-period or vs target. Render as a small markdown table: Metric | Now | Δ. If real data isn't available, use placeholders like "[TBD]" rather than fabricating.
5. **Risks** — 2–3 risks. Each as: risk → impact → mitigation, all on one line.
6. **Next Week** — 3–5 bullets of priorities for the upcoming period.
7. **Asks** — anything the team needs from leadership/stakeholders, or "None this week."

Tone: terse, executive-ready, third-person, no hedging. Cut "we hope to" / "trying to". Replace with "will" or move to Risks.

Title format: \`Status — <Project>, Week of <date>\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions>.`,
  },

  {
    name: "dashboard",
    label: "Dashboard",
    description: "Build a metrics dashboard sheet with KPIs and trends",
    icon: BarChart3,
    tier: "pro",
    expectedOps: ["tableops"],
    systemPromptFor: (ctx) => `## Slash Command: /dashboard

The user invoked /dashboard. Produce a metrics dashboard as a NEW spreadsheet via \`\`\`tableops\`\`\` CREATE — never sheetops, never inline.

Use the slash context to determine dashboard topic (e.g. "SaaS metrics", "marketing funnel", "weekly KPIs"). Pull from ${proj(ctx)} memory and any referenced sheets or files for actual numbers when available. If numbers are not provided, use realistic illustrative values and label them clearly in a Notes column.

Sheet structure (use celldata format with proper styling):
- **Row 0**: Bold header row with bg color (e.g. "#1a1a2e") and white text. Columns: Metric | Last Period | This Period | Δ % | Target | Status | Notes.
- **Rows 1–N**: One row per KPI. Pick 8–12 KPIs appropriate to the topic. Examples for SaaS: MRR, ARR, New MRR, Churn %, NRR, CAC, LTV, Gross Margin, Active Users, NPS.
- **Status column**: use "On Track" / "At Risk" / "Behind" text values.
- **Δ % column**: include the formula form when computable (e.g. "=((C2-B2)/B2)*100"), formatted as percentage.
- **Last data row + 2**: a small "Insights" header in bold, followed by 2–3 short bullet rows summarizing the picture.

Set column widths via config.columnlen for readability (Metric column wider, ~180; numeric columns ~110; Notes ~220).

After the tableops block, write a single sentence in chat describing what was built, then 2–3 follow-up suggestions in <suggestions> (e.g. "Add a chart", "Generate a status report from these metrics").`,
  },

  {
    name: "agenda",
    label: "Agenda",
    description: "Create a structured meeting agenda with timing",
    icon: Calendar,
    tier: "pro",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /agenda

The user invoked /agenda. Produce a structured meeting agenda as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Use the slash context for meeting topic, attendees, total duration. Default to 30 minutes if unspecified. Pull from ${proj(ctx)} memory for relevant context.

Required structure:
1. **Meeting** — title, date (today if unspecified), duration, attendees (or roles if names unknown).
2. **Goal** — one sentence: what success looks like by the end.
3. **Pre-reads** — bulleted list of docs/links to review beforehand, or "None" if unnecessary.
4. **Agenda** — markdown table with columns: # | Time | Topic | Owner | Outcome. Each row is one item. Time column is duration in minutes (e.g. "5 min"). Total minutes must sum to the meeting duration. Always include a 2–5 minute opener (kickoff/context) and a 3–5 minute closer (recap & action items).
5. **Decisions Needed** — bulleted list of explicit decisions to lock in.
6. **Parking Lot** — header line with empty bullet for items that come up but aren't on-agenda.

Tone: action-oriented. Each topic owner is named (or "[Owner]"). Each Outcome is a verb-led result ("Align on launch date", "Approve budget").

Title format: \`Agenda — <Topic>, <YYYY-MM-DD>\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions> (e.g. "Send invite text for this meeting", "Draft a recap template").`,
  },

  {
    name: "qbr",
    label: "QBR",
    description: "Quarterly business review deck — wins, metrics, plan",
    icon: Layout,
    tier: "pro",
    expectedOps: ["deckops"],
    systemPromptFor: (ctx) => `## Slash Command: /qbr

The user invoked /qbr. Produce a Quarterly Business Review as a presentation via \`\`\`deckops\`\`\` CREATE — follow the deck operation conventions defined elsewhere in this prompt.

Use the slash context to identify quarter, company/team, audience. Pull from ${proj(ctx)} memory and any referenced sheets for actual metrics. Use today's date to infer the "current quarter" if unspecified; otherwise summarize the prior completed quarter.

Required slides, in this order (10–12 slides total):
1. **Cover** — Title: "Q<n> <YYYY> Business Review". Subtitle: company/team, presenter, date.
2. **Agenda** — 4–6 bullets of what will be covered.
3. **Quarter at a Glance** — 3–4 large stat callouts (the headline numbers).
4. **Wins** — 3–5 specific accomplishments with concrete impact.
5. **Metrics Deep-Dive** — KPI table or chart-style slide. Compare vs last quarter and vs target.
6. **Customer / Pipeline** — qualitative + quantitative customer signal (NPS, churn, deals closed, named logos).
7. **Challenges** — honest list of 2–3 underperforming areas with root cause.
8. **Lessons Learned** — what we'll do differently. 3 bullets.
9. **Next Quarter Priorities** — 3–5 prioritized initiatives, each with one-line description.
10. **Asks / Risks** — what the team needs and what could derail next quarter.
11. **Thank You** — closing slide with contact / Q&A.

Tone: confident, executive, data-led. Lead each slide with the headline takeaway, supporting points underneath. Numbers > adjectives.

Use a clean, professional theme — neutral background, restrained accent color. After the deckops block, write a single sentence in chat summarizing what was created, then 2–3 follow-up suggestions in <suggestions>.`,
  },

  {
    name: "contract",
    label: "Contract",
    description: "Draft a service agreement or SOW with standard sections",
    icon: FileSignature,
    tier: "pro",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /contract

The user invoked /contract. Produce a service agreement / SOW draft as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Use the slash context to identify the parties, service type, fee, and term. Pull from ${proj(ctx)} memory for any default terms. Where specific values aren't provided, use clear bracketed placeholders like [Client Name], [$Amount], [Start Date] — do not invent numbers.

CRITICAL: Open the document with this disclaimer block:
> **DRAFT — NOT LEGAL ADVICE.** This is a starting template. Have an attorney review before signing.

Required sections, in this order:
1. **Parties** — Service Provider (with address placeholder) and Client (with address placeholder).
2. **Effective Date** — and term length.
3. **Services** — clear paragraph describing what will be performed. Reference an attached Statement of Work / Scope if extensive.
4. **Scope of Work** — bulleted deliverables. Be specific.
5. **Fees and Payment** — total fee, payment schedule, late-payment terms (e.g. "1.5%/month"), expense reimbursement policy.
6. **Term and Termination** — duration, notice period for termination for convenience (e.g. 30 days), termination for cause clause.
7. **Intellectual Property** — who owns the deliverables on full payment; pre-existing IP carve-out.
8. **Confidentiality** — mutual NDA-style clause.
9. **Warranties and Disclaimers** — services provided "as-is" beyond explicit warranties; limitation of liability capped at fees paid.
10. **Independent Contractor** — clarifies non-employment relationship.
11. **Governing Law** — [State/Country] placeholder.
12. **Entire Agreement** — supersedes prior discussions.
13. **Signatures** — two signature blocks: Service Provider and Client. Lines for printed name, title, signature, date.

Tone: plain English where possible, formal where legal precision matters. Short paragraphs. Numbered subclauses are fine.

Title format: \`Service Agreement — <Client> & <Provider>\` (or [Client] / [Provider] if unknown).

After the kuops block, output 2–3 follow-up suggestions in <suggestions> (e.g. "Add a non-solicit clause", "Generate a separate SOW", "Tighten the IP section").`,
  },

  {
    name: "onepager",
    label: "One-pager",
    description: "Concise one-page strategy doc with positioning, key facts, ask",
    icon: Layout,
    tier: "pro",
    expectedOps: ["kuops"],
    systemPromptFor: (ctx) => `## Slash Command: /onepager

The user invoked /onepager. Produce a punchy strategy one-pager as a SINGLE document via \`\`\`kuops\`\`\` CREATE.

Use the slash context to identify the subject (product, initiative, pitch). Pull from ${proj(ctx)} memory and attached files. Total length: 350–500 words. Every word earns its place.

Required structure:
1. **Headline** — large, sharp statement (≤12 words) capturing the core idea or positioning.
2. **Sub-headline** — one sentence elaborating the headline. Concrete and specific.
3. **The Problem** — 2–3 sentences. Real, named pain. Avoid generic "in today's fast-paced world" framing.
4. **The Solution / Approach** — 2–4 sentences. What it is, how it works at a high level, what makes it different.
5. **Why Now** — 1–2 sentences on the inflection point making this timely.
6. **Key Facts** — 3–5 bullets of the most important data points (market size, traction, team credentials, partner names — only what is provided/justified).
7. **How It Works** — 3 numbered steps (≤15 words each) walking through the user/customer journey.
8. **Why Us** — 2–3 bullets on differentiators or unfair advantages.
9. **The Ask** — one sentence closing line stating exactly what the reader should do next (invest, sign, partner, approve).

Style: bold headers, short lines, no fluff. Numbers and named entities over abstractions. Each section is scannable in under 5 seconds.

Title format: \`<Subject> — One-pager\`.

After the kuops block, output 2–3 follow-up suggestions in <suggestions> (e.g. "Make a deck version", "Tighten The Problem section", "Add a competitor table").`,
  },
];

/** Look up a slash command by name. Case-insensitive. */
export function getSlashCommand(name: string): SlashCommand | undefined {
  if (!name) return undefined;
  const target = name.toLowerCase();
  return SLASH_COMMANDS.find((c) => c.name.toLowerCase() === target);
}

/**
 * Slash commands available for a given plan.
 * - free: starter set only
 * - pro: all commands
 *
 * Pro commands ARE returned for free users so the menu can render
 * them muted with a "PRO" pill — gating happens server-side.
 */
export function availableSlashCommands(plan: "free" | "pro"): SlashCommand[] {
  if (plan === "pro") return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.tier === "starter");
}

/** All commands, regardless of plan — used for menu rendering with gating UI. */
export function allSlashCommands(): SlashCommand[] {
  return SLASH_COMMANDS;
}
