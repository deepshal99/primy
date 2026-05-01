# IndieHackers Launch Post

Long-form (~1500 words). Ship as a single IndieHackers thread on launch day.

---

## Title (3 candidates, ranked)

1. **I rebuilt my AI side-project as "the workspace for docs, sheets, and decks" — here's what I cut and what I kept**
2. **From "AI workspace, but generic" to "the tool that kills the ChatGPT copy-paste loop" — a solo founder's pivot**
3. **What I learned shipping 13,000 lines of code in 14 days as a solo founder**

#1 leads. #2 is punchier but #1 makes the rebuild story explicit, which is the hook IH readers respond to.

---

## Body

> Three weeks ago, my product was an "AI workspace" — docs, sheets, diagrams, and decks, all in one chat-driven app. It was technically impressive. Nobody could tell you what it was for.
>
> Today I'm shipping v1.0 of the same product, repositioned as **the AI workspace for docs, sheets, and decks**. Same engine, sharper aim. This is what I cut, what I kept, and what I learned along the way.

### The pivot moment

> Here's the question that broke the old positioning: *"if you had to delete 3 of the 4 entity types tomorrow, which one would you keep?"*
>
> I sat with that for an hour. The answer wasn't a single entity — it was that "AI workspace" wasn't the product. The product was the **moment**: you have a half-finished idea, you want a deliverable. Today, that means alt-tabbing between ChatGPT, Google Docs, Sheets, and Slides for 45 minutes, copy-pasting like it's 2007.
>
> Drafta kills that loop. You chat once. The AI builds the actual artifact in the actual workspace. Project memory means the AI knows the files you uploaded last week, the deck you made yesterday, the sheet you tweaked this morning. Nothing falls through the cracks.

### What I cut

A list of things I deleted, with line counts. Total: -4,573 net lines in the cut commit alone.

