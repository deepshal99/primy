# Multi-Tenant Collaborative Workspace — Milestone Design

**Date:** 2026-06-03
**Status:** Design — awaiting final review before implementation plans
**Owner:** Deepak (info@pixeldust.in)
**Goal of this milestone:** Turn Primy from a single-user app into a **multi-tenant, organization-aware collaborative workspace** that any company can sign up to, where teammates work on a **shared-but-private** set of projects — good enough to put in front of a 10–15 person team for a week of real dogfooding and feedback.

This is a generalized, product-grade design (any company, not one specific org). The first real tenant happens to be the author's company, onboarded by marking their org as paid — but nothing in the design is hardcoded to it.

---

## 1. Context & what already exists

Verified against the codebase (2026-06-03):

- **Auth:** NextAuth v5, email+password only. No email verification, no social login. `tokenVersion` revocation, login throttle, password reset all present.
- **Access control:** `src/lib/projectAccess.ts` — `getProjectAccess` / `requireProjectAccess` / `listAccessibleProjectIds`. Per-user roles via `projectMembers` (owner/editor/commenter/viewer). **No org/team entity.**
- **Plans:** `src/lib/plans.ts` (free/pro, `PRO_PRICE_USD=24`), `effectivePlan` (plan + `proUntil` grace), `ENFORCE_PLAN_LIMITS` flag (OFF), usage metering on `/api/chat` + `/api/extract` only. Payment gateway is a **no-op**.
- **Sharing:** per-user membership + a whole-project/per-entity public `shareToken`. `shareLinks` table (scoped/expiring links) **defined but unused**.
- **Deletes:** **hard delete** for docs/sheets/decks/pages/projects ("This cannot be undone"). Only `files` has `deletedAt`. **No Trash.**
- **Dialogs:** native `confirm()`/`alert()` in `ProjectHome`, `AppShellV2`, `QuickNotesView`, `VersionHistoryPanel`.
- **Quick Notes:** per-user hidden workspace (`ensureQuickNotesProject`), already excluded from the Workspaces tree.
- **Onboarding:** a 3-step `/onboarding`.
- **Analytics/admin:** none. No PostHog/Sentry/GA. `activityEvents` table **defined but never written**. One cron (`prune-snapshots`).
- **Existing related specs:** `2026-06-01-collaboration-plan.md` (async collab: invites/comments/activity/presence-lite — folded in here as Phase 4), `2026-06-02-revenue-model-plan.md` (parked for after the test).

---

## 2. Roles & ownership model (FINAL — kept deliberately simple)

**Org tier** (the company):
- **Org Owner** — creator of the org. Full control: members, billing/plan, domain settings, delete/transfer the org.
- **Org Admin** — manage members + org settings. *Not* billing or org deletion.
- **Member** — normal user in the org.

**Project tier** (independent of org role):
- A project is **controlled by whoever created it** ("project owner"). They control visibility, sharing/members, archive, delete, transfer ownership, move (personal ↔ org).
- Shared collaborators get the existing **editor / commenter / viewer** roles. They edit content (per role) but cannot change sharing.

**Key rule:** *org role ≠ project power.* Being an Org Admin does not make you owner of every project — only of projects you created. Org Admins see org-shared projects (because those are shared org-wide), **not** members' private projects.

**Edge cases (handled, see §4 W2):**
- **Member leaves / is removed:** their **org-shared** projects auto-transfer to the Org Owner; their **private** projects are **archived** (never silently destroyed).
- **Org Admin override on private projects:** **not allowed** (privacy by default).

---

## 3. Sharing ladder (default = private)

Four composable levels (Google-Docs / Notion model). Default is the bottom.

1. **Private** — owner only. *(new explicit default for every new project)*
2. **Specific people** — owner adds individuals by email + role. *(reuse existing `projectMembers`)*
3. **Whole organization** — owner flips visibility to **Org**; all org members get access, **retroactively** (new members see it too). *(new `visibility` + `orgId` on project)*
4. **Public link** — anyone with the link, read-only (or edit via `shareLinks`). *(existing `shareToken`, plus wire `shareLinks` for edit/expiry)*

**Owner-only actions:** change visibility, manage members/roles, create/revoke links, archive, delete, transfer.
**Quick Notes:** hard-locked to level 1 — never shareable, never given an `orgId`.

---

## 4. Workstreams

Each workstream lists *what's missing → design → acceptance*. Sequencing & orchestration in §6.

### W0 — Data model & access-control foundation (FOUNDATION, sequential)
Everything depends on this; build first, on one track.

