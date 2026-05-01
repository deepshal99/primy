# Drafta v1.0 — Engineering Review (gstack /plan-eng-review)

**Date:** 2026-05-01
**Mode:** BIG CHANGE
**Reviewer:** plan-eng-review skill
**Source spec:** `2026-05-01-drafta-v1-strategy.md`
**Status:** All review sections complete; decisions committed

---

## Section 1 — Architecture (8 decisions)

### 1. Add `files` table (CRITICAL)

**Problem:** Storage limits cannot be enforced — files only live in Vercel Blob + `messages.attachments` JSONB. No `SUM(bytes)` query possible. Orphan blobs leak.

**Decision:**

```sql
files
├── id (text, pk, nanoid)
├── userId (text, fk users)
├── projectId (text, fk projects, NULL for loose attachments)
├── messageId (text, fk messages, NULL for workspace uploads)
├── blobUrl (varchar(500))
├── originalName (varchar(500))
├── mimeType (varchar(100))
├── bytes (bigint)
├── extractedTextLength (integer, default 0)
├── createdAt (timestamp)
└── deletedAt (timestamp, NULL — soft delete for orphan recovery)

INDEX files_user_id_idx ON files(userId)
INDEX files_project_id_idx ON files(projectId) WHERE projectId IS NOT NULL
INDEX files_message_id_idx ON files(messageId) WHERE messageId IS NOT NULL
```

`/api/upload` writes row in same transaction as blob upload. Storage usage = `SELECT COALESCE(SUM(bytes), 0) FROM files WHERE userId = ? AND deletedAt IS NULL`.

### 2. Atomic SQL usage increment

**Problem:** Concurrent chat messages from same user race on counter increment.

**Decision:** Drizzle `sql` template for atomic increment + UPSERT for first-of-month:

