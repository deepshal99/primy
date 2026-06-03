import { db } from "@/db";
import { users, organizations, orgMembers, tokenUsageLog, projects } from "@/db/schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";

// ── Admin stats ──
//
// Read-only aggregates for the super-admin dashboard. All queries are scoped
// to lightweight counts/sums so the page stays cheap. Server-only.

export interface AdminStats {
  users: { total: number; new7d: number; new30d: number; proPlan: number; onGrace: number };
  activity: { activeUsers7d: number; projects: number };
  spend: { monthCents: number; monthCalls: number; monthLabel: string };
  topSpenders: { email: string; name: string; cents: number; calls: number }[];
  orgs: { id: string; name: string; plan: string; members: number }[];
  byModel: { model: string; calls: number; cents: number }[];
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function getAdminStats(): Promise<AdminStats> {
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const [
    [usersTotal],
    [usersNew7d],
    [usersNew30d],
    [usersPro],
    [usersGrace],
    [active7d],
    [projTotal],
    [spend],
    topSpenders,
    orgRows,
    byModel,
  ] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(users).where(gte(users.createdAt, d7)),
    db.select({ c: count() }).from(users).where(gte(users.createdAt, d30)),
    db.select({ c: count() }).from(users).where(eq(users.plan, "pro")),
    db
      .select({ c: count() })
      .from(users)
      .where(and(sql`${users.plan} <> 'pro'`, sql`${users.proUntil} is not null`, sql`${users.proUntil} > now()`)),
    db
      .select({ c: sql<number>`count(distinct ${tokenUsageLog.userId})` })
      .from(tokenUsageLog)
      .where(gte(tokenUsageLog.createdAt, d7)),
    db.select({ c: count() }).from(projects).where(sql`${projects.deletedAt} is null`),
    db
      .select({
        cents: sql<number>`coalesce(sum(${tokenUsageLog.estCostCents}),0)`,
        calls: count(),
      })
      .from(tokenUsageLog)
      .where(gte(tokenUsageLog.createdAt, monthStart)),
    db
      .select({
        email: users.email,
        name: users.name,
        cents: sql<number>`coalesce(sum(${tokenUsageLog.estCostCents}),0)`,
        calls: sql<number>`count(*)`,
      })
      .from(tokenUsageLog)
      .innerJoin(users, eq(users.id, tokenUsageLog.userId))
      .where(gte(tokenUsageLog.createdAt, monthStart))
      .groupBy(users.email, users.name)
      .orderBy(desc(sql`sum(${tokenUsageLog.estCostCents})`))
      .limit(10),
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        plan: organizations.plan,
        members: sql<number>`count(${orgMembers.id})`,
      })
      .from(organizations)
      .leftJoin(orgMembers, and(eq(orgMembers.orgId, organizations.id), eq(orgMembers.status, "active")))
      .groupBy(organizations.id, organizations.name, organizations.plan)
      .orderBy(desc(organizations.createdAt)),
    db
      .select({
        model: tokenUsageLog.model,
        calls: sql<number>`count(*)`,
        cents: sql<number>`coalesce(sum(${tokenUsageLog.estCostCents}),0)`,
      })
      .from(tokenUsageLog)
      .where(gte(tokenUsageLog.createdAt, monthStart))
      .groupBy(tokenUsageLog.model)
      .orderBy(desc(sql`sum(${tokenUsageLog.estCostCents})`)),
  ]);

  return {
    users: {
      total: Number(usersTotal?.c ?? 0),
      new7d: Number(usersNew7d?.c ?? 0),
      new30d: Number(usersNew30d?.c ?? 0),
      proPlan: Number(usersPro?.c ?? 0),
      onGrace: Number(usersGrace?.c ?? 0),
    },
    activity: { activeUsers7d: Number(active7d?.c ?? 0), projects: Number(projTotal?.c ?? 0) },
    spend: {
      monthCents: Number(spend?.cents ?? 0),
      monthCalls: Number(spend?.calls ?? 0),
      monthLabel,
    },
    topSpenders: topSpenders.map((r) => ({
      email: r.email,
      name: r.name,
      cents: Number(r.cents),
      calls: Number(r.calls),
    })),
    orgs: orgRows.map((r) => ({ id: r.id, name: r.name, plan: r.plan, members: Number(r.members) })),
    byModel: byModel.map((r) => ({ model: r.model, calls: Number(r.calls), cents: Number(r.cents) })),
  };
}