**Schema (Drizzle / Neon):**
- `organizations`: `id, name, slug (unique), plan ('free'|'pro' default 'free'), proUntil (nullable), ownerId (FK users), createdAt`.
- `orgMembers`: `id, orgId (FK), userId (FK), role ('owner'|'admin'|'member'), status ('active'|'pending'|'removed'), invitedBy (nullable), createdAt`. Unique `(orgId, userId)`. **A user belongs to at most one org** — enforce single active membership.
- `users` addition: `isSuperAdmin (boolean default false)` — gates `/admin`.
- `projects` additions: `visibility ('private'|'org' default 'private')`, `orgId (nullable FK)`, `archivedAt (nullable)`, `deletedAt (nullable)`.
- Soft-delete columns `deletedAt` (+ `archivedAt` where meaningful) on `knowledgeUnits`, `projectTables`, `projectDecks`, `projectPages`, and folders.
- `tokenUsageLog`: `id, userId, orgId (nullable), task, model, inputTokens, outputTokens, estCostCents, createdAt` — feeds admin + future revenue accuracy.
- Begin **writing** `activityEvents` (table already exists) for audit/feed/notifications.

**Access-control updates (`projectAccess.ts`):**
- `getProjectAccess`: grant access if member row **OR** legacy owner **OR** (`project.visibility='org'` AND requester is an active member of `project.orgId`). Respect `deletedAt`/`archivedAt` (exclude from normal listing).
- `listAccessibleProjectIds`: add org-shared projects for the user's org; exclude soft-deleted/archived from the default board.
- `effectivePlan`: also return `pro` if the user is an active member of an org whose `plan='pro'` (or `proUntil > now`). → **"company paid" = one flag on the org; every member inherits Pro.**

**Acceptance:** migrations applied; existing single-user behavior unchanged for users with no org; an org-shared project is visible to a second org member; soft-deleted items vanish from the board; a Pro org's members read as Pro.

### W1 — Org management (UI + API)
**Missing:** entire org concept in the product.
**Design:** create-org flow (name → becomes Org Owner); org settings page (rename, delete/transfer); members panel (list, invite by email, set role admin/member, remove). **One org per user** — a user already in an org cannot create/join another; no org switcher. APIs: `POST /api/orgs`, `GET/PATCH/DELETE /api/orgs/[id]`, `GET/POST/PATCH/DELETE /api/orgs/[id]/members`. All guarded by org role.
**Acceptance:** a user can create an org, invite a teammate, the teammate joins and appears in the member list; admin can change roles; owner can transfer/delete.

### W2 — Project visibility, ownership & lifecycle
**Missing:** explicit visibility, archive, transfer, move, member-leaves handling, owner-only gating.
**Design:**
- Share UI extended with the 4-level ladder (private / people / org / public link). Org option only appears if the project belongs to an org.
- Owner-only: visibility toggle, member management, link revoke, **archive**, **transfer ownership**, **move** (personal ↔ org), delete.
- Quick Notes guard at API + UI (cannot set `visibility='org'`/`orgId`).
- Member-leaves hook (in W1 remove path): reassign org-shared → Org Owner; archive private.
- Tighten existing share-link endpoints from editor+ to **owner-only** for create/revoke (per product rule). Wire `shareLinks` for edit-permission + expiry (table exists).
**Acceptance:** new projects are private; owner can share to org and a teammate sees it; non-owner cannot change sharing; archive hides without deleting; transfer works; removing a member reassigns/archives correctly.

### W3 — Trash + Undo + dialog replacement
**Missing:** Trash, recoverable deletes, in-app confirmations.
**Design:**
- Soft-delete wiring: deletes set `deletedAt` instead of hard delete (docs/sheets/decks/pages/projects/folders).
- **Trash view** (personal scope): list deleted items, **Restore** or **Delete permanently**. Auto-purge after **30 days** (extend the existing prune cron).
- Default delete UX → **"Deleted · Undo" toast** (no blocking modal).
- New reusable **`ConfirmDialog`** (on existing `Dialog` primitive, motion-token compliant). Replace **every** native `confirm()`/`alert()`. Reserve the modal for irreversible actions only: permanent delete from Trash, remove member, delete org, revoke public link.
**Acceptance:** deleting a doc moves it to Trash with an Undo toast; restore returns it; permanent delete asks via in-app modal; zero `window.confirm`/`alert` remain (enforce via a lint/grep check).