```ts
await db.execute(sql`
  INSERT INTO usage (user_id, month, ai_messages)
  VALUES (${userId}, ${month}, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET ai_messages = usage.ai_messages + 1
  RETURNING ai_messages
`);
```

Increment-and-return = single round trip. Race-free.

### 3. Founding-member grace period

**Problem:** Existing users default to `plan='free'` and would hit 50-msg cap when limits flip on.

**Decision:** Add `proUntil: timestamp` (nullable) on `users`. One-off migration sets `proUntil = now() + interval '60 days'` for all existing users. Plan resolution:

```ts
function effectivePlan(user: User): 'free' | 'pro' {
  if (user.plan === 'pro') return 'pro';
  if (user.proUntil && user.proUntil > new Date()) return 'pro';
  return 'free';
}
```

Reusable for future promos and beta program.

### 4. Gateway abstraction (`src/lib/billing/gateway.ts`)

**Decision:** Day-one interface, NoopGateway impl, swap when picked:

```ts
export interface Gateway {
  createCheckoutSession(opts: { userId: string; plan: 'pro' }): Promise<{ url: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getCustomerPortalUrl(customerId: string): Promise<string>;
  parseWebhook(req: Request): Promise<WebhookEvent>;
}

export type WebhookEvent =
  | { id: string; type: 'subscription.created'; userId: string; subscriptionId: string; renewsAt: Date }
  | { id: string; type: 'subscription.updated'; subscriptionId: string; renewsAt: Date }
  | { id: string; type: 'subscription.canceled'; subscriptionId: string };

export const noopGateway: Gateway = {
  async createCheckoutSession() { throw new Error('Gateway not configured'); },
  async cancelSubscription() { /* no-op */ },
  async getCustomerPortalUrl() { return '/'; },
  async parseWebhook() { throw new Error('Gateway not configured'); },
};
```

### 5. `withPlanLimit(handler, { resource })` HOF

**Decision:** Higher-order function, not Next middleware (DB access constraints):

```ts
// src/lib/billing/withPlanLimit.ts
export function withPlanLimit<T>(
  handler: (req: NextRequest, ctx: PlanCtx) => Promise<T>,
  opts: { resource: 'aiMessages' | 'fileUploads' }
) {
  return async (req: NextRequest) => {
    const session = await auth();
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const user = await getUserWithPlan(session.user.id);
    const plan = effectivePlan(user);

    if (process.env.ENFORCE_PLAN_LIMITS === 'true') {
      const used = await atomicIncrementOrCheck(user.id, opts.resource, PLAN_LIMITS[plan]);
      if (used > PLAN_LIMITS[plan][opts.resource + 'PerMonth']) {
        return Response.json({ error: 'plan_limit_exceeded', plan, limits: PLAN_LIMITS[plan] }, { status: 402 });
      }
    }

    return handler(req, { user, plan });
  };
}
```

DRY across `/api/chat` and `/api/upload`. Testable in isolation.

### 6. Diagram migration safety

**Decision:** Two-step migration in Phase 1:

```
Step A: One-off script archives existing diagrams
  - Reads all rows from project_diagrams
  - Writes JSON dump to Vercel Blob: archived/diagrams/{userId}/{timestamp}.json
  - Stores archive URL in a `migration_logs` table for audit
  - Keeps archives 90 days; restorable on request

Step B: Drop project_diagrams table + delete /src/components/diagram/* + remove from system prompt + remove deps
```

Pragmatic for tiny user base. Recoverable.

### 7. Watermark plan lookup — KISS

**Decision:** Single indexed query on share view. No premature caching. Add Vercel cache (Marketplace Redis) if it becomes a hotspot. Avoids stale-watermark UX bugs.

### 8. `artifact_snapshots` table with plan-aware retention

**Decision:**

```sql
artifact_snapshots
├── id (text, pk, nanoid)
├── userId (text, fk users)        -- denorm for cheap quota query
├── artifactType (varchar(20))     -- 'ku' | 'table' | 'deck'
├── artifactId (text)              -- references project_*
├── label (varchar(100))           -- "after AI edit", "manual save", etc.
├── content (jsonb)                -- full artifact state at snapshot time
└── createdAt (timestamp)

INDEX snap_artifact_idx ON (artifactType, artifactId, createdAt DESC)
INDEX snap_user_idx ON (userId, createdAt DESC)
```

Retention: 5 free / 20 pro per artifact. Vercel cron prunes weekly.

```ts
// src/app/api/cron/prune-snapshots/route.ts
// Vercel cron: 0 3 * * 0 (Sun 3am UTC)
// Delete snapshots beyond retention per (artifactType, artifactId)
```

---

## Section 2 — Code Quality (8 decisions)

### 9. Split `systemPrompt.ts`

**Decision:** Module structure:

```
src/lib/ai/prompts/
├── base.ts              -- routing rules, op block format, tone
├── slashCommands.ts     -- 10 command-specific prompts
├── deck.ts              -- deck-generate / deck-edit specifics
├── contextInjection.ts  -- builds <current_doc>, <project_context>, etc.
└── index.ts             -- composeSystemPrompt(opts) entry point
```

Tree-shakable. Each <5KB. Easier to test prompt changes.

### 10. `src/lib/plans.ts` is single source of truth

**Decision:** Constants only — no env branching. Imported by both client and server.

```ts
export const PLAN_LIMITS = { free: { ... }, pro: { ... } } as const;
export type Plan = keyof typeof PLAN_LIMITS;
export type PlanLimit = typeof PLAN_LIMITS[Plan];
```

### 11. Refactor `modelRouter.ts` to task-keyed registry

**Decision:**

```ts
// src/lib/ai/modelRouter.ts
const MODEL_REGISTRY: Record<Task, ModelConfig> = {
  'chat': { provider: 'openai', model: 'gpt-4.1-mini', maxOutput: 8192 },
  'chat-large': { provider: 'openai', model: 'gpt-4.1', maxOutput: 16384 },
  'deck-generate': { provider: 'google', model: 'gemini-3.1-pro-preview', maxOutput: 65536 },
  'deck-edit': { provider: 'google', model: 'gemini-3.1-pro-preview', maxOutput: 32768 },
  'title': { provider: 'openai', model: 'gpt-4.1-mini', maxOutput: 256 },
  'summarize': { provider: 'openai', model: 'gpt-4.1', maxOutput: 4096 },
  'embedding': { provider: 'openai', model: 'text-embedding-3-small' },
};

export function getModel(task: Task): ModelConfig {
  return MODEL_REGISTRY[task];
}
```

Single lookup. Provider-first branching gone.

### 12. `<ShareWatermark/>` rendered once

**Decision:** Layout-level component. Receives `ownerEffectivePlan` from server-component data.

```tsx
// src/components/share/ShareWatermark.tsx
export function ShareWatermark({ plan }: { plan: 'free' | 'pro' }) {
  if (plan === 'pro') return null;
  return (
    <a href="/?ref=share" className="fixed bottom-4 right-4 ...">
      Built with Drafta
    </a>
  );
}
```

### 13. Update CLAUDE.md + vision.md

**Decision:** Same PR as Phase 1 cuts. Fix Fortune Sheet → Univer reference. Remove diagrams entity row from entity table. Update milestones.

### 14. Slash command shared structure

**Decision:**

```ts
// src/lib/ai/slashCommands.ts
export interface SlashCommand {
  name: string;             // 'proposal'
  trigger: string;          // '/proposal'
  description: string;      // 'Draft a project proposal'
  icon: LucideIcon;
  systemPromptFor: (ctx: { project: Project, user: User }) => string;
  expectedOps: ('docops' | 'sheetops' | 'deckops')[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'proposal', /* ... */ },
  { name: 'brief', /* ... */ },
  { name: 'status', /* ... */ },
  { name: 'dashboard', /* ... */ },
  { name: 'recap', /* ... */ },
  { name: 'agenda', /* ... */ },
  { name: 'email', /* ... */ },
  { name: 'qbr', /* ... */ },
  { name: 'contract', /* ... */ },
  { name: 'onepager', /* ... */ },
];
```

### 15. `usePlanInfo()` hook

**Decision:**

```ts
// src/hooks/usePlanInfo.ts
export function usePlanInfo() {
  const { data: user } = useQuery(['user'], fetchUser);
  const { data: usage } = useQuery(['usage', monthKey()], fetchUsage);

  if (!user || !usage) return { loading: true };

  const plan = effectivePlan(user);
  const limits = PLAN_LIMITS[plan];

  return {
    loading: false,
    plan,
    proUntil: user.proUntil,
    limits,
    usage,
    percentUsed: {
      aiMessages: (usage.aiMessages / limits.aiMessagesPerMonth) * 100,
      fileUploads: (usage.fileUploads / limits.fileUploadsPerMonth) * 100,
      storage: (usage.storageBytes / limits.storageBytes) * 100,
    },
    isProUntil: !!user.proUntil && user.proUntil > new Date(),
  };
}
```

Used by Settings, watermark, limit modal, slash menu.

### 16. Keep `users.hasOnboarded` boolean

**Decision:** KISS. Coarse is fine for v1. Revisit if onboarding-step abandonment becomes a metric we care about.

---

## Section 3 — Test Review (6 actions, 3 gaps closed)

### 17. Add Vitest

```bash
npm i -D vitest @vitest/ui @vitest/coverage-v8
```

Config: `vitest.config.ts` — Node env, integration tests use Neon test branch via `DATABASE_URL_TEST` env.

```
tests/
├── lib/
│   ├── billing/
│   │   ├── withPlanLimit.test.ts
│   │   ├── effectivePlan.test.ts
│   │   └── usage.test.ts          ← atomic increment
│   ├── ai/
│   │   ├── modelRouter.test.ts
│   │   └── slashCommands.test.ts  ← golden fixtures
│   └── plans.test.ts
├── api/
│   ├── chat.test.ts
│   ├── upload.test.ts             ← transactional integrity
│   └── billing-webhook.test.ts    ← idempotency scaffold
└── fixtures/
    ├── slash-proposal-input.json
    └── slash-proposal-expected.json
```

### 18. Atomic increment integration test

```ts
test('concurrent increments are race-free', async () => {
  const userId = await createTestUser();
  await Promise.all(
    Array.from({ length: 10 }, () => incrementUsage(userId, 'aiMessages'))
  );
  const final = await getUsage(userId);
  expect(final.aiMessages).toBe(10);
});
```

### 19. Limit enforcement matrix

```ts
describe('withPlanLimit', () => {
  test.each([
    ['free user under cap',           { plan: 'free', used: 49 }, 200],
    ['free user at cap',              { plan: 'free', used: 50 }, 402],
    ['free user over cap',            { plan: 'free', used: 51 }, 402],
    ['pro user always allowed',       { plan: 'pro',  used: 9999 }, 200],
    ['proUntil-future treated as pro',{ plan: 'free', proUntil: '+30d', used: 9999 }, 200],
    ['proUntil-past treated as free', { plan: 'free', proUntil: '-1d',  used: 51 }, 402],
  ])('%s', async (_, ctx, expectedStatus) => { /* ... */ });
});
```

### 20. Webhook idempotency scaffold

```ts
test('replayed webhook does not double-upgrade', async () => {
  const event = mockWebhookEvent({ type: 'subscription.created', userId: 'u1' });
  await processWebhook(event);
  await processWebhook(event); // replay
  const user = await getUser('u1');
  expect(user.plan).toBe('pro');
  // assert no duplicate audit log entries either
});
```

### 21. Slash command golden fixtures

```ts
test('slash /proposal generates expected ops shape', async () => {
  const input = await readFixture('slash-proposal-input.json');
  const ops = await runChat(input);
  expect(ops).toContainEqual(expect.objectContaining({ type: 'kuops' }));
  expect(ops[0].operations[0].action).toBe('CREATE_KU');
});
```

### 22. Phase 1 cuts — gstack `/qa` smoke test

After Phase 1 deploy: `/qa staging.drafta.so --quick` → assert no diagram-related errors, no broken AI flows, all entity types open correctly.

### Critical gaps closed

- **Files transactional integrity:** test rolls back DB row when blob fails (and vice versa)
- **Concurrent usage increment:** explicit Promise.all test
- **Snapshot prune cron failure:** alerting via Vercel function logs (Sentry as v1.1)

---

## Section 4 — Performance (5 decisions)

### 23. Cache plan in JWT

**Decision:** Encode `plan` + `proUntil` in NextAuth JWT. Refresh on plan change events. Reduces chat path from 4-5 DB hits → 1 (atomic increment only).

### 24. Snapshot list — metadata only

**Decision:** `GET /api/snapshots/{type}/{id}` returns `[{ id, label, createdAt }]`. Content fetched only on `POST /api/snapshots/{id}/restore`.

### 25. Landing page static

**Decision:** `export const dynamic = 'force-static'` + `revalidate: 3600`. Zero DB.

### 26. Pricing page static

**Decision:** Same. Pure presentational.

### 27. Files table indexing

**Decision:** Index on `(userId)`, partial index on `(userId) WHERE deletedAt IS NULL` for fast quota queries.

---

## NOT in scope (deferred)

- Real-time collaboration (Yjs/PartyKit) — defer v1.2+
- Workspace inbox (per-workspace email) — defer v1.2+
- Custom domains for share links — defer v1.2+
- Full LLM eval suite — fixture tests sufficient for v1.0
- Sentry / OpenTelemetry — defer until first paying customer
- Mobile responsive pass — banner instead
- Soft-delete on entities — only on `files` for now
- Multi-currency pricing — single USD price for v1.0

## What already exists (reused, not rebuilt)

- `users` table + NextAuth → extended for plan
- Vercel Blob storage → referenced by new `files` table
- Sonner toast + Radix Dialog → limit-reached modal
- Zustand undo/redo → snapshot history UI layer
- ChatInput mention popover pattern → slash command menu
- Plate.js fenced-code rendering → inline mermaid replacement
- `users.hasOnboarded` field → wire up in Phase 3
- 4 ReadOnly viewers → watermark layout wrapper
- `src/lib/design.ts` design tokens → polish foundation
- `modelRouter.ts` task-based selection → Phase 1 simplification
- `/api/embeddings` + relevance scoring → untouched

## TODOs added (deferred work, tracked)

1. **Pick + integrate payment gateway** (Paddle / Lemon Squeezy / Razorpay) — blocked-by: Phase 5 soft launch ending
2. **Real-time collaboration via Yjs** — blocked-by: 3+ team-tier signups
3. **AI eval suite expansion** — blocked-by: 3+ AI quality regressions in production
4. **Sentry / observability** — blocked-by: first paying customer

## Failure modes registry

```
CODEPATH                          | FAILURE MODE                  | TEST | RESCUE | USER SEES
──────────────────────────────────|───────────────────────────────|──────|────────|────────────
withPlanLimit (chat)              | Concurrent over-cap           | ✅   | ✅      | 402 modal
withPlanLimit (upload)            | Race on storage limit         | ✅   | ✅      | 402 modal
files insert + blob upload        | DB succeeds, blob fails       | ✅   | ✅ rb   | error toast
files insert + blob upload        | Blob succeeds, DB fails       | ✅   | ✅ rb   | error toast
resolvePlan with stale proUntil   | proUntil expires mid-request  | ✅   | ✅      | correct
NoopGateway → real swap           | Webhooks pre-swap             | N/A  | N/A    | none
artifact_snapshots prune cron     | Cron fails                    | ✅   | ⚠ logs | slow degrade
slash command parse error         | LLM returns malformed JSON    | ✅   | ✅      | retry CTA
```

All 3 originally critical gaps now have tests + rescue paths.

## Completion summary

```
+============================================================+
|              PLAN-ENG-REVIEW — DRAFTA v1.0                 |
+============================================================+
| Mode                  | BIG CHANGE                         |
| Step 0 (scope)        | 30+ files; complexity acknowledged |
| Architecture issues   | 8 — all decisions committed        |
| Code Quality issues   | 8 — all decisions committed        |
| Test Review actions   | 6 — Vitest + scaffolding           |
| Performance issues    | 5 — all decisions committed        |
| Critical gaps         | 0 unresolved                       |
| NOT in scope          | 8 items deferred                   |
| Reused components     | 11 mapped                          |
| TODOs added           | 4                                  |
+============================================================+
```

## Status

- ✅ Engineering review complete (2026-05-01)
- ⏭ Next: implementation plan via `superpowers:writing-plans`
- ⏭ Then: parallel agent execution via `superpowers:dispatching-parallel-agents`
