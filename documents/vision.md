# Primy AI — Vision & Roadmap

## Vision
Primy is the AI workspace for docs, sheets, and decks. Drag in any file, get artifacts generated and edited with full project memory, never copy-paste from ChatGPT again.

## Core Thesis
- Knowledge work is scattered. AI tools forget your project. Files live in 8 places.
- Project memory is the moat — the more you use Primy, the better it understands your work
- Multi-format output from a single chat is the killer feature
- Solo operators with project-based work are the wedge

## Current State (v1)
- Documents (Plate.js rich text)
- Spreadsheets (Univer)
- Presentation Decks (HTML slide engine)
- Pages (sanitized HTML entity)
- AI chat with full project context injection
- Project-based organization, with Folders + cross-workspace move
- **Recents** — global, cross-workspace "jump back in" surface
- **Quick Note** — frictionless capture into a dedicated Quick Notes workspace; promote ("Move to workspace") into any project
- Auth hardening: revocable sessions, login throttle, breached-password check, password reset
- Snapshot/version history + restore; team workspaces (SSOT access control); plan/usage metering

## Recently shipped (Jun 2026)
- Replaced the dead "Inbox" nav with **Recents**; turned "Quick Note" from an empty-project spawner into real capture.
- AI provider routing simplified — **OpenAI for all tasks** (deck moved off Gemini); a Google client stays wired but dormant.

## In progress
- Agentic **deck-refine** pipeline (critique → repair) — `src/lib/ai/deck/`, `/api/deck-refine` ("Primy Studio" deck-100x plan).

## Planned Milestones

### v1.0 — Public Launch (Weeks 1-5, see strategy spec for full sequence)
- [ ] Phase 1: Cut & clean (diagrams entity, simplify AI provider routing)
- [ ] Phase 2: Pricing system (built gateway-agnostic, hidden until launch)
- [ ] Phase 3: UI polish to OpenAI-grade
- [ ] Phase 4: Launch features (slash commands, branded shares, snapshot history)
- [ ] Phase 5: Soft launch with 50 beta users
- [ ] Phase 6: Public launch (Product Hunt + IndieHackers + LinkedIn)

### v1.1 — First 60 days post-launch
- [ ] Brand voice profile per workspace
- [ ] Visual brand profile per workspace (auto-extract colors/fonts)
- [ ] Recurring deliverables

### v1.2+ — Later
- [ ] Workspace inbox (per-workspace email)
- [ ] Real-time collaboration (Yjs + PartyKit)
- [ ] Custom domains for share links
- [ ] Team workspaces with shared memory
- [ ] Templates marketplace

## Non-Goals (for now)
- Enterprise features (SSO, audit logs, SOC 2)
- Native mobile apps (web-first; banner instructs desktop)
- Localization
- Real-time database / Airtable replacement
- New entity types (no whiteboards, no databases, no forms)
- Mobile responsive polish