### W4 — Async collaboration (folds in `2026-06-01-collaboration-plan.md`)
**Design (priority order from that plan, now org-aware):**
- Invite UI + member list in share modal (per-project, complements org sharing).
- Full **read-only enforcement**: `canEdit` selector + "View only" badge (AI path already gated).
- **Activity feed** from `activityEvents` ("Maya edited Budget Tracker · 2h ago").
- **Notifications** on share/mention/assignment (write `activityEvents`; in-app bell first, email later).
- **Comments** (doc-level → range-anchored) — *stretch within the week.*
- **Presence-lite + data-loss guardrail:** "Maya is viewing/editing" heartbeat + a non-blocking "this changed on the server since you opened it — reload?" check on save. Mitigates last-write-wins **without** real-time infra. Full Yjs/PartyKit co-editing stays **deferred** (v1.2+).
**Acceptance:** viewers can't edit; activity feed populates; a second editor gets a presence indicator and a conflict warning rather than silent overwrite.

### W5 — Signup, verification, invites & onboarding
**Missing:** email verification, real invite acceptance, team-aware onboarding/value framing.
**Design:**
- **Individual signup:** email + password → **email verification code** (Resend; reuse password-reset email scaffolding) → personal workspace + Quick Notes.
- **Org join:** invite link / email invite only (no domain capture) → join org on verify, inherit org plan. A user already in an org cannot join another.
- `orgMembers.status='pending'` → token → accept on signup (the gap noted in both prior specs).
- **Onboarding** extended: team-aware welcome; "what's private vs org-shared"; one screen of **value framing** — *live shared docs/sheets/decks with AI vs the download → reshare → stale-file → re-invite loop*; lightweight coachmark tooltips on first entry (chat box, sidebar, share toggle). First chat remains the hero.
**Acceptance:** new user must verify email; an invited teammate lands inside the org with Pro; onboarding explains sharing in <30s.

### W6 — "Coming soon" modal
**Missing entirely.**
**Design:** sidebar row **"What's next ✨"** → modal with cards: **MCP connections, deploy agents, routines/automation, web search**, etc., each "Coming soon"; a "request a feature" box that writes to feedback/analytics.
**Acceptance:** modal opens from the shell, lists roadmap, captures a feature request.

### W7 — Analytics + admin dashboard (lightweight)
**Missing entirely.**
**Design:**
- **PostHog** (free tier) for funnels/retention; **Vercel Web Analytics**; **Sentry** free for errors.
- **Token-cost logging** writes to `tokenUsageLog` on every AI call (counts already returned by the API).
- Read-only **`/admin`** (super-admin gated by a flag on the user): orgs, signups, active users, **AI spend per user/org**, top spenders, feedback inbox.
- Optional in-app **feedback button** for testers.
**Acceptance:** you can open `/admin`, see signups + per-user AI spend for the test week, and read submitted feedback.

---

### W8 — Environments & deployment pipeline (dev → preview → prod)
**Why now:** once a real team is on it, "edit prod directly" is over. We need the dev/preview/prod ecosystem with per-PR preview URLs and safe migrations. The full design already exists in **`2026-06-02-environments-and-deployment-guide.md`** — this workstream is its *execution*.
**Missing (per that guide):** versioned migrations (still on `drizzle-kit push`), CI checks, health route, Sentry/Analytics wiring, branch protection.
**Design / build items (code = I do):**
- **Migrations:** add `db:generate`/`db:migrate`, **baseline** the current schema, mark applied on existing DBs, wire `db:migrate` into the deploy step. *(Hard prerequisite for shipping the W0 schema changes safely.)*
- **CI:** `.github/workflows/ci.yml` — on PR: `npm ci` → typecheck → `next build` → `vitest run`; on push to `main`: migrate then deploy. Branch protection on `main`.
- **Health + config:** `/api/health` route; per-environment `.env.example`; short `RUNBOOK.md`.
- **Observability:** Sentry + Vercel Analytics/Speed Insights (overlaps W7).
**Dashboard items (you do, ~30–45 min, exact clicks in the guide):** Neon project + branches + Vercel integration (per-PR DB branches = your staging); Vercel project import + per-target env vars + domain; GitHub branch protection.
**Mapping:** local (feature branches, Neon `dev`) → **Preview** (per-PR, ephemeral Neon branch, `*.vercel.app`) → **Production** (`main`, Neon `production`, `primy.app`). One Vercel project, Production/Preview *targets*, separate prod OpenAI key with a spend cap.
**Acceptance:** a PR spins up a preview URL on its own DB branch; CI gates merge; merging to `main` migrates + deploys prod; `vercel rollback` tested once.

