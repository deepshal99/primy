# Drafta v1.0 — Strategy & Execution Spec

**Date:** 2026-05-01
**Status:** Approved (user sign-off)
**Owner:** Deepak Maurya
**Source:** Strategic brainstorming + CEO review session

---

## 1. Positioning (locked)

**Hero:** *"The AI workspace for docs, sheets, and decks."*

**Sub-line:** *"Chat to create and edit them all. Drag in any file. Project memory keeps everything connected — so you never copy-paste from ChatGPT again."*

### Why this line wins

- **Descriptive over abstract.** Anyone reads it once and knows exactly what the product is.
- **Modern vocabulary.** "Docs/sheets/decks" is how founders, marketers, creators, and indie hackers actually talk in 2026 — not "documents/spreadsheets/presentations" (sounds like MS Office).
- **Self-selecting audience.** People who say "deck" instead of "presentation" are the right users.
- **Claims a category nobody owns.** Notion AI is org-first. ChatGPT has no workspaces. Gamma is decks-only. Cursor is code-only. The "AI workspace for docs/sheets/decks" slot is empty.
- **Project memory hook in the sub.** The moat (persistent context) is named without jargon.

### What this positioning is NOT

- ❌ "AI office suite" — invites direct comparison with MS Office and Notion (unwinnable)
- ❌ "AI workspace for project work" — too abstract, doesn't say what the product does
- ❌ "AI workspace for consultants" — too narrow, limits brand identity
- ❌ "AI for everything" — death by broadness

---

## 2. Audience

### Brand-side (universal)

Anyone with project-based work where docs, sheets, and decks are the output:
- Indie founders, makers, indie hackers
- Solo consultants, fractional execs, freelancers, agency-of-one operators
- Marketers (campaigns), researchers (papers), creators (launches)
- Operators, students, course creators

### Beachhead (first 1000 users)

**Indie founders / build-in-public Twitter / IndieHackers community.**

Why:
- Founder credibility (Drafta's author *is* one)
- Free distribution channels (Twitter, IH, Product Hunt)
- High WTP relative to peers
- Loud — they evangelize tools they love
- Naturally overlap with adjacent ICPs (consultants, creators, marketers) → organic spillover

The beachhead never appears in the product brand. It's a GTM channel, not a positioning constraint.

---

## 3. Product scope — what's in v1.0

### Core kept (proven, working, differentiating)

| Component | State | Notes |
|---|---|---|
| **Project workspace** | Built | The unit of context. Each project = its own AI memory + entity collection |
| **Documents (Plate.js v52)** | Built | Rich text + Markdown |
| **Spreadsheets (Univer)** | Built ✅ | Migration from Fortune Sheet already done — CLAUDE.md is outdated |
| **Decks (HTML slide engine + DOMPurify)** | Built | Major recent investment, real differentiator vs. Gamma |
| **AI chat with project memory** | Built | The moat |
| **Embeddings + context relevance** | Built | Powers project-aware AI |
| **File drag-drop + extraction** | Built | The hook on landing page |
| **Cross-entity references / mentions** | Built | Backlinks deck ↔ sheet ↔ doc |
| **Sharing infrastructure (per-entity tokens)** | Built | Public read-only viewers exist |
| **Server-side PDF (Puppeteer)** | Built | Keep — higher fidelity than client-side |
| **OpenAI for chat** | Built | Primary provider |
| **Google for deck-generate only** | Built | Recent commit shows Gemini 3.1 Pro is measurably better for deck generation |

### Cuts (delete in Week 1)

| Cut | Files / deps to remove |
|---|---|
| **Diagrams entity** | `src/components/diagram/*` (7 files), `projectDiagrams` table, diagram operations in `sheetOperations.ts`/store/types, `diagramops` system prompt routing, `@excalidraw/excalidraw`, `@xyflow/react`, `recharts` |
| **Google AI for chat** | Remove from `modelRouter.ts` chat paths. Keep only for `deck-generate` task |
| **Outdated roadmap items** | Remove "Univer migration" from `vision.md` (already done). Remove "Yjs + PartyKit" v1.2 mention from active scope |

`mermaid` dep stays — for inline rendering in docs only (fenced ` ```mermaid ` code blocks).

### Adds for v1.0 (Week 4)

| Feature | Effort | Why |
|---|---|---|
| **Magic slash commands** | 2 days | Killer demo. `/proposal`, `/brief`, `/status`, `/dashboard`, `/recap`, `/agenda`, `/email`, `/qbr`, `/contract`, `/onepager` (~10 total). Each triggers a polished, ready-to-edit artifact in one shot. |
| **Branded share + watermark** | 1 day | "Built with Drafta" pill on free shares; hidden on Pro. Free distribution mechanism (Calendly/Loom/Gamma playbook). |
| **Snapshot history (polish existing undo)** | 2 days | Version timeline panel per artifact. Trust signal — users feel safe letting AI edit. |
| **Onboarding flow** | 2 days | 3-step wired to `users.hasOnboarded`. Pick what you do → 30-sec slash command demo → pre-create example workspace. |
| **Marketing landing page at `/`** | 2 days | Currently login is the entry. Add: hero, 3 features, pricing, footer. The first impression. |
| **Pricing page at `/pricing`** | 1 day | Three columns (Free / Pro / Team coming soon). Built but pricing UI hidden behind feature flag until payment gateway is wired. |

---

## 4. Pricing model

### Plans

```
FREE                              PRO — $24/mo                     TEAM (deferred — v1.2+)
─────────                         ─────────────────                 ──────────────────────
1 workspace                       Unlimited workspaces              $20/seat, 2-seat min
50 AI messages/mo                 1,500 messages/mo                 Shared workspaces
5 file uploads/mo                 Unlimited uploads                 Member roles
500 MB storage                    20 GB storage                     Custom domains for shares
"Built with Drafta" watermark     No watermark                      Priority support
                                  Brand voice + visual profiles
                                  Magic slash commands (full set)
                                  Snapshot history (full)
```

### Implementation strategy: build the system, hide the UI, no gateway yet

**Reason:** Founder is in India. Stripe not available. Will pick gateway later (Razorpay / Cashfree / Paddle / Lemon Squeezy / DodoPayments). System must be gateway-agnostic.

### Build now (Week 2)

**Schema migration (Drizzle):**

```ts
// users — add:
plan: varchar("plan", { length: 20 }).notNull().default("free"),       // "free" | "pro"
gatewayCustomerId: varchar("gateway_customer_id", { length: 100 }),    // gateway-agnostic name
gatewaySubscriptionId: varchar("gateway_subscription_id", { length: 100 }),
planRenewsAt: timestamp("plan_renews_at"),

// new table — usage tracking
export const usage = pgTable("usage", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // "2026-05"
  aiMessages: integer("ai_messages").notNull().default(0),
  fileUploads: integer("file_uploads").notNull().default(0),
  storageBytes: bigint("storage_bytes", { mode: "number" }).notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.month] })]);
