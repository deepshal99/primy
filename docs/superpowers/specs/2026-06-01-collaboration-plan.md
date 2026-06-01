# Collaboration & Teams — Plan (Fix #5)

**Date:** 2026-06-01
**Context:** The stress test found collaboration is the biggest gap between "personal tool" and "team product." The role model (`projectAccess.ts` + `project_members`) and now a members/invite API + read-only AI gate (fix #4) exist. This plan sequences the rest — cheapest-first — and makes the build-vs-defer call on real-time.

---

## Where we are after fixes #1–#4
- ✅ Roles in DB + `requireProjectAccess` (owner/editor/commenter/viewer).
- ✅ Members API: invite-by-email (existing users), list, remove.
- ✅ `myRole` exposed to the client; AI mutations blocked for view-only roles.
- ❌ No invite **UI**. ❌ Manual edit/delete controls not yet disabled for viewers. ❌ No comments, presence, or real-time co-editing. ❌ No email invites for non-users.

---

## Recommendation: **async-first collaboration, not real-time (yet)**

Real-time co-editing (Yjs/PartyKit) is weeks of work and operational risk (CRDT, presence infra, conflict UX) for a benefit most of these ICPs (solo founders, marketers, SMB ops, students) feel rarely. **Async collaboration delivers ~80% of the team value for ~20% of the cost** and is the right next step. Real-time stays deferred (already noted in the migration plan) until usage proves demand.

The async pillars, in priority order:

### Phase A — Make sharing real (days)
1. **Invite UI** in the share modal: email field + role picker → POST `/api/projects/[id]/members`; list members with role + remove. (API already done.)
2. **Full read-only enforcement**: gate manual mutation controls (create/rename/delete/move, sheet & doc editors, deck editor) on `currentProjectRole`. Add a `canEdit` selector in the store (`role ∈ {owner, editor}`) and a small `useCanEdit()` hook; show a "View only" badge in the header. (AI path already gated.)
3. **Edit share-links**: wire the existing `shareLinks.permission: view|edit` + `expiresAt` (table already exists) so a link can grant edit, with optional expiry.

### Phase B — Async teamwork (1–2 weeks)
4. **Comments**: the schema's `activityEvents` already models `commented`. Add a comments table keyed to entity + range/anchor, a thread UI in the right rail, and resolve/reopen. Start doc-level, then range-anchored.
5. **@mentions + notifications**: `message.mentionedEntities` exists; extend to `@user`. On mention/assignment, write an `activityEvents` row and (Phase C) email.
6. **Activity feed**: render `activityEvents` ("Maya edited Budget Tracker · 2h ago") in the project home — cheap, high signal for teams.
7. **Email invites for non-users**: `project_members.status="pending"` + a token + Resend email (the reset-password flow is a template). Accept on signup.

### Phase C — Presence-lite (optional, before full real-time)
8. **Soft presence**: "Maya is viewing" via a lightweight heartbeat (poll or SSE) — no CRDT. Plus a "last edited by X" stamp and a non-blocking "someone else edited this" banner to mitigate last-write-wins.

### Deferred — Full real-time co-editing
- Yjs + PartyKit for live multi-cursor editing on docs/sheets. Only when async + presence-lite prove the demand. This is the existing v1.2+ deferral; don't pull it forward.

---

## Concrete near-term backlog (ranked)
1. Invite UI + member list in share modal (API ready). — **highest value, low effort**
2. `canEdit` selector + disable manual edit controls for viewers; "View only" badge.
3. Edit-permission share links + expiry (schema ready).
4. Activity feed from `activityEvents`.
5. Comments (doc-level → ranged).
6. Email invites for non-users (pending status + Resend).
7. Presence-lite heartbeat.

## Data-loss guardrail (do alongside Phase A)
Until presence exists, concurrent edits are last-write-wins. Cheap mitigations now: keep the autosave + snapshot history (already present), and add a "this project changed on the server since you opened it — reload?" check on save conflict. Prevents silent overwrite without real-time infra.

---

**Bottom line:** ship Phase A (invite UI + full read-only + edit links) to make Primy genuinely usable by a small team this week. Phase B (comments/mentions/activity/email-invites) makes it sticky. Hold real-time until the data says build it.