> **Sequencing note:** W8's **migration baseline is a hard prerequisite for W0** — the org/visibility/trash schema changes must ship as reviewed, versioned migrations, not `drizzle-kit push`. So W8's migration setup is part of **Phase 0**, before any schema change lands. CI + observability + dashboard setup run in parallel with Phase 1.

### W9 — Passwordless unified auth (email code) 🆕
**Goal:** merge signup + login into ONE passwordless flow — enter email → 6-digit code → in (account auto-created if new). Password field removed from the new flow (kept in DB for existing users; they can also use code login). Google login added later removes the email-only fragility.
**⚠️ HARD DEPENDENCY:** requires working email delivery (`RESEND_API_KEY`, verified sender domain). It is **absent today**. Email-code must ship **alongside** password login until Resend is verified in prod, then flip to passwordless-only. Never make code the sole method while email delivery is unproven (lockout risk for all users).
**Plan:** `emailCodes` table (email, code hash, expiresAt, attempts); `/api/auth/request-code` (rate-limited, Resend) + a NextAuth credentials "code" provider validating email+code → session (create user on first verify, passwordless). Throttle + single-use codes.

### W10 — Signup/login page revamp 🆕
One unified page (no separate signup/login), Primy branding/design language, built on W9's code flow. Email field → code entry → done. Depends on W9.

### W11 — Landing page revamp 🆕
Full overhaul of `src/app/page.tsx` (keep route/IA). Built per `design-taste-frontend` (anti-slop, single warm theme, zero em-dashes, real images, motivated motion) + `copywriting` (clear benefit-led copy, one CTA intent = "Start free"). Brand tokens only (ink/amber/warm), Inter, in-house motion. Redesign-overhaul mode.

## 5. Out of scope (parked — by decision)
- Real payments / checkout / Upgrade-funnel UI (revenue model = after the test; see `2026-06-02-revenue-model-plan.md`).
- Turning on `ENFORCE_PLAN_LIMITS` / storage gating / metering decks+embeddings.
- Guest/demo no-signup sandbox.
- Social login / magic link.
- Full real-time co-editing (Yjs/PartyKit) — v1.2+.
- Dark mode for editors/chat.
- Provider-credit applications (post-test).

---

## 6. Build sequencing & multi-agent orchestration

**Phase 0 — Foundation (sequential, single track): W8 migration baseline → W0.**
First set up versioned migrations (W8: `db:generate`/`db:migrate` + baseline) so the new schema ships reviewably. Then W0: schema + access control + plan inheritance + token-log table + start writing `activityEvents`. One careful track; everything below depends on it. Land + migrate before fan-out.

**Phase 1 — Parallel fan-out (agent team, on top of W0):**
- Agent A → **W1** Org management (UI + API).
- Agent B → **W2** Project visibility / ownership / lifecycle.
- Agent C → **W3** Trash + Undo + ConfirmDialog (dialog sweep).
- Agent D → **W5** Signup/verification/invites/onboarding.
- Agent E → **W7** Analytics + token logging + `/admin`.
- Agent F → **W6** Coming-soon modal + **W4** activity feed/notifications/presence-lite.

Coordination: all agents branch from the W0 foundation. Shared touch-points (access control, the share modal, the shell sidebar) are owned by a designated agent to avoid collisions; others integrate against its interface. Comments (W4 stretch) only if time remains.

**Phase 2 — Integration & QA:** merge, dogfood the full team flow in-browser (create org → invite → share private→org → edit as viewer → delete→trash→restore → check admin/analytics), fix seams, run `npm run test:run` + `npm run lint` + `npm run lint:motion`.

---

## 7. Risks
- **Concurrent edits** remain last-write-wins until presence-lite ships — W4 guardrail is mandatory before the team test, or two people *will* overwrite each other.
- **Schema migration** touches core tables (projects, access) — must preserve existing single-user data; test the legacy-owner fallback path.
- **Scope for one week** is large; W4 comments and W7 polish are the first things to trim if time runs short.
- **Email deliverability** for verification/invites (Resend domain setup) is a hard external dependency for W5.

---

## 8. Open assumptions (flag if wrong)
- **A user belongs to at most one org** (no org switcher). Confirmed.
- "Super-admin" for `/admin` is the `users.isSuperAdmin` boolean. Confirmed.
- No domain capture — joining is invite-only. Confirmed.
- Per-person email sharing kept **alongside** org sharing. Confirmed.