```

**Plan limits config (`src/lib/plans.ts`):**

```ts
export const PLAN_LIMITS = {
  free: {
    workspaces: 1,
    aiMessagesPerMonth: 50,
    fileUploadsPerMonth: 5,
    storageBytes: 500 * 1024 * 1024,
    watermarkOnShares: true,
    brandProfiles: false,
    fullSlashCommands: false,
  },
  pro: {
    workspaces: Infinity,
    aiMessagesPerMonth: 1500,
    fileUploadsPerMonth: Infinity,
    storageBytes: 20 * 1024 * 1024 * 1024,
    watermarkOnShares: false,
    brandProfiles: true,
    fullSlashCommands: true,
  },
} as const;
```

**Usage-tracking middleware:**
- Wrap `/api/chat` → increment `aiMessages` after each user message
- Wrap `/api/upload` → increment `fileUploads` and `storageBytes`
- Read user's plan, check limit before processing
- Behavior gated on `process.env.ENFORCE_PLAN_LIMITS === "true"` (default OFF in dev/beta)

**UI components (built but feature-flagged):**
- Settings → Billing tab (shows plan, usage progress bars, "Upgrade" / "Manage subscription") — hidden when flag off
- Limit-reached modal with upgrade CTA — dormant when flag off
- Pricing page at `/pricing` — built but only linked from landing page (easy to remove link)

### Defer until payment gateway picked

- Checkout session endpoint
- Webhook handler (`subscription.created/updated/canceled`)
- Customer portal session for self-serve management

When gateway is wired (single integration after launch):
1. Implement `POST /api/billing/checkout` with chosen gateway
2. Implement `POST /api/billing/webhook` for subscription events
3. Set `ENFORCE_PLAN_LIMITS=true` in production env
4. Entire system activates in one switch flip

### Payment gateway recommendation (when ready)

| Gateway | When to pick |
|---|---|
| **Paddle** ★ | Selling globally to non-Indian customers — handles VAT/GST/tax compliance worldwide as merchant of record |
| **Lemon Squeezy** ★ | Same as Paddle, slightly more indie-friendly |
| **Razorpay** | Indian-first SaaS, INR pricing |
| **Cashfree** | Alt to Razorpay |
| **DodoPayments** | New India-friendly merchant of record |

For Drafta (USD-priced, global audience, India-based founder): **Paddle or Lemon Squeezy.**

### Unit economics (at $24/mo Pro)

- Heavy user (1500 msgs × ~$0.005 OpenAI) = $7.50 cost → $16.50 gross margin = 69%
- Average user (~500 msgs × $0.005) = $2.50 cost → $21.50 margin = 90%

Healthy enough to fund growth on near-zero ad spend.

---

## 5. UI polish — "OpenAI-grade"

Goal: ship something that looks shipped by a professional design team.

### Polish principles

1. **Restraint.** Less color, less chrome, less motion. Whitespace as a feature.
2. **Concentric border radii.** Inner radius < outer radius. Always.
3. **Optical alignment.** Icons next to text nudged 1-2px to look centered.
4. **Tabular numbers.** `font-feature-settings: 'tnum'` in any number column.
5. **Font smoothing globally.** `-webkit-font-smoothing: antialiased`.
6. **Micro-interactions at 120-200ms.** Spring-based, not linear.
7. **Empty states are first-class screens** — illustrated, copy-tuned.
8. **Loading states are designed**, not default spinners.
9. **One bold primary color.** Heat orange. Everything else grayscale + alpha.
10. **Consistent radius/spacing scale:** 4 / 6 / 8 / 12 / 16 / 24 / 32. No 5px, no 11px.

### Polish task list (Week 3)

| Task | What it means |
|---|---|
| Run `/audit` skill | Comprehensive interface quality audit (alignment, spacing, color, motion, a11y). Outputs punch list. |
| Run `/polish` skill | Final consistency pass. |
| Empty states pass | Every "no data" screen — illustrated empty state with friendly copy + clear CTA |
| Loading states pass | Skeleton screens (shimmer/pulse) for project list, message list, sheet load, deck render |
| Onboarding flow | 3-step minimal flow wired to `users.hasOnboarded` |
| Settings modal redesign | Clean tabs: Account / Memory / Billing (hidden) / Danger |
| Share view redesign | Looks like a published artifact: title, breadcrumb, watermark on free, "Try Drafta" CTA |
| Run `/animate` skill | Staggered chat entries, smooth tab transitions, deck slide reveals — all <200ms, spring-based |
| Run `/web-design-guidelines` skill | Final review for compliance |
| Marketing landing at `/` | Hero, 3 features, pricing, footer |
| Pricing page at `/pricing` | Three columns (Free / Pro / Team-soon), built but feature-flagged |
| Typography pass | Inter for body. Optional: Geist or Söhne for hero on landing page |
| Color audit | Heat orange used as the only saturated brand color. Everything else grayscale + alpha. |

---

## 6. Roadmap — what ships when

### v1.0 — public launch (Weeks 1-5)

```
Week 1: Cut & Clean
  ├── Delete diagrams entity (7 files + DB + ops + 3 deps)
  ├── Drop @ai-sdk/google for chat (keep for deck-generate only)
  ├── Update CLAUDE.md (Univer is done, not "planned")
  └── Update vision.md (reflect new positioning + scope)

