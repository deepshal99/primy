# Twitter / X — 30-Day Build-in-Public Calendar

> Theme threaded through everything: **stop the ChatGPT copy-paste loop.**
> Voice: human, direct, slightly self-deprecating where genuine. Tony Dinh / levelsio / marc_louvion energy. No marketing-speak. One warm emoji max, only when it earns its place.

**Posting cadence:** one anchor post per day at the slot listed. Reply to your own thread later in the day with replies, screenshots, or a follow-up thought. Mondays and Thursdays usually win — schedule the strongest posts there.

**Time zone note:** times below are IST (founder local). The peak Twitter window for indie / SaaS audiences is roughly 6:30 PM IST – 12:30 AM IST (= 9 AM – 3 PM ET). Anchor important posts there.

**Drafta hashtags to use sparingly (max 1 per post):** `#buildinpublic` only. No others.

---

## Week 1 — Building in public (cuts, decisions, refactors)

### Day 1 — Mon — 8:30 PM IST

**Hook:** Just deleted 7 files and 3 dependencies before lunch.

**Body:**
Killed our diagrams entity today. Excalidraw, react-flow, recharts — gone.

Why: nobody was making diagrams. Everyone was making decks.

The product is sharper for it.

Building Drafta — the AI workspace for docs, sheets, and decks.

**Image:** screenshot of `git diff --stat` showing the deletions, with a green block of additions for the new pricing module next to it.

---

### Day 2 — Tue — 9:00 PM IST

**Hook:** Two things I learned cutting features as a solo founder:

**Body:**
1. Every dependency is a tax you pay forever.
2. The thing you're afraid to delete is usually the thing you should.

Drafta's roadmap got 30% smaller this week. It also got 3x more shippable.

**Image:** none. Pure text post.

---

### Day 3 — Wed — 7:30 PM IST

**Hook:** Locked positioning today after weeks of vague wandering.

**Body:**
> The AI workspace for docs, sheets, and decks.
> Chat to create and edit them all. Drag in any file. Project memory keeps everything connected — so you never copy-paste from ChatGPT again.

It took 4 hours of brainstorming to get to a sentence that took 4 seconds to read.

**Image:** the positioning typed out in a clean editor screenshot — Drafta's own doc surface if possible.

---

### Day 4 — Thu — 10:00 PM IST

**Hook:** Refactored our model router today.

**Body:**
Before: provider-first branching. `if (provider === 'openai') { ... } else if ...` — readable on day one, awful on day 30.

After: a flat task → model registry. One lookup. One source of truth.

The refactor took 2 hours. It will save 100.

**Image:** side-by-side code screenshot — old branching vs. new registry. Use a clean theme.

---

### Day 5 — Fri — 8:30 PM IST

**Hook:** Friday confession from a solo founder:

**Body:**
I've been the bottleneck for product decisions all week.

Spent 3 hours yesterday picking between two prompt strategies. Should've spent 30 minutes.

The lesson: pick the cheaper one to reverse, ship it, learn.

**Image:** none.

---

### Day 6 — Sat — 11:00 AM IST

**Hook:** Saturday rule:

**Body:**
If a feature only makes sense after I explain it, the feature is wrong. Not the explanation.

Tested 4 onboarding flows on friends this morning. The one that worked needed zero words.

**Image:** an onboarding screen if polished enough. Otherwise skip.

---

### Day 7 — Sun — 9:30 PM IST

**Hook:** Week 1 of the rebuild, in numbers:

**Body:**
- 7 files deleted
- 3 deps removed
- 1 positioning locked
- 1 pricing model decided
- 0 launches yet
- ∞ coffee

Drafta v1.0 is 4 weeks out. Building in public from here.

**Image:** a tidy week-1 scoreboard typed into a Drafta doc. Show the workspace UI in the frame.

---

## Week 2 — Feature reveals (slash commands, share watermark, project memory, brand voice)

### Day 8 — Mon — 8:30 PM IST

**Hook:** The thing that made me stop using ChatGPT for client work:

**Body:**
Every new chat = re-paste the brief, the context, the brand voice, the last draft.

Drafta's fix: project memory. Every doc, sheet, and deck in a project shares context. The AI just knows.

I haven't copy-pasted into ChatGPT in 3 weeks.

**Image:** Drafta sidebar showing a project with multiple entities, with a chat that references "the spreadsheet" and "the deck" by name.

---

### Day 9 — Tue — 9:00 PM IST

**Hook:** Slash commands shipped today.

**Body:**
Type `/proposal`, get a polished proposal in your project's brand voice.
`/recap`, `/agenda`, `/dashboard`, `/onepager` — same idea.

10 commands. One key. Zero blank pages.

**Image:** GIF — type `/proposal` in chat, watch a proposal doc get generated and open in a new tab.

---

### Day 10 — Wed — 8:00 PM IST

