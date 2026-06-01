# Product Hunt Launch Playbook

Complete plan for the Primy launch on Product Hunt. Use this as the source of truth on launch day.

---

## Tagline (5 candidates, ranked)

PH limit is ~60 chars. Lead with what it is, what it removes from the user's life.

1. **"The AI workspace for docs, sheets, and decks."** ← my pick, exact match with site hero
2. **"Stop copy-pasting from ChatGPT. Make docs, sheets, decks."**
3. **"AI workspace where docs, sheets, and decks live together."**
4. **"Chat once. Get the doc, sheet, or deck. With memory."**
5. **"Project-aware AI. Build docs, sheets, decks in one place."**

Pick #1 — it's clean, claims the category, no jargon.

---

## Description (60-100 words)

> Primy is the AI workspace for docs, sheets, and decks. Drag in any file — PDFs, spreadsheets, voice memos. Chat to create the artifact you need: a polished doc, a working spreadsheet, a client-ready deck. Project memory keeps everything connected, so the AI never forgets what you're working on.
>
> Free forever for one project. Pro for $24/mo. No more bouncing between ChatGPT, Google Drive, and Slides.

---

## First comment by founder (long-form intro post)

Post immediately after PH launches. Targets the "scroll past the tagline" reader.

> Hey hunters! I'm Deepak, the maker of Primy.
>
> I built this because of one specific frustration: I'd open ChatGPT, get a great draft, then copy-paste it into Google Docs to format it. Then I'd need a chart from a spreadsheet — back to ChatGPT, copy-paste into Sheets. Then a slide deck — same loop. By the end of a project I had 14 ChatGPT threads, 6 Google Docs, 2 Sheets, and a Slides deck, and the AI knew none of them existed.
>
> Primy fixes that. It's a workspace where you chat with AI, and the AI builds the actual doc, sheet, or deck right inside the workspace. Drag in your files — they become part of the project's memory. Ask "summarize the brief and draft a proposal" and you get a proposal that cites your data.
>
> What's in v1.0:
> - Docs (Plate.js rich text)
> - Spreadsheets (Univer — formulas, charts, the works)
> - Decks (HTML slide engine, exports to PPTX/PDF)
> - Slash commands: /proposal, /brief, /status, /dashboard, /qbr, /onepager, and more
> - Project memory that actually remembers your files across sessions
> - Branded share links (free shares carry a watermark — Pro hides it)
> - Auto-snapshots so you can restore any version
>
> Free forever for one project. Pro at $24/mo for unlimited workspaces, 1500 messages, brand voice profiles, and the full slash command set.
>
> I'd love your feedback. AMA in the comments.

---

## Asset list

Prepare BEFORE launch day. PH supports thumbnail + gallery.

### Thumbnail
- 240×240px, shows Primy wordmark + the three artifact icons (doc/sheet/deck)
- White background, heat-orange accent
- One word visible: "Primy"

### Gallery (5 images, 1270×760px each)
1. **Hero shot** — landing page screenshot with the hero line in view + product preview right side
2. **The chat→artifact moment** — animated GIF: type "/proposal Acme Co. fintech engagement" → 5-second AI generation → polished proposal appears
3. **Drag-drop demo** — GIF showing 5 files dragged in → AI reads them → answers a question citing sources
4. **Cross-artifact memory** — split-screen: sheet with KPIs on left, deck on right that referenced those KPIs
5. **Settings → Billing tab** — shows the usage bars, the founding-member grace banner, and the one-tier pricing

### Optional: short demo video (90s, no narration)
- Open Primy → drag in 3 files → ask for proposal → ask for kickoff deck → click share → done. Pure UI, no talk.

---

## Maker comment templates (reply patterns)

For the predictable Q&A. Pre-write so you can reply within 60 seconds.

### "How is this different from Notion AI?"
> Notion is a wiki/workspace where you can ask AI questions about your pages. Primy is the inverse — you chat first, and AI builds editable artifacts (real docs, real spreadsheets with formulas, real presentations). Notion AI doesn't generate decks. Primy does. We also persist project context across files, not per-page.

