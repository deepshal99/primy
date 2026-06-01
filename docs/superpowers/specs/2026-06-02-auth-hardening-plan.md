# Auth Hardening Plan — robust & secure to 1000+ users

**Date:** 2026-06-02
**Stack:** NextAuth v5 (credentials + JWT) · Neon Postgres · bcrypt(12).
**Method:** Full implementation map + adversarial vuln audit + my own read of `auth.ts`.

Goal: auth that can't be brute-forced, enumerated, forged, or DoS'd, and degrades safely under load.

---

## ✅ Done this pass (shipped, live-verified) — commit `dce53e3`

| Was | Now |
|---|---|
| **Weak committed `NEXTAUTH_SECRET`** (`sheetgpt-prod-secret-…`) → anyone with it forges any user's JWT | Rotated to `openssl rand -base64 32`; `env.ts` rejects short/hand-chosen secrets in prod |
| **No login rate-limiting** (unlimited password guesses) | Durable `login_attempts` throttle — per-email (6/15min) AND per-IP (30/15min), exponential backoff to 6h, **fails open**, survives serverless |
| **Account enumeration** ("No account found" vs "Incorrect password" + timing) | Single generic "Invalid email or password" + constant-time bcrypt vs a dummy hash when the user is absent |
| **Password min 6**, no max (bcrypt 72-byte truncation) | min 8, max 72 bytes, shared validator across signup/reset/change |
| **30-day non-revocable sessions** | maxAge → 7d, daily refresh |
| Dev-admin (`admin@*.local`) authenticable server-side if row exists in prod | Server-side guard rejects `*.local` logins when `NODE_ENV=production` |
| No explicit `trustHost` | Set |

**Result:** the three "fix before launch" items from the audit (forge-able secret, login brute-force, no session cap) are addressed. Verified: correct login works; 6 bad attempts lock account+IP; 7th blocked before bcrypt.

---

## 🔜 Remaining — prioritized

### P0 — Session revocation (`tokenVersion`) — *do next*
Today a stolen JWT is valid up to 7 days and a **password reset does NOT kill existing sessions** (stateless JWT). For account-takeover recovery this is the gap that matters.
- Add `users.tokenVersion int default 0`. Embed it in the JWT (`jwt` callback). In the `session`/`jwt` callback, compare the token's version to the DB (one indexed read) and reject on mismatch.
- Bump `tokenVersion` on: password reset, password change, and an explicit **"log out everywhere"** button.
- Cost: +1 indexed read per authenticated request. Mitigate with the Neon **pooler** (below) and/or a short in-memory cache keyed by userId.

### P0 — Neon pooled connection (availability at scale)
`db/index.ts` uses the `neon()` HTTP driver with no pool. Hot paths fire multiple sequential queries (forgot-password = 4; the jwt callback hits DB). At 1000+ concurrent this can exhaust Neon's ceiling and stall auth.
- Switch to the Neon **`-pooler`** connection string (PgBouncer) for the serverless runtime, or `@neondatabase/serverless` Pool. Cache the jwt-callback plan/tokenVersion read.

### P1 — Distributed rate limiting for the rest of the app
`rateLimit.ts` is an in-memory `Map` → per-instance, trivially bypassed across serverless instances, and keyed off spoofable `x-forwarded-for`. The new auth throttle is DB-backed (good); everything else (chat, extract, reset IP limits) still uses the weak limiter.
- Move to **Upstash Redis** / **Vercel KV** / `@vercel/firewall`; trust only the platform client IP. (The auth throttle can stay DB-backed or move too.)

### P1 — Email verification
No `emailVerified` column; signup creates an immediately-active account with anyone's email.
- Add `users.emailVerified timestamp`. On signup → send a verification link (Resend infra exists). Soft-gate: allow login but show a "verify your email" banner and block sensitive/outbound actions (sharing, invites) until verified. Hard-gate optional later.

### P1 — Bot protection on signup + login
No captcha → credential-stuffing and spam-signup at scale. Add **Cloudflare Turnstile** or **Vercel BotID** on both forms (invisible challenge).

### P2 — Breached-password check
On signup/reset, check the password against **HaveIBeenPwned** (k-anonymity range API — only the SHA-1 prefix leaves). Reject known-breached passwords. Cheap, high-value against stuffing.

### P2 — Security headers: CSP
Headers present: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS. **Missing CSP.** Add a `Content-Security-Policy` (nonce-based for Next inline scripts) — roll out **Report-Only first** to avoid breaking the app, then enforce.

### P2 — Auth audit log
No record of logins, resets, lockouts, role changes. Add an `auth_events` table (or structured logs) for incident response + anomaly detection. Surface lockouts/odd logins.

### P3 — Misc
- Forgot-password: graceful handling when `RESEND_API_KEY` is unset (don't 500).
- Reset token: consider POST-body submission to keep it out of URL/referrer/logs (entropy & single-use are already fine).
- `NEXT_PUBLIC_DEV_AUTH_BYPASS`: add a build-time assert that it's never `true` in a production build.
- Email column: enforce case-insensitive uniqueness (citext or a lower() unique index) to prevent `A@x.com`/`a@x.com` dupes.

---

## Sequencing
1. **tokenVersion revocation + Neon pooler** (P0) — closes the session-revocation gap and the scale/DoS risk. ~half a day.
2. **Distributed limiter + email verification + Turnstile** (P1) — the abuse-resistance layer for public launch.
3. **HIBP + CSP + audit log** (P2) — defense-in-depth.

## Operational checklist before a 1000-user launch
- [ ] Prod `NEXTAUTH_SECRET` is a fresh `openssl rand -base64 32` in the host secret manager (NOT the rotated dev one).
- [ ] `NEXTAUTH_URL` matches the real prod origin.
- [ ] Neon pooler connection in prod; connection ceiling sized for peak.
- [ ] `dev:admin` never run against a prod branch.
- [ ] Resend domain SPF/DKIM verified (reset + verification deliverability).
- [ ] `ENFORCE_PLAN_LIMITS` decision made (see revenue plan).