Week 2: Pricing System (built, hidden)
  ├── Drizzle migration: plan, usage, gateway IDs on users
  ├── src/lib/plans.ts (limits config)
  ├── Usage-tracking middleware on /api/chat, /api/upload
  ├── Settings → Billing tab (feature-flagged)
  ├── Limit-reached modal (dormant)
  └── Plan-aware feature gates (brand profiles, watermark) — set up

Week 3: UI Polish to OpenAI-grade
  ├── /audit pass + punch list resolution
  ├── /polish pass
  ├── Empty states + skeleton loaders
  ├── Onboarding flow (3-step)
  ├── Settings modal redesign
  ├── Share view redesign + watermark
  ├── /animate motion pass
  ├── Marketing landing at /
  └── Pricing page at /pricing (feature-flagged)

Week 4: Launch Features
  ├── Magic slash commands (~10 commands)
  ├── Branded share + watermark
  └── Snapshot history (version timeline panel)

Week 5: Soft Launch
  ├── Twitter announcement (build-in-public)
  ├── 50 hand-picked beta users (Pro features unlocked free during beta)
  └── Collect testimonials, screenshots, feedback

Week 6: Public Launch
  ├── Product Hunt + IndieHackers + LinkedIn organic
  ├── Pick payment gateway, wire it (Paddle/Lemon Squeezy/Razorpay)
  ├── Set ENFORCE_PLAN_LIMITS=true
  └── Goal: 100 paying users / $2,400 MRR by end of week 8