**Hook:** Drag a PDF into Drafta. Get a proposal, a budget sheet, and a deck out the other side.

**Body:**
60 seconds. No prompt engineering. No "act as a senior consultant" theatre.

This was the demo that finally landed for me.

**Image:** GIF — drag-drop file → 3 artifacts appear in tabs (doc, sheet, deck).

---

### Day 11 — Thu — 9:30 PM IST

**Hook:** Why your share links are now a growth channel:

**Body:**
Drafta shares now ship with a "Built with Drafta" pill. Like Calendly. Like Loom. Like Gamma.

Free users keep it. Pro users hide it.

A free user sharing one deck = a hundred eyeballs on the brand. That's the deal.

**Image:** screenshot of a shared deck with the pill in the corner. Make it tasteful, not loud.

---

### Day 12 — Fri — 8:30 PM IST

**Hook:** Brand voice profiles, in 30 seconds:

**Body:**
Upload a past artifact you wrote. Drafta extracts your tone, your sentence rhythm, your weird favorite phrases.

Every future draft sounds like you. Not like ChatGPT pretending to be you.

This unlocks for Pro on launch.

**Image:** GIF — upload a past doc → "voice profile created" → next AI draft sounds like the user.

---

### Day 13 — Sat — 11:30 AM IST

**Hook:** Snapshot history is now a thing:

**Body:**
Every AI edit creates a checkpoint. Roll back any artifact to any moment.

Trust matters more than features when you're handing the keyboard to an AI. Users won't let it edit if they can't undo.

**Image:** screenshot of the version timeline panel with 4-5 snapshots, labeled "after AI edit", "manual save", etc.

---

### Day 14 — Sun — 9:00 PM IST

**Hook:** Demo of the week — a 60-second project from scratch:

**Body:**
1. New project
2. Drag in last quarter's metrics PDF
3. `/qbr`
4. Doc, sheet, and deck land in tabs.
5. Edit live with chat.

This is what I want every Monday morning to feel like.

**Image:** 60-second screen recording / GIF of the full flow.

---

## Week 3 — Behind-the-scenes (architecture, unit economics, why we're not Stripe)

### Day 15 — Mon — 8:30 PM IST

**Hook:** Why I built Drafta's billing without picking a payment gateway yet:

**Body:**
Stripe doesn't work for India-based founders.
Paddle, Lemon Squeezy, Razorpay all do — differently.

So I shipped a gateway-agnostic billing core. One interface. Swap the implementation in a day.

When I pick, I flip a flag. The whole system goes live.

**Image:** simplified diagram: app → `Gateway` interface → [Paddle | LS | Razorpay | Noop] swappable backends.

---

### Day 16 — Tue — 9:00 PM IST

**Hook:** Unit economics, on the record:

**Body:**
Pro tier: $24/mo. 1,500 AI messages.

Heavy user cost: ~$7.50 in OpenAI. Margin: 69%.
Average user cost: ~$2.50. Margin: 90%.

Healthy enough to fund growth on near-zero ad spend. That's the whole bet.

**Image:** none. Numbers carry it.

---

### Day 17 — Wed — 8:00 PM IST

**Hook:** I wrote the billing tests before the billing code.

**Body:**
TDD on a payment system isn't optional. Race conditions on usage counters. Replayed webhooks. proUntil clocks. All traps.

The tests are the spec. The code is just whatever makes them green.

10 lines of code I'm willing to bet money on > 1,000 lines I'm not.

**Image:** screenshot of the test file with green checkmarks.

---

### Day 18 — Thu — 9:30 PM IST

**Hook:** "Founding member grace" — 60 days of Pro for everyone signed up before launch.

**Body:**
Why: existing users joined when limits didn't exist. Surprise-charging them = bad karma + churn spike.

How: one nullable column on `users`. `proUntil = now() + 60 days`. Plan resolution checks it.

Reusable later for promos, beta cohorts, gifts. Cheap insurance.

**Image:** none.

---

### Day 19 — Fri — 8:30 PM IST

**Hook:** Things I'm not building in v1.0, on purpose:

**Body:**
- Real-time collab (Yjs/PartyKit). Cool, expensive, premature.
- Mobile responsive pass. Knowledge work happens on laptops.
- Slack/Drive/Gmail integrations. Six-month freeze on integrations.
- A second AI provider for chat. OpenAI's enough.

Discipline is the only reason a solo founder can ship in 5 weeks.

**Image:** none.

---

### Day 20 — Sat — 11:00 AM IST

**Hook:** Saturday architecture note:

**Body:**
I cache the user's plan in the auth JWT.

Result: the chat path went from 4-5 DB hits per message → 1.

Smaller details like this compound. Latency is a feature.

**Image:** screenshot of a chat reply landing fast. Or skip.

---

### Day 21 — Sun — 9:00 PM IST

