# Primy — D1 Direction Pivot (CEO review)

**Date:** 2026-06-03
**Status:** Locked (user sign-off)
**Supersedes:** the positioning + ICP framing in `2026-05-01-primy-v1-strategy.md` (that spec's GTM, pricing, and roadmap mechanics still stand; only the *aim* sharpens)
**Source:** CEO-review session

---

## 1. The problem this pivot fixes

The May-1 spec positioned Primy as "the AI workspace for docs, sheets, and decks" and said to "stay horizontal product-side, narrow on GTM-side." But the product still *felt* horizontal — and a horizontal "AI workspace" is a **category**, not a **wedge**. Categories are won by incumbents with distribution (Notion, Google, Microsoft, ChatGPT, Claude). A solo, pre-PMF founder wins with a **wedge**: one persona for whom the product is the only sensible choice.

## 2. The direction (locked)

**Primy is the AI deliverable studio for independents who get paid to ship client/stakeholder work** — solo consultants, fractional execs, agencies-of-one. **Operator-founders are the loud build-in-public launch channel** (same product, same features).

- **Product stays horizontal. Aim narrows. We cut nothing.**
- **Core job:** H1 (kill the ChatGPT copy-paste loop) + H2 (scattered files → shippable deliverable, fast).
- **Hero artifact:** the **HTML page** (easy, universal, shareable by link, interactive — per Anthropic's "unreasonable effectiveness of HTML" essay). Decks ride alongside for completeness, not as the spearpoint.

## 3. Why the persona answers the roadmap

The four-format spread (doc/sheet/deck/page) is a *diffusion* for a generic knowledge worker (a vitamin → they churn) but the *exact* deliverable set for a consultant who produces all four per client, every week (a painkiller → they pay → they stay). Everything snaps into place:

| Feature | Generic framing | D1 framing |
|---|---|---|
| 4 formats | "why so many?" | "exactly my deliverable set" |
| Project = memory | "like ChatGPT projects" | "per-client context that compounds" → switching cost |
| Decks (ALLWEONE) | "do we need decks?" | consultants live or die by decks |
| Brand profiles | nice-to-have | core — on-brand is their oxygen |
| Share links + watermark | growth loop | logo in front of *buyers* (clients) |
| Recurring deliverables | "day-8 feature" | "this client's weekly status" — the return reason |
| Slash commands | demo candy | the spine of their week |

Incumbents are horizontal and will not chase the independent's deliverable workflow — that is the defensible gap. WTP is high: a deliverable that wins a client dwarfs $24–49/mo (so the May-1 $24 Pro price is fine, arguably low; revisit a higher "Studio" tier later).

## 4. What changes (all cheap; no features cut)

1. **Onboarding by deliverable, not a tour:** "What do you ship?" → preload 3 real templates → first artifact in 60s.
2. **Slash commands → a deliverable template library** (`/proposal /qbr /case-study /onepager /status /agenda /contract /recap`) — make it the spine.
3. **Pull brand profiles forward** from v1.1 to v1.0 (voice + visual per workspace).
4. **Reframe memory** as "per-client context, remembered."
5. **Landing + demo + launch tweet** all speak to the independent shipping client work. Killer demo: drag in 3 messy files → "make me a one-pager" → 8s later a clean, interactive, shareable HTML page with a "Built with Primy" pill → edit a line → send the link.

## 5. Deck strategy (decided)

- **Do not** build deck generation from scratch — an unwinnable solo arms race (Gamma/Chronicle imperfect after a year of funded effort).
- **Adopt ALLWEONE** (`github.com/allweonedev/presentation-ai`, **MIT**) as the generation engine. It is a stack-twin (Next.js + React + TS + Tailwind + Postgres/Prisma + NextAuth + Plate), runs on Vercel, no new infra.
- **Rejected Presenton** (Apache-2.0 but Python/FastAPI sidecar = infra tax on a clean serverless app).
- The shipped **render → vision-critique → repair polish loop is engine-agnostic** (operates on rendered HTML slides) and **rides on top** of ALLWEONE output — nothing is thrown away.
- Port is a real 1–2 week graft (it's a monolith, no reusable lib): lift the slide schema + generation pipeline + React render components; keep Primy's own pptxgenjs/Puppeteer export; graft onto `store`/`types`/`parseAIResponse`/`deckops`/theming/snapshots/share. **Do a 1-day output spike on real content first.**

## 6. Remaining product decisions (resolved through D1)

| Decision | Outcome |
|---|---|
| Pages: cut/keep | **Elevate to hero** (reversed an in-review "cut" call) |
| Retention loop | Recurring deliverables → **pull into v1.0/early v1.1** |
| Cloud import (Drive/Notion) | Valuable but heavy → **fast-follow, not launch-blocker** |
| Pricing | **$24 Pro stands** (high WTP persona); higher tier later |

## 7. Open items / next steps

- [ ] Rewrite the May-1 spec's positioning section inline (or link this addendum from it).
- [ ] Plan the ALLWEONE port (eng plan + 1-day spike).
- [ ] Resume the technical HOLD-scope audit (AI-op pipeline, the 3,127-LOC `store.ts`, billing/auth boundaries, the ~280-catch silent-failure map).
- [ ] Build the deliverable-template onboarding + slash-command spine.
