# LinkedIn Strategy

LinkedIn is a different beast than Twitter or PH. Algorithm rewards: first-2-line hook, native long-form (no link in body — paste in first comment), 3-5 paragraphs, 1 image, no overt selling. Post in the morning (8-10am IST or PT) for best reach.

---

## Cadence

- 2 organic posts per week for 4 weeks (8 posts total)
- 1 sponsored campaign mid-month ($500-1000)
- 5-10 cold-but-warm DMs per week (no automation; quality over volume)

---

## 5 organic post drafts

### Post 1 — The "we shipped" announce

> I built an AI workspace as a solo founder. Today I'm shipping v1.0.
>
> Here's the moment that made me change everything about it.
>
> Three weeks ago, the product was a wide "AI office suite" — docs, sheets, diagrams, decks, all chat-driven. Demoable. Confusing.
>
> One question broke the positioning: "if you had to delete 3 of 4 entity types, which one would you keep?"
>
> The answer wasn't an entity. It was the moment users actually feel the pain — the alt-tab cycle between ChatGPT, Google Docs, Sheets, and Slides. Copy-paste, lose context, repeat.
>
> So I cut the diagrams entity entirely. -4,500 net lines. Three weeks of work to ship 14 days of focused product instead.
>
> Primy is now positioned as: the AI workspace for docs, sheets, and decks. Drag any file in. The AI builds the actual deliverable. Project memory keeps everything connected.
>
> Free for one workspace. Pro at $24/mo when our payment integration lands.
>
> Link in the first comment. Brutal feedback welcome.

### Post 2 — The architecture story (for the dev audience overlap)

> A solo founder thing I wish I'd known earlier:
>
> Build your billing system before you've picked a payment gateway.
>
> I'm based in India. Stripe doesn't work for me. Paddle, Lemon Squeezy, Razorpay are candidates. I haven't picked.
>
> But the entire pricing system in my product — plan tiers, usage metering, the limit-enforcement wrapper, the JWT plan caching — is already built. Tested. 56 unit + integration tests pass.
>
> The trick: a `Gateway` TypeScript interface with a `noopGateway` implementation. The day I pick a real gateway, I write one file. Everything else is already wired.
>
> Plus: an `ENFORCE_PLAN_LIMITS=false` env flag means counters tick during beta but no one gets blocked. Telemetry without friction.
>
> When I'm ready to charge, I flip one flag.
>
> The lesson: separate the schema from the integration. Gateway-agnostic billing is 4 hours of design that saves 4 weeks of refactor.

### Post 3 — The cut decisions

> What I deleted from my product in the last 14 days:
>
> - 1 entity type (diagrams) — 7 components, 1 database table, 142 transitive dependencies
> - 1 AI provider for the chat path — kept it only for the use case where it's measurably better
> - The "real-time collaboration" feature on my v1 roadmap — defer to v1.2 when paying teams exist
> - The "mobile responsive pass" — banner now says "best on desktop"
> - The "plugin system" — premature platform thinking
>
> Net: 4,573 lines deleted in a single commit.
>
> What this taught me: the cut commit is the most important commit. It's where you stop pretending you're going to ship everything and decide what you're actually going to ship.
>
> Solo founders' #1 problem isn't that they can't add features. It's that they can't subtract them.

### Post 4 — A lesson about positioning

> "AI office suite" — terrible positioning.
>
> "AI workspace" — slightly less terrible, still bad.
>
> "AI workspace for docs, sheets, and decks" — usable.
>
> Why the third works:
>
> 1. It's descriptive. You read it once, you know what the product is.
> 2. It uses words people actually say in 2026 — "decks," not "presentations."
> 3. It claims a specific category nobody owns. Notion is too org-heavy. ChatGPT has no workspaces. Gamma is decks-only. Cursor is code-only.
> 4. It's universal — it speaks to founders, marketers, consultants, students, anyone with project-based work.
>
> Most positioning failures are abstraction failures. You think "abstract" sounds aspirational. Users hear "I don't know what this does."
>
> Get specific. Then defend it.

### Post 5 — Numbers (post-launch, day 7-14)

(Adapt based on actual numbers. Template:)

> 7 days post-launch. Honest numbers from a solo founder, no vanity metrics:
>
> Free signups: [N]
> Activated users (created at least 1 artifact): [N]%
> D7 retention so far: [N]%
> Most-used slash command: [/proposal | /brief | /status]
> Pro conversions (when payment is live): [N]
> Twitter followers gained: +[N]
> Hours slept: insufficient
>
> What's working: [one specific feature people are sharing]
> What's not: [one specific friction users keep hitting]
> What's next: [one concrete fix shipping this week]
>
> Building in public means showing the floor as well as the ceiling. Both are useful.

---

## Sponsored campaign — $500-1000 budget

LinkedIn Sponsored Content (single-image post, native).

**Targeting parameters:**

- **Job titles:** Fractional CMO, Fractional COO, Founder & CEO (companies <50 employees), Independent Consultant, Solo Consultant, Marketing Director (agencies), Operations Manager (small business), Strategy Consultant
- **Industries:** Management Consulting, Marketing & Advertising, Computer Software (small companies), Financial Services (small firms), Professional Training & Coaching
- **Geographies:** United States, Canada, United Kingdom, Australia, India, Singapore, Germany, Netherlands, Sweden, France
- **Company sizes:** 1-10 (primary), 11-50 (secondary)
- **Interests:** AI productivity, Notion, Gamma, ChatGPT
- **Exclude:** big-tech employees (FAANG/MAANG), enterprise consultants

**Creative:**
- Use Post 1 above (the "we shipped" announce)
- Image: clean product screenshot — the chat → 3 artifacts visualization
- CTA: "Visit website" → primy.so
- A/B test 2 variants of the headline

**Budget pacing:**
- $20/day for 25-30 days
- Pause if cost-per-click exceeds $4
- Optimize toward landing-page visits, not impressions

---

## Cold-but-warm DM strategy

LinkedIn DMs work when they don't feel like a pitch. Connect first, build context for 24-48h, then DM.

### Connection request copy
> Hi [name] — saw your [post about X / thread on Y / role at Z]. Would love to connect; I'm building an AI workspace tool for [their work archetype] and your perspective would be valuable.

### First DM (after connection accepted)
> Thanks for connecting! No pitch — just a question.
>
> When you draft a [proposal / status update / pitch deck] for a client, where do you start? ChatGPT and copy-paste? A template?
>
> I'm building Primy to fix the copy-paste loop and would love your honest take. Happy to send you a link to try it free for 60 days if you're curious — but mostly I want your reaction to the workflow.

### Follow-up (5 days no reply)
> Hey [name] — circling back once. If now's not the right time, no worries. If you want a 60-day Pro pass to try Primy, just say "in" and I'll send it. Otherwise I'll let you go.

### NO follow-up beyond that
- Don't double-DM beyond once
- Don't add to a sequence
- Don't sell — let them ask