**Hook:** Week 3 done. Two weeks to soft launch.

**Body:**
- Billing core: shipped, tested, hidden behind a flag.
- 50 hand-picked beta users lined up.
- Landing page: in design.
- Pricing page: built, dormant.

The system is loaded. Waiting on the trigger.

**Image:** clean photo of the workspace / desk if you have one. Otherwise none.

---

## Week 4 — Beta program ramp (testimonials, screenshots, asks)

### Day 22 — Mon — 8:30 PM IST

**Hook:** Beta opened to 50 hand-picked founders today.

**Body:**
6 months free Pro. One ask: weekly feedback + a screenshot when you ship something good.

If you're an indie founder, consultant, or solo operator and you want in — DM me. 12 spots left.

**Image:** screenshot of a clean Drafta workspace with a sample project loaded.

---

### Day 23 — Tue — 9:00 PM IST

**Hook:** First beta user shipped a client proposal in Drafta this morning.

**Body:**
"I dropped the brief in. Got the proposal, the budget sheet, and a deck. Closed the loop in 40 minutes. Used to take half a day."

— [@beta-user, with permission]

This is the loop I wanted to kill.

**Image:** quote card or — better — a real screenshot of the proposal doc with the user's name removed.

---

### Day 24 — Wed — 8:00 PM IST

**Hook:** What 5 days of beta feedback taught me:

**Body:**
1. Slash commands beat features. People discover via the menu, not docs.
2. The first artifact has to be done in <30 seconds. After that, attention drops.
3. Project memory is a slow burn — users get it on day 3, not day 1.

Onboarding is now redesigned around #2.

**Image:** none.

---

### Day 25 — Thu — 9:30 PM IST

**Hook:** Quietest power feature in Drafta:

**Body:**
Mention `@deck-name` in chat. The AI pulls in that artifact's content as context.

No copy-paste. No summary. Just `@thing-i'm-talking-about`.

Once you use it twice, you can't go back to ChatGPT.

**Image:** GIF — type `@`, mention popover appears, select an artifact, AI references it in the next reply.

---

### Day 26 — Fri — 8:30 PM IST

**Hook:** Beta user testimonial #2:

**Body:**
"I run a one-person consultancy. I had 4 SaaS tools open at once. Now I have one tab. The decks alone are worth the price."

— [@beta-user]

If this is you, beta is open. DMs.

**Image:** a deck the user generated, with permission, showing real polish.

---

### Day 27 — Sat — 11:00 AM IST

**Hook:** Asking for help:

**Body:**
Drafta hits public launch in 2 weeks. I'm looking for:

- Indie founders to try it (free Pro for 6 months)
- Honest feedback on the landing page (DM me)
- Anyone who's launched on Product Hunt and wants to share advice

Reply or DM. I read everything.

**Image:** none.

---

### Day 28 — Sun — 9:00 PM IST

**Hook:** End of beta week 1. Numbers:

**Body:**
- 38 active beta users
- 124 projects created
- 412 artifacts generated
- 6 testimonials I'm allowed to share publicly
- 1 bug I'm a little embarrassed about (fixed)

Onward.

**Image:** simple stat card — typed clean in a Drafta doc.

---

## Week 5 — Pre-launch teaser

### Day 29 — Mon — 8:30 PM IST

**Hook:** Drafta launches next week.

**Body:**
What it is: the AI workspace for docs, sheets, and decks. Chat to create and edit them all. Drag in any file. Project memory keeps everything connected.

What it solves: the ChatGPT copy-paste loop.

What it costs: $0 free. $24/mo Pro. No surprises.

**Image:** the hero shot — landing page hero or the main app screen with a polished project loaded.

---

### Day 30 — Tue — 9:00 PM IST

**Hook:** Going live on Product Hunt tomorrow.

**Body:**
5 weeks of cuts, refactors, and 50 beta users later — Drafta v1.0.

If you've been following this build, tomorrow's the day to show up.

I'll drop the link first thing in the morning. See you on the other side.

**Image:** a quiet "ready to ship" shot — terminal with `vercel --prod` queued, or the launch checklist crossed off.

---

## Operating rules for the 30 days

1. **Reply to every comment for the first 60 minutes** after posting. Algorithm rewards early engagement.
2. **Quote-tweet your own posts** with a follow-up thought 2-3 days later when relevant. Compound the impressions.
3. **Reply to 5 tweets in target niche per day** (founders, consultants, indie SaaS). Add value, don't pitch. The audience compounds from replies more than posts.
4. **Pin the best-performing post each week** to your profile.
5. **Save threads that hit** — repurpose into the IndieHackers post and the LinkedIn variants.
6. **Do not auto-cross-post to LinkedIn.** Voice differs. Use the dedicated LinkedIn calendar instead.
7. **If a post bombs**, don't delete it. Bury it with the next post. Deleting confuses the algorithm.