```

### v1.1 — first 60 days post-launch

- Brand voice profile per workspace (upload past artifact → AI matches tone forever)
- Visual brand profile per workspace (auto-extract colors/fonts)
- Recurring deliverables ("generate Tuesday's status" on schedule)

### v1.2+ — later

- Workspace inbox (per-workspace email)
- Real-time collaboration (Yjs / PartyKit)
- Custom domains for share links
- Team workspaces with shared memory + member roles
- Templates marketplace

---

## 7. GTM — first 90 days

### Days 1-30: Build in public

- Daily Twitter posts about the rebuild — theme: "Killing the ChatGPT-copy-paste loop"
- Show before/after screenshots, feature gifs
- Reply to every consultant/founder who tweets about AI workflow pain
- Goal: +500 followers in target niche

### Days 30-60: Closed beta

- Hand-pick 50 indie founders / consultants from Twitter, LinkedIn
- Free Pro for 6 months in exchange for: weekly feedback, public testimonial, screenshot rights
- Post their wins on Twitter, tag them
- Each beta user becomes a micro-evangelist

### Days 60-90: Public launch

- Product Hunt launch (built-in audience from Twitter)
- IndieHackers detailed post about building solo
- LinkedIn organic + small sponsored campaign ($500-1000) targeting fractional/consultant titles
- Reach out to 5 niche Twitter influencers (10K+ followers, consultant/operator content) — free lifetime in exchange for one honest thread

### Targets by day 90

- 100 paying customers ($2,400 MRR)
- 30 testimonials / case studies
- 5,000 free signups
- 10K Twitter followers in the target niche

---

## 8. What we explicitly will NOT do (next 6 months)

- No new entity types (no whiteboards, no databases, no forms)
- No integrations (Slack/Drive/Gmail) for 6 months
- No team features beyond simple share
- No mobile-responsive polish (banner: "best on desktop")
- No localization
- No native mobile apps
- No SOC 2 / SSO / enterprise features
- No marketplace / templates / community
- No pivoting on positioning for at least 6 months even if growth is slow

This discipline is what makes the timeline survivable for a solo founder.

---

## 9. Success criteria for v1.0

| Metric | Day 30 | Day 60 | Day 90 |
|---|---|---|---|
| Free signups | 500 | 2,000 | 5,000 |
| Paying users | — | 25 (beta convert) | 100 |
| MRR | — | $600 | $2,400 |
| Twitter followers (niche) | 1,500 | 5,000 | 10,000 |
| Public testimonials | 5 | 20 | 30 |
| Activation (created ≥1 artifact) | 60% | 65% | 70% |
| D7 retention | — | 35% | 40% |

If we hit day-90 targets: we have product-market fit signal and can fundraise or grow further.
If we miss by >50%: revisit positioning + ICP, not features.

---

## 10. Decision log (key choices made during brainstorming)

| Question | Decision | Rationale |
|---|---|---|
| Vertical wedge or stay horizontal? | Stay horizontal (positioning-side); narrow on GTM-side | Real gap exists for project-aware AI workspace; vertical play would discard working assets |
| Founders or consultants as ICP? | Both, framed as "project-based work"; founder beachhead | Founder beachhead = free distribution; "project work" framing serves all sub-ICPs |
| Univer or Fortune Sheet? | Univer ✅ (already migrated) | Already done — CLAUDE.md was outdated |
| Keep Puppeteer for PDF? | Yes | Higher fidelity vs. jsPDF; cost acceptable when business model funded |
| Single Pro tier or multi-tier? | Single Pro at $24/mo + Team deferred | Linear's playbook; no decision paralysis |
| Stripe or alt? | Gateway-agnostic system; pick Paddle/LS/Razorpay later | Founder in India, Stripe unavailable |
| Enforce limits at launch? | Build, feature-flag OFF until gateway wired | Soft-launch with beta unlocks; flip switch when ready to charge |
| Diagrams: keep or cut? | Cut entirely | Maintenance burden vs. usage; not core to client work / project deliverables |
| Real-time collab in v1? | No, defer to v1.2+ | Yjs/PartyKit cost + complexity not justified before WTP proven |
| Mobile pass in v1? | No | Knowledge workers use laptops; banner instead |

---

## 11. The one-liner to internalize

> *"Drafta is the AI workspace for docs, sheets, and decks. Drop your files in, get docs/sheets/decks generated with full project memory, ship them with one click. ChatGPT helps you talk. Drafta helps you ship."*

If a target user nods at that line, we've won. Every product, landing, and email decision should be tested against whether it makes that one line more true.

---

## 12. Status

- ✅ Strategy approved by founder (2026-05-01)
- ⏭ Next: GSD roadmap creation → phase planning → execution
