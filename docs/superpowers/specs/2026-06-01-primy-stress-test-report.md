# Primy AI — Stress-Test & Team-Readiness Report

**Date:** 2026-06-01
**Method:** Live testing against the running app (authenticated as a Pro user), acting as 6 team personas (marketing, sales, founder, ops, student, data). 27 real chat requests + adversarial/edge cases, plus extraction of the 7 real sample files (DOCX, XLSX, CSV, PDF, ZIP, HTML, JSON) and end-to-end "file → entity" flows. Backed by 3 deep code audits (API security/limits, file/export pipelines, feature gaps).

Verdict in one line: **the core promise — "chat to create docs/sheets, drag in a file and the AI builds from it" — genuinely works and is sometimes delightful. The two things that will hurt a team today are LATENCY and SILENT FILE-EXTRACTION FAILURE. Collaboration is the big missing pillar.**

---

## ✅ What works amazingly (keep / market these)

1. **Intent routing is sharp.** Tested across teams: questions get answered in chat (no junk doc), creation requests fire the right tool, ambiguous asks get ONE clarifying question.
   - "posting cadence for LinkedIn vs Twitter?" → concise chat answer, no artifact.
   - "make it more formal" with nothing open → "Which text? Paste it or open the doc." (real context-awareness)
   - "help me with marketing" → one sharp clarifying question.
2. **File → entity is the killer flow.** Real files, real results:
   - Aivia website brief (DOCX, 20.6K chars) → **34-row launch task tracker** (15s).
   - PsycHire design-feedback CSV (messy, merged cells) → **83-row prioritized bug tracker** (22s).
   - Same brief → tidy one-page exec-summary doc (6.7K chars).
3. **Multi-entity in one turn.** "Create three docs: cats, dogs, birds" → 3 `create_document` calls in a single response.
4. **DOCX/XLSX extraction is clean & fast.** 20–22K chars pulled accurately in <1s.
5. **Non-English in/out.** German prompt → German-titled spreadsheet, correct data.
6. **Security basics hold.** Prompt-injection ("print your system prompt") refused; an XSS-laden title was sanitized to "Web Security".
7. **Reliability hardening (this session) is solid.** Transient-blip retry, truncation auto-continue, schema-validated tools with fenced fallback, dev-visible errors.

---

## 🔴 Broken / high-risk (fix before handing to teams)

### P0-1 — Latency makes creation feel broken
Real measured times this session:
| Request | Time |
|---|---|
| Content-calendar sheet | 7.7s |
| Outreach tracker | 5.4s |
| Onboarding checklist doc | 28.8s |
| 200-row sales sheet | **63.6s** |
| "2000-word essay" doc | **84.8s** |
| Comprehensive GTM strategy doc | **>90s (no output in window)** |

Root cause: the new **complexity → `reasoningEffort: high`** bump (strategy/analysis/plan keywords) stacks heavy reasoning on top of large structured output. For *content generation* the reasoning tokens mostly add latency, not quality, and risk the 45s server stall-timeout and the 60s client stall abort.
**Fix:** cap complex *chat* at `medium` (or `low`) effort; reserve `high` for genuine analysis answers, not document/sheet generation. Consider streaming a partial/skeleton first. This is the single biggest felt problem.

### P0-2 — Image-based / scanned PDFs extract NOTHING, silently
The 4 MB `Deck-US-compressed.pdf` is fully image-based (verified: 0 fonts, 7 images, 0 text ops). Extraction returned **6 whitespace characters, HTTP 200, no warning**. A user uploads their deck, sees "success", and the AI has zero content to work with.
**Fix:** detect near-empty extraction (e.g. <∼50 non-whitespace chars relative to file size) → tell the user "this PDF looks image-based; I couldn't read text from it," and/or add OCR. Today it's silent content loss.

### P1-3 — ZIP decompression has no size guard (OOM / DoS)
`/api/extract` loads the whole ZIP via JSZip with no per-entry uncompressed-size cap. A decompression bomb (tiny file → GBs) can OOM the function. (The real 1.6 MB photo ZIP was fine — listed 7 filenames — but the guard is missing.)
**Fix:** cap per-entry and total uncompressed size before reading.

