# Environments & Deployment — a SaaS-grade setup for Primy (and a guide you can reuse)

**Date:** 2026-06-02
**Audience:** you (founder/builder) — written to *teach*, not just instruct, so the model transfers to every future build.
**Stack:** Next.js 16 (App Router) · Vercel · Neon Postgres (Drizzle) · NextAuth · OpenAI · Resend · Vercel Blob.

---

## Part 1 — The mental model (learn this once, use it forever)

### What an "environment" is and why you separate them
An environment = **a running copy of your app + its own data + its own config (secrets)**. You keep separate ones to shrink **blast radius**: a mistake in dev hurts nobody; the same mistake in prod hurts every paying user.

Three logical environments — each has a *job*:

| Env | Job | Who sees it | Data |
|---|---|---|---|
| **Development** | Build fast, break freely | just you | fake/seed |
| **Preview / Staging** | Validate a change in a prod-like copy *before* users get it | you + teammates/testers | fake/seed (a clone of the *schema*, not prod data) |
| **Production** | Serve real users | the world | real, sacred |

### Two golden rules
1. **Code flows one direction:** `dev → preview → production`. You never edit production directly. Every change is a commit that's reviewed and promoted up the chain.
2. **Production data does NOT flow back down.** You never copy real user data into dev/preview (privacy, security, compliance). Downstream envs get **synthetic/seed** data.

### The 12-factor idea that makes it all work
**Config lives in environment variables, not in code.** The *exact same build* is deployed everywhere; only the env vars differ (which database, which secret, which API key). That's why `DATABASE_URL` is a variable — flip it and the same code talks to a different DB. Your job is to make sure each environment's vars point at *its own* isolated resources.

### Continuous Deployment (the loop you're aiming for)
Push a branch → an automated pipeline runs checks (typecheck/lint/tests/build) → a **preview** deploy appears on a URL → you review it → merge to `main` → it **auto-deploys to production**. If something's wrong, **instant rollback**. Small, frequent, reversible changes beat big scary releases.

---

## Part 2 — The architecture for Primy (concrete)

The two platforms you're on each give you the isolation you need:
- **Vercel** has built-in deploy *targets*: **Production** (your `main` branch) and **Preview** (every other branch/PR, auto-deployed to a unique URL). Env vars are set **per target**.
- **Neon** has **database branching** — instant, copy-on-write Postgres branches. This is the unlock: every environment (and even every PR) gets its *own real database*, branched from a clean schema, so migrations are tested on a real DB before prod.

### Recommended mapping (lean but real)

| Environment | Git branch | Vercel target | Neon branch (DB) | URL | Secrets source |
|---|---|---|---|---|---|
| **Local dev** | feature branches | — (runs on your laptop) | `dev` branch | `localhost:3001` | `.env.local` |
| **Preview** (per PR) | any PR branch | **Preview** (auto) | **ephemeral branch per PR** (Neon×Vercel integration) | `*.vercel.app` | Vercel → *Preview* |
| **Production** | `main` | **Production** | `production` (default) | `primy.app` | Vercel → *Production* |

> **My recommendation:** start with exactly this — **local → preview → production** — in **one** Vercel project. Per-PR Neon branches *are* your staging (a real, isolated, prod-like DB per change). Add a long-lived **`staging`** branch + `staging.primy.app` later, once you have paying users and want a stable soak/QA environment before prod. Don't build a separate staging on day one — it's premature for a solo founder and doubles your ops.

### Two things people get wrong (don't)
- **One Vercel project, not three.** Use Production vs Preview *targets* + per-target env vars. Separate projects = triple the config to keep in sync.
- **Separate AI keys per environment.** Give Production its own `OPENAI_API_KEY` (ideally a separate OpenAI *project* with a spend cap) so a runaway preview/test can't burn your prod budget, and you can see cost per environment.

---

## Part 3 — Database migrations (the single most important upgrade)

