import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminStats } from "@/lib/admin/stats";

// Admin monitoring dashboard. Super-admin only (users.is_super_admin). Renders
// 404 for everyone else so its existence isn't leaked.
export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const [me] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me?.isSuperAdmin) notFound();

  const s = await getAdminStats();

  return (
    <div style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-[1000px] px-6 py-10">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Admin</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          Internal monitoring · {s.spend.monthLabel}
        </p>

        {/* Top metric cards */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Users" value={s.users.total.toLocaleString()} sub={`+${s.users.new7d} this week`} />
          <Stat label="Active (7d)" value={s.activity.activeUsers7d.toLocaleString()} sub="sent a message" />
          <Stat label="Projects" value={s.activity.projects.toLocaleString()} sub="not deleted" />
          <Stat
            label={`AI spend · ${s.spend.monthLabel.split(" ")[0]}`}
            value={dollars(s.spend.monthCents)}
            sub={`${s.spend.monthCalls.toLocaleString()} calls`}
            accent
          />
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Pro (plan)" value={s.users.proPlan.toLocaleString()} />
          <Stat label="On grace" value={s.users.onGrace.toLocaleString()} />
          <Stat label="New (30d)" value={s.users.new30d.toLocaleString()} />
          <Stat label="Orgs" value={s.orgs.length.toLocaleString()} />
        </div>

        {/* Top spenders */}
        <Section title="Top AI spenders this month">
          {s.topSpenders.length === 0 ? (
            <Empty>No usage recorded yet this month.</Empty>
          ) : (
            <Table head={["User", "Calls", "Est. cost"]}>
              {s.topSpenders.map((r) => (
                <tr key={r.email} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <div className="font-medium">{r.name || r.email}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{r.email}</div>
                  </Td>
                  <Td num>{r.calls.toLocaleString()}</Td>
                  <Td num>{dollars(r.cents)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        {/* Spend by model */}
        <Section title="Spend by model this month">
          {s.byModel.length === 0 ? (
            <Empty>No usage recorded yet this month.</Empty>
          ) : (
            <Table head={["Model", "Calls", "Est. cost"]}>
              {s.byModel.map((r) => (
                <tr key={r.model} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>{r.model}</Td>
                  <Td num>{r.calls.toLocaleString()}</Td>
                  <Td num>{dollars(r.cents)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        {/* Orgs */}
        <Section title="Organizations">
          {s.orgs.length === 0 ? (
            <Empty>No organizations yet.</Empty>
          ) : (
            <Table head={["Name", "Plan", "Members"]}>
              {s.orgs.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>{o.name}</Td>
                  <Td>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: o.plan === "pro" ? "rgba(255,180,63,0.14)" : "var(--muted)",
                        color: o.plan === "pro" ? "var(--accent-amber-deep)" : "var(--ink-3)",
                      }}
                    >
                      {o.plan}
                    </span>
                  </Td>
                  <Td num>{o.members}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <p className="mt-8 text-[11px]" style={{ color: "var(--ink-3)" }}>
          Costs are estimates from the token-usage log (provider list prices). Raw token counts are
          the source of truth.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="px-4 py-3.5 tabular-nums"
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: accent ? "rgba(255,180,63,0.08)" : "var(--card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>{title}</h2>
      <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={{ background: "var(--secondary)" }}>
          {head.map((h, i) => (
            <th
              key={h}
              className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--ink-3)", textAlign: i === 0 ? "left" : "right" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <td className="px-4 py-2.5 tabular-nums" style={{ textAlign: num ? "right" : "left" }}>
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-[13px]" style={{ color: "var(--ink-3)" }}>{children}</div>;
}