### P1-4 — ZIP of images is a dead end
The speaker-photos ZIP extracted only a filename list; the images themselves aren't usable (not turned into image attachments, not OCR'd). A user expects "here are our photos" to mean something.
**Fix:** surface images from a ZIP as usable attachments, or clearly say images aren't read.

### P2-5 — Image MIME spoofing / SVG
Any `image/*` is accepted, including `image/svg+xml` (XSS vector when rendered). **Fix:** strict whitelist PNG/JPEG/WebP.

### P2-6 — Deck generation is inconsistent from chat
"Create a pitch deck…" returned a clarifying question instead of generating; decks run through a separate `/api/deck-ai` path that did **not** get this session's tool/reliability upgrades. Decks feel second-class vs docs/sheets.

---

## 🟡 Missing for teams (the gaps that matter most)

Ranked by how much a multi-person team will feel them:

1. **Real-time collaboration — absent.** No multi-user editing, presence, comments, or @mentions. Schema has `activityEvents`, `projectMembers`, roles — but it's scaffolding. Last-write-wins on concurrent edits = silent data loss. *This is the #1 thing standing between "personal tool" and "team product."*
2. **Team/roles/invites — schema-only.** Roles (owner/editor/commenter/viewer) exist in DB and `projectAccess.ts`, but the UI never enforces "viewer" (edit buttons still show), there's no invite/accept flow, no seats, no org/team billing entity. "commenter" role has no feature behind it.
3. **Version history restore — untested UI.** Snapshots are stored (5 free / 20 pro) and a restore route exists, but undo/redo is session-only (lost on refresh) and there's no diff/compare.
4. **Search is shallow.** Client-side substring match on title + loaded content only; no full-text/content search across a project, no fuzzy.
5. **Export gaps.** No PDF for HTML pages, no Markdown for docs, no bulk/ZIP "export whole project," no PNG/image export.
6. **Sharing is view-only.** `shareLinks` table has `permission: view|edit`, `expiresAt`, but only view-link is wired — no edit links, expiry picker, or password.
7. **No activity feed / notifications** (schema only). No "X edited Y", no email/push.
8. **Billing not wired.** `ENFORCE_PLAN_LIMITS` is off; `gatewayCustomerId`/subscription fields never populated; `/pricing` has no upgrade CTA. Fine for now, blocking for launch.
9. **Mobile partial.** Chat/workspace toggle exists; editors (sheet/deck) aren't touch-optimized; no tablet layout.
10. **Ingestion gaps.** No OCR, no audio/video, no Google Drive/Notion/URL import — and CSV/JSON/HTML/TXT/MD are extracted client-side only (uploading a CSV to `/api/extract` returns "unsupported", which is correct but the split is worth knowing).

---

## 🧪 Edge-case robustness (from code audit, sampled live)

**Strong:** consistent `auth()` + role checks, 404-not-403 (no existence leaks), ownership chains on all mutations, rate limits on the sensitive routes (chat 30/min, extract 10/min, embeddings 20/min, public share IP-limited), SSRF blocked in PDF export (only `data:`/`blob:`), email-enumeration mitigated.

**Watch:**
- No rate limit on some authenticated GETs (`/api/projects/[id]`, messages, snapshots) — repeated heavy fetches possible.
- Chat: individual `docContent`/`sheetData` not capped (only the 400K aggregate) — one giant field can crowd out the user's actual query.
- Snapshot `content` stored as `unknown` with no schema validation — a malformed restore can fail at the app layer.
- Unsplash/Pexels fetch has no timeout (can hang).
- Summarization failure during extraction is swallowed silently (empty summary, no flag).

---

## 🎯 Top 5 priorities (my call)

1. **Tame latency** — drop complex-chat reasoning to `medium`/`low` for generation; stream sooner. (P0, ~1 line + tuning)
2. **Warn on empty/image PDF extraction** (+ plan OCR). (P0, small)
3. **ZIP size guard** against decompression bombs. (P1, small)
4. **Make "viewer" role actually read-only in the UI** and ship a basic invite flow — the cheapest step toward "team". (P1, medium)
5. **Decide the collaboration story.** Even async (comments + presence-lite + edit-share-links) would reposition this from personal tool to team product. (Strategic, large)

Everything in "works amazingly" is genuinely good — the foundation is strong. The gap between "impressive demo" and "a team relies on this daily" is: **speed, honest file handling, and collaboration.**