### "How is this different from ChatGPT Canvas?"
> Canvas is great for one document at a time, but it forgets the rest of your work between threads. Primy keeps every doc, sheet, deck, and uploaded file in one project — and the AI uses all of it as context. Plus, real spreadsheets with formulas (Canvas only does markdown tables) and real decks (Canvas can't make decks).

### "Which AI model do you use?"
> OpenAI GPT-4.1 for chat, summarization, embeddings. Gemini 3.1 Pro for deck generation (it produces noticeably better slide layouts in our testing). Both running natively, no aggregator middleman.

### "What about my data?"
> Your data stays yours. We use it only to provide context within YOUR project. Not for training. Not shared. You can delete a project and everything goes — uploads, snapshots, embeddings.

### "When can I pay?"
> Right now Pro is unlocked free for early users — 60-day grace period. Payment goes live when our integration with [Paddle/Lemon Squeezy/Razorpay] lands, around [date].

### "Built solo?"
> Yes. India-based, full-stack. Started with the strategy spec a few weeks ago, shipped the cuts + billing + polish + launch features in [N] commits. Built in public on Twitter.

---

## Hunter strategy

**Recommendation: self-hunt.**

Reasoning: a hunter with a big follower base helps for first-day velocity, but Primy's audience overlap with most "professional hunter" lists is weak (PH hunters skew dev tools, this is broader). Self-hunting also lets you be the first commenter and own the narrative.

If you want a hunter, ask someone in your direct network who's launched on PH and has 1k+ followers. Don't cold-DM hunters.

---

## Launch day timeline (hour-by-hour, PT)

PH ranks by upvotes-per-time-since-launch. Front-loading the first 4 hours is critical.

**12:01am PT — Submit**
- Final asset upload, scheduled launch goes live
- Verify the page renders as expected

**12:05am PT — First comment + first vote**
- Post the founder intro comment
- Have 3 trusted people ready to upvote in the first 5 min (do NOT brigade — natural upvotes only)

**12:30am — Twitter announce**
- Tweet from your account with the PH link
- Quote-RT yourself with a 30-sec demo GIF

**1:00am — IndieHackers post goes live**
- See `indiehackers-post.md`. Don't link directly to PH (against IH rules); mention "we launched today"

**1:30am — Email beta users**
- "We're live — here's the PH link if you'd like to support us. Honest feedback in the comments helps the most."

**6:00am — LinkedIn post**
- Different angle than Twitter — see `linkedin-organic.md` post #1

**8:00am — Reply to all PH comments**
- Goal: every comment replied within 30 min for the first 12 hours
- Use the maker templates above as starting points, then customize per comment

**12:00pm — Mid-day push**
- Post in adjacent communities (r/SideProject, r/SaaS — read rules first), Slack groups you're in
- Reply to anyone tweeting about Primy

**6:00pm — Final stretch**
- Tweet a "thanks, here's where we ended up" with the day's milestones
- DO NOT keep pushing late — PH momentum is set by 4-6pm PT

**Bedtime**
- Schedule next-day post: "Day 2 — what we learned" (link to follow-up blog or thread)

---

## Post-launch follow-up (days 2-7)

- **Day 2**: write a "what happened" post (Twitter thread + IH followup). Honest numbers — upvotes, signups, paying conversions.
- **Day 3-5**: implement top 3 PH feedback items if quick wins. Tweet each fix as you ship it.
- **Day 7**: weekly retro. Check if launch traffic is converting to retained users (D7 retention >25% is the bar).

---

## What "good" looks like

| Metric | Stretch | Likely | Floor |
|---|---|---|---|
| PH rank | Top 5 of day | Top 10 | Top 20 |
| Total upvotes | 1000+ | 400-600 | 150 |
| Signups within 48h | 2000 | 500 | 100 |
| Pro conversions (when payment lands) | 30 | 10 | 3 |

A floor result is still a successful launch — PH is a discovery moment, not a destiny moment. The longer game is build-in-public + word-of-mouth.
