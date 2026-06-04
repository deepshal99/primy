# Primy AI — Vision & Roadmap

> **Direction locked 2026-06-03 (CEO review).** Primy is no longer positioned as a horizontal "AI workspace for everyone." It is the **AI deliverable studio for independents who ship client and stakeholder work** — solo consultants, fractional execs, agencies-of-one. Operator-founders are the loud build-in-public launch channel, same product. The product stays horizontal (docs, sheets, decks, pages); the *aim* narrows. We cut nothing. See `docs/superpowers/specs/2026-06-03-primy-d1-direction.md`.

## Vision
Primy turns scattered inputs into shippable, on-brand deliverables — docs, sheets, decks, and pages — generated and edited by chat, with per-project (per-client) memory that compounds. Drop your files in, ship a link out, never copy-paste from ChatGPT again.

## Who it's for (the wedge)
The independent who gets **paid to produce deliverables**: the consultant who builds a proposal, a QBR deck, a one-pager, and a model for every client, every week. Their job *is* the four formats, on repeat, on brand. For them the multi-format breadth is the exact tool, not a diffusion — that is why they can't use ChatGPT, Gamma, or Notion alone.

## Core Thesis
- **The job is the deliverable, not the chat.** ChatGPT helps you talk; Primy helps you ship. (H1: kill the copy-paste loop. H2: scattered files → shippable deliverable, fast.)
- **The HTML page is the hero artifact** — easy to make great, universal, shareable by link, interactive. Decks (hard, constrained-canvas) ride alongside for completeness, not as the spearpoint.
- **Per-project memory = per-client context that compounds.** The more you use Primy for a client, the better it gets — and the harder it is to leave. That is the moat and the switching cost.
- **Watermarked share links are the growth loop.** A consultant's shared deliverable puts "Built with Primy" in front of *buyers*.

## Current State (v1)
- Documents (Plate.js rich text)
- Spreadsheets (Univer)
- Presentation Decks (HTML slide engine; deck-refine polish loop shipped)
- **Pages (sanitized HTML entity) — the hero deliverable surface**
- AI chat with full project context injection
- Project-based organization, with Folders + cross-workspace move
- **Library** — workspaces lensed by ownership (Created by me / Shared with me)
- **Quick Note** — frictionless capture into a dedicated Quick Notes workspace; promote ("Move to workspace") into any project
- Auth hardening: revocable sessions, login throttle, breached-password check, password reset
- Snapshot/version history + restore; team workspaces (SSOT access control); plan/usage metering; org "company-paid" billing

## Recently shipped (Jun 2026)
- Strut-inspired shell overhaul + rebrand (orange → black/amber); end-to-end dark mode.
- AI provider routing simplified — **OpenAI for all tasks**; a Google client stays wired but dormant.

## In progress
- Deck-refine polish loop (render → vision critique → repair) is shipped; it is **engine-agnostic** (operates on rendered HTML slides).

## Planned Milestones

### v1.0 — Public Launch (re-aimed around D1)
- [ ] **Onboarding by deliverable** — "What do you ship?" (client decks / reports / one-pagers / models) → preload 3 real templates → first artifact in 60 seconds.
- [ ] **Deliverable template library** — slash commands become the spine: `/proposal` `/qbr` `/case-study` `/onepager` `/status` `/agenda` `/contract` `/recap`.
- [ ] **Brand profiles — PULLED FORWARD from v1.1.** On-brand output is the persona's oxygen; voice + visual (colors/fonts) profile per workspace.
- [ ] **ALLWEONE deck engine port** — adopt the MIT, stack-twin OSS generator (`github.com/allweonedev/presentation-ai`) as deck generation; the existing polish loop rides on top. Replaces the from-scratch deck arms race. (1-day output spike first; then 1–2 wk graft.)
- [ ] Pricing system (built gateway-agnostic, flag-hidden until gateway wired)
- [ ] UI polish to OpenAI-grade; empty/loading states; share-view redesign + watermark
- [ ] Marketing landing at `/` (D1 message) + pricing page
- [ ] Soft launch (50 beta consultants/operators) → public launch (Product Hunt + IndieHackers + LinkedIn)

### v1.1 — First 60 days post-launch
- [ ] **Recurring / updatable deliverables** — "generate this client's weekly status," "update the investor one-pager." The per-client return reason; the retention engine.
- [ ] Cloud import (read-only) from Drive / Notion — feeds H2 directly (fast-follow, not a launch blocker; "drag in files" already covers the demo).
- [ ] Async comments on shared deliverables — the cheapest path out of single-player.

### v1.2+ — Later
- [ ] Mobile-perfect share/public pages (review + send on phone; creation stays desktop)
- [ ] Workspace inbox (per-workspace email)
- [ ] Real-time collaboration (Yjs + PartyKit)
- [ ] Custom domains for share links
- [ ] Team workspaces with shared memory
- [ ] Templates marketplace

## Non-Goals (for now)
- Enterprise features (SSO, audit logs, SOC 2)
- Native mobile apps (web-first; share pages get mobile polish, the editor does not)
- Localization
- Real-time database / Airtable replacement
- New entity types (no whiteboards, no databases, no forms)
- Out-Gamma-ing Gamma on raw deck fidelity — decks are covered for completeness via ALLWEONE, not a perfection arms race
