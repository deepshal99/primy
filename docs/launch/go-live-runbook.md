# Primy go-live runbook (do these when ready)

A plain checklist for the steps that need you (dashboard clicks / one-line commands).
Nothing here is urgent: the internal test runs **right now** on what's already live.
Do these in order when you have time. Each step says exactly what to click/type and how to confirm it worked.

> How to run a command: open Terminal, `cd` into the project folder, then paste the command.
> Most "set an env var" steps are in **Vercel → your project → Settings → Environment Variables**.
> After changing any Vercel env var you must **redeploy** for it to take effect
> (Vercel → Deployments → latest → ⋯ → Redeploy).

---

## 0. (Now, for the test) Make your company "paid" — 2 min

So your teammates get Pro automatically when they join your org.

1. In the app: **Settings → Team → Create organization** (name it e.g. "Pixeldust").
2. In Terminal:
   ```
   npm run org:pro
   ```
   This lists your orgs. Then:
   ```
   npm run org:pro "Pixeldust"
   ```
   (use your org's name or slug).
3. **Confirm:** it prints `✅ "Pixeldust" is now PRO`. Every member who joins inherits Pro.
4. Invite teammates: **Settings → Team → invite by email** (they must sign up first).

> Reverting later: `npm run org:pro "Pixeldust" free`

---

## 1. Activate CI (auto-checks on every change) — 2 min

The CI file is written but the agent couldn't push it (GitHub blocks bots from adding workflow files).

**Easiest way (GitHub website):**
1. Open the repo on github.com → **Add file → Create new file**.
2. Name it exactly: `.github/workflows/ci.yml`
3. Open `docs/ci/ci.yml.txt` in the repo, copy ALL its contents, paste into the new file.
4. Click **Commit changes**.

**Confirm:** open any new Pull Request — you'll see a "CI / checks" run appear and go green.

---

## 2. Passwordless login (needs a domain) — ~15 min, LATER

Skip until you own a domain. A `*.vercel.app` URL will **not** work (you don't control its DNS).
The passwordless code is already built and waiting; this just turns it on.

1. Buy any domain (any cheap one is fine; it doesn't have to be primy.ai).
2. **Resend → Domains → Add Domain** → enter your domain.
3. Resend shows DNS records (SPF, DKIM). Add them at your domain registrar's DNS settings.
   Wait until Resend shows **Verified** (minutes to a few hours).
4. **Vercel → Settings → Environment Variables** → add:
   - Name: `RESEND_FROM_EMAIL`
   - Value: `Primy <hello@yourdomain.com>` (use your verified domain)
   - Scope: Production (and Preview if you want)
5. Redeploy.
6. **Tell me "domain is verified"** — I'll test a real send and flip `/login` to the
   one-tap email-code page. Until then, password login stays (works fine).

---

## 3. Turn on plan limits — 1 min, when you want to enforce Free vs Pro

Right now all limits are lifted (beta). Flip this only when you want Free users actually capped.

1. **Vercel → Settings → Environment Variables** → add:
   - Name: `ENFORCE_PLAN_LIMITS`
   - Value: `true`
   - Scope: Production
2. Redeploy.

**Confirm:** a Free user past 50 AI messages/month gets a "limit reached" response.
Leave it unset (or `false`) during the internal test so nobody is blocked.

---

## 4. Error tracking with Sentry — ~10 min, optional but recommended

1. Create a free account at sentry.io → **Create Project → Next.js**.
2. Copy the **DSN** it gives you (looks like `https://abc123@o0.ingest.sentry.io/0`).
3. **Vercel → Environment Variables** → add `SENTRY_DSN` = that value (Production).
4. **Tell me "Sentry DSN added"** — I'll wire `@sentry/nextjs` (code change) and redeploy.

**Confirm:** errors start appearing in your Sentry dashboard.

---

## 5. Product analytics with PostHog — ~10 min, optional

1. Create a free account at posthog.com → create a project.
2. Copy the **Project API Key** (starts with `phc_...`).
3. **Vercel → Environment Variables** → add `NEXT_PUBLIC_POSTHOG_KEY` = that value (Production).
4. **Tell me "PostHog key added"** — I'll add the provider (code change) and redeploy.

**Confirm:** signups/usage funnels appear in PostHog. (Your own `/admin` page already shows
users, AI spend, and orgs without this — PostHog adds funnels/retention.)

---

## 6. Protect the main branch — 2 min, after step 1

So changes go through green CI before merging.

1. GitHub → repo → **Settings → Branches → Add branch ruleset** (or "Add rule").
2. Branch name pattern: `main`.
3. Tick **Require status checks to pass** → select the CI check.
4. (Optional) **Require a pull request before merging** + 1 approval.
5. Save.

---

## What's already done (no action needed)

Orgs + invites · private-by-default + share-to-org · Trash (recoverable deletes) ·
unified login (password) · dark mode · in-app confirm dialogs · `/admin` dashboard ·
AI-cost telemetry · starter workspace · revamped landing · "What's next" modal ·
activity feed. The migration for all of the above is already applied to your live DB.

## Quick reference — env vars summary

| Variable | Where | When | Purpose |
|---|---|---|---|
| `RESEND_FROM_EMAIL` | Vercel | after you own + verify a domain | enables passwordless email codes |
| `ENFORCE_PLAN_LIMITS=true` | Vercel | when you want to cap Free users | turns Free/Pro limits on |
| `SENTRY_DSN` | Vercel | optional | error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | Vercel | optional | product analytics |