- **Diagrams entity (Mermaid + Excalidraw + ReactFlow + Recharts)** — 7 component files, a database table, a system prompt routing block, three npm packages totaling 142 transitive dependencies. The diagrams use case overlaps too cleanly with "what shape should this dashboard be" — and that's a sheet, not a separate entity. Cut.
- **Multi-provider AI for chat** — was supporting both OpenAI and Google Gemini for the chat path. Maintaining two routers as a solo founder is a tax that yields no user benefit. Now: OpenAI for chat / title / embeddings, Google for deck generation only (Gemini's deck output is measurably better). Cut.
- **Real-time collaboration (Yjs + PartyKit)** — I had it on the v1.2 roadmap. It's a genuinely valuable feature. It's also a 6-week build for a solo founder, blocked on "we don't have paying teams yet." Cut to v1.2+.
- **Mobile responsive pass** — knowledge workers do this work on laptops. Banner now reads "best on desktop." Cut.
- **Plugin/extension system** — premature platform thinking. Cut.

### What I kept

The thesis is the moat. The thesis was right; only the *story* was wrong.

- **Project memory** — every file, doc, sheet, and deck gets embedded and is available as context to every chat in that project. Notion AI is page-scoped. ChatGPT Canvas forgets when you start a new thread. Drafta remembers across sessions and across artifact types.
- **Multi-format output** — chat once, get a doc OR a sheet OR a deck depending on what fits. The AI picks. You can override.
- **Drag-drop everything** — PDFs, voice memos, ZIPs. The AI reads them all and uses them as context for everything you build later.
- **Inline mention chips** — `@AcmeProposal` in a doc inserts a colored chip linking to the artifact. Full backlinks make the workspace feel connected, like Roam, but for project deliverables.
- **One-click branded share** — every artifact has a public-pretty share view. Free shares carry a "Built with Drafta" pill. Pro hides it. Calendly/Loom playbook.

### What I built in the last 14 days

Some of this was solo coding, some was orchestrated AI agents working in parallel under my coordination. Architecture decisions, scope cuts, and code review — all me. The boilerplate-y bits — agents.

```
ca34a35  docs(strategy)            — positioning + GTM spec
227bb09  docs(eng-review)          — engineering decisions
6f74b8c  feat(phase-1)             — cut diagrams, refactor modelRouter (-4,573 net lines)
63f73ce  feat(phase-2/wave-1)      — pricing schema + Vitest (1,371 lines)
318b875  feat(phase-2/wave-2A)     — billing core, TDD, 56 tests (1,002 lines)
8b94e3a  feat(phase-2/wave-2B)     — billing API + UI surface (898 lines)
7d787c9  feat(phase-2/wave-3)      — cron pruning + grace migration (236 lines)
3dc1b35  feat(phase-3)             — marketing, pricing, onboarding, watermark, polish
bbfce2d  feat(phase-4/partial)     — slash commands + snapshot APIs
a62b70f  feat(phase-4)             — slash + version history UI
```

Net: ~13,500 lines added/removed across 11 commits. 56 unit + integration tests passing. TypeScript clean. Build green.

### Architecture decisions worth sharing

A few choices I made that other indie founders might find useful:

1. **Build the billing system gateway-agnostic from day 1.** I'm in India; Stripe doesn't work for me. Paddle, Lemon Squeezy, Razorpay are all candidates and I haven't picked yet. So I built a `Gateway` interface with a `noopGateway` impl. When I pick the real one, I write a single file. Day-zero abstraction beats day-90 refactor.

2. **Plan-flag dormancy.** All the limit enforcement is wrapped in `if (process.env.ENFORCE_PLAN_LIMITS === "true")`. Default off. Counters tick anyway, so I get telemetry during beta without blocking anyone. The day I flip the flag, the entire paywall activates atomically.

3. **Founding-member grace.** All existing users got a 60-day Pro grace via a one-off migration. When the paywall flips on, they don't hit a wall — they see "you're on Pro for the next 60 days as a founding member." The schema field is `proUntil: timestamp` and the resolver reads it as part of `effectivePlan(user)`. Reusable for any future promo.

4. **TDD on the billing core.** 56 tests, 100% line coverage on the parts that touch money. The atomic SQL increment for usage counters is tested with `Promise.all` of 10 concurrent calls — final value === 10, no lost updates. Race-free is non-negotiable when bills depend on the count.

5. **Auto-snapshot on AI edits.** Every time the AI modifies an artifact, the post-edit state goes to a `artifact_snapshots` table (debounced 2 min per artifact). Free users keep 5 snapshots; Pro users keep 20. A weekly cron prunes the rest. Trust signal — users let AI edit aggressively because rolling back is one click.

### What's launching today

Free tier:
- 1 workspace
- 50 AI messages/month
- 5 file uploads/month
- 500 MB storage
- "Built with Drafta" watermark on shares

Pro tier ($24/mo, payment gateway TBD):
- Unlimited workspaces
- 1,500 messages/month
- Unlimited uploads + 20 GB storage
- No watermark
- Brand voice + visual profiles (post-v1.0)
- Full slash command set
- 20 snapshots per artifact

### The ask

I want three kinds of feedback:

1. **Is the positioning clear?** Read the homepage. Tell me if it makes you understand what Drafta is in 5 seconds. If not, I want to know what's confusing.
2. **Sign up, run a real workflow.** Pick a real project you have on your plate this week — a proposal, a status update, a pitch deck. Try to do it in Drafta. Email me what worked and what didn't.
3. **Tell me what to build next.** I have a v1.1 list (brand voice profiles, recurring deliverables, workspace inbox), but I'd love to be told I'm wrong.

### What I'm watching for the next 90 days

- Free signups (target: 5,000 by day 90)
- Pro conversions when payment lands (target: 100 paying users / $2,400 MRR)
- D7 retention (target: 40%)
- Twitter followers in the build-in-public crowd (target: 10,000)

I'll write a follow-up post on day 90 with the actual numbers, no spin.

### Try it

[drafta.so](#) — free forever for one project. Beta users get Pro for 60 days.

I'll be in this thread all day. Roast the work, ask anything, tell me what's broken.

— Deepak

---

## Hashtags / mentions for the thread

Don't spam, but if there are natural threads to pull in:
- `#buildinpublic` (in body, not title)
- Tag: @rosiesherry, @csallen, @levelsio if they comment first
- Cross-link: your own Twitter announce, your PH page (PH link is fine in IH bodies, just not the title)