This is the difference between "vibe-coded" and "production." Right now you use **`drizzle-kit push`**, which is a *prototyping* tool: it diffs your schema against the DB and applies changes interactively. That's why it (a) prompted to **truncate your `files` table**, and (b) drifted — I had to add the `login_attempts`/`token_version`/email-index changes with raw DDL out-of-band. `push` has **no history, no review, no repeatability** — unacceptable for prod.

**Real SaaS uses versioned migrations:**
- `drizzle-kit generate` → writes a numbered SQL file (e.g. `0003_add_login_attempts.sql`) that you **commit and review**.
- `drizzle-kit migrate` → applies pending migrations **in order, idempotently**, recording what ran. Safe to run on every deploy.

**The fix (I'll do this):**
1. **Baseline** the current schema: generate one migration representing the *current* state, and mark it as already-applied on the existing DBs so it doesn't re-run.
2. Add scripts: `db:generate` (author a migration) and `db:migrate` (apply).
3. Wire `db:migrate` into the **deploy pipeline** (runs before/with each production deploy) so schema and code ship together — atomically, reviewably, reversibly.

From then on: change `schema.ts` → `npm run db:generate` → review the SQL → commit → it applies on deploy. No more interactive `push`, no more drift, no more "truncate?" prompts.

---

## Part 4 — The fresh setup, step by step

You wanted a **fresh DB + fresh deployment**. Here's the order. I've split **[I do = code]** from **[you do = dashboard click-ops]**, with exact steps for yours.

### Step 1 — Neon: fresh database **[you do, ~10 min]**
1. Create a **new Neon project** (this is your clean prod DB; the old dev/test project is abandoned).
2. Branches: keep `production` (default). (Optionally add `dev`.) For each, copy the **pooled** connection string — the host with **`-pooler`** in it (e.g. `ep-xxx-pooler.region.aws.neon.tech`). *Pooled = handles many serverless connections without exhausting the DB; this is the M3 scale fix from the auth audit.*
3. Enable the **Neon ↔ Vercel integration** (Neon dashboard → Integrations → Vercel) so each Vercel **preview** auto-gets its own DB branch. It also auto-syncs `DATABASE_URL` per environment.

### Step 2 — Vercel: project + env vars **[you do, ~15 min]**
1. **Import** `github.com/deepshal99/primy` into Vercel → one project. Framework auto-detected (Next.js). Production branch = `main`.
2. Set env vars **per target** (Settings → Environment Variables; each var lets you tick Production / Preview / Development):
   - `DATABASE_URL` → the **pooled** Neon URL for that target (the Neon integration may set this for you).
   - `NEXTAUTH_SECRET` → a **fresh** `openssl rand -base64 32`, **different per environment**. (The `env.ts` guard now *refuses to boot prod* with a weak/old one.)
   - `NEXTAUTH_URL` → `https://primy.app` (prod), the preview URL pattern for preview.
   - `OPENAI_API_KEY`, `GEMINI_API_KEY` → prod gets its own (spend-capped) key.
   - `RESEND_API_KEY` + `RESEND_FROM_EMAIL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `UNSPLASH_ACCESS_KEY`.
   - `ENFORCE_PLAN_LIMITS` → your call (see revenue plan; `false` for soft launch, `true` once Razorpay is wired).
   - **Do NOT** set `NEXT_PUBLIC_DEV_AUTH_BYPASS` in Preview/Production (the guard blocks prod boot if it's `true`).
3. Add your **domain** (Settings → Domains): `primy.app` → Production. (Later: `staging.primy.app`.)

### Step 3 — Migrations baseline + scripts **[I do = code]**
Set up `db:generate`/`db:migrate`, baseline the current schema, and a deploy-time migrate step.

### Step 4 — CI/CD pipeline **[I do = code]**
A **GitHub Actions** workflow:
- **On every PR:** `npm ci` → typecheck → `next build` → `vitest run`. (Vercel separately posts the preview URL.) PR can't merge unless green.
- **On push to `main`:** run `db:migrate` against prod, then let Vercel deploy. (Or: Vercel builds; a `release` step runs migrations first — two-phase, the safe pattern.)
- You add **branch protection** on `main` (GitHub → Settings → Branches): require the CI checks + 1 review, no direct pushes.

### Step 5 — Secrets & tokens **[you do, ~5 min]**
- Generate the per-env `NEXTAUTH_SECRET`s (above).
- Create a `VERCEL_TOKEN` (Vercel → Account → Tokens) and add it + `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (from `.vercel/project.json` after first link) as **GitHub Actions secrets** — only if we drive deploys from CI; if you let Vercel's Git integration deploy, you may not need these.

### Step 6 — Observability & safety nets **[I do = wiring, you do = signup]**
- **Error tracking:** Sentry (catches runtime errors with stack traces + the user/session). There's a Sentry integration; I can wire it.
- **Product/perf:** Vercel **Analytics** + **Speed Insights** (one line each).
- **Logs:** Vercel log drains (or just `vercel logs` to start).
- **Uptime:** an external monitor (BetterStack/UptimeRobot) pinging a health route.
- **Backups/rollback:** Neon **PITR** (point-in-time restore, automatic) + branch restore; Vercel **instant rollback** (`vercel rollback` re-points prod to the last good build, no rebuild).

### Step 7 — Go-live checklist
- [ ] Prod `NEXTAUTH_SECRET` is fresh & strong (guard will enforce).
- [ ] `DATABASE_URL` = pooled Neon host, prod branch.
- [ ] Migrations applied to prod (`db:migrate` green).
- [ ] `NEXTAUTH_URL` = real prod origin; Resend domain SPF/DKIM verified.
- [ ] OpenAI prod key has a spend cap.
- [ ] `ENFORCE_PLAN_LIMITS` decision made.
- [ ] `dev:admin` never run against prod; `NEXT_PUBLIC_DEV_AUTH_BYPASS` unset in prod.
- [ ] Smoke test on the live domain: signup → create doc/sheet from a file → share/invite → export → reset password.
- [ ] Rollback tested once (deploy, then `vercel rollback`, confirm).

---

## Part 5 — Your day-to-day loop (how you keep improving safely)

```
git checkout -b feature/decks-on-tools      # 1. branch
# ...code, test locally against the Neon dev branch...
git push -u origin feature/decks-on-tools    # 2. push
#   → GitHub Actions runs typecheck+build+tests
#   → Vercel posts a Preview URL with its OWN Neon DB branch
# 3. open the preview URL, dogfood it; get CI green + a review
gh pr merge --squash                          # 4. merge to main
#   → CI migrates the prod DB, Vercel deploys to production
# 5. smoke-test prod. Broken? → `vercel rollback` (instant) + revert the PR.
```

That's the whole game: **small, reviewed, reversible changes**, each tested on a real preview before it touches users. This is what lets you "keep improving" without fear.

---

## Part 6 — What's next (split of work)

**I can do now (code, in this repo):**
1. Migrations: `db:generate`/`db:migrate` scripts + **baseline** the current schema (fixes the `push` drift permanently).
2. `.github/workflows/ci.yml` — PR checks (typecheck + build + vitest) and a prod migrate+deploy job.
3. A `/api/health` route + tidy `env.example` per-environment template + a short `RUNBOOK.md`.
4. (Optional) convert `vercel.json` → typed `vercel.ts`; wire Sentry + Analytics.

**You do (dashboard, I'll give exact clicks):**
- Create the Neon project + branches + Vercel integration.
- Import the repo into Vercel + paste env vars per target + add the domain.
- GitHub branch protection on `main`.

**Suggested order:** I set up migrations + CI + health route first (so the moment you create the Neon/Vercel projects, everything just works), then you do the ~30–45 min of dashboard setup, then we deploy a preview, smoke-test, and promote to prod.
