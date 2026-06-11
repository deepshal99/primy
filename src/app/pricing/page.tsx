import type { Metadata } from "next";
import { Check, Minus, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTAButton } from "@/components/marketing/CTAButton";
import { PLAN_LIMITS, PRO_PRICE_USD } from "@/lib/plans";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing | Primy",
  description:
    "Simple pricing for Primy. Free forever. Upgrade to Pro for unlimited workspaces, more AI messages, and brand profiles.",
};

/* ──────────────────────────────────────────────
   Pricing helpers — pulled from PLAN_LIMITS
   ────────────────────────────────────────────── */

function fmtCount(n: number): string {
  if (!isFinite(n)) return "Unlimited";
  return n.toLocaleString();
}

function fmtBytes(n: number): string {
  if (!isFinite(n)) return "Unlimited";
  if (n >= 1024 * 1024 * 1024) {
    return `${Math.round(n / (1024 * 1024 * 1024))} GB`;
  }
  return `${Math.round(n / (1024 * 1024))} MB`;
}

function fmtBool(v: boolean): React.ReactNode {
  return v ? (
    <Check className="w-4 h-4" strokeWidth={2.25} style={{ color: "#171717" }} />
  ) : (
    <Minus className="w-4 h-4" strokeWidth={2} style={{ color: "#a3a3a3" }} />
  );
}

/* ──────────────────────────────────────────────
   Page
   ────────────────────────────────────────────── */

export default function PricingPage() {
  return (
    <div
      className="min-h-screen bg-white text-[#171717]"
      style={{ fontFeatureSettings: "'tnum'" }}
    >
      <MarketingNav />
      <main>
        <Header />
        <PricingCards />
        <FeatureMatrix />
        <FAQ />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Header
   ────────────────────────────────────────────── */

function Header() {
  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 pt-20 lg:pt-24 pb-12 text-center">
        <h1
          className="text-[40px] sm:text-[52px] tracking-[-0.025em] text-[#171717]"
          style={{ fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif" }}
        >
          Simple pricing. No surprises.
        </h1>
        <p className="mt-5 text-[16px] leading-[1.6] text-[#525252] max-w-[520px] mx-auto">
          Free forever. Upgrade when you grow.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   3-column cards
   ────────────────────────────────────────────── */

function PricingCards() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;

  return (
    <section>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {/* Free */}
          <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white p-7 flex flex-col">
            <h2 className="text-[18px] tracking-[-0.01em]" style={{ fontWeight: 500 }}>
              Free
            </h2>
            <p className="text-[13px] text-[#737373] mt-1 mb-5">
              For trying out the workspace.
            </p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-[40px] tabular-nums leading-none" style={{ fontWeight: 500 }}>
                $0
              </span>
              <span className="text-[14px] text-[#737373]">/mo</span>
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#525252] mb-7 flex-1">
              <Row>{free.workspaces} workspace</Row>
              <Row>{fmtCount(free.aiMessagesPerMonth)} AI messages / month</Row>
              <Row>{fmtCount(free.fileUploadsPerMonth)} file uploads / month</Row>
              <Row>{fmtBytes(free.storageBytes)} storage</Row>
              <Row>Public share links (with watermark)</Row>
            </ul>
            <CTAButton href="/login?mode=signup" variant="secondary" className="w-full">
              Get started
            </CTAButton>
          </div>

          {/* Pro */}
          <div
            className="rounded-[12px] border bg-white p-7 flex flex-col relative"
            style={{
              borderColor: "rgba(255,180,63,0.30)",
              boxShadow: "0 8px 30px rgba(255,180,63,0.08)",
            }}
          >
            <div
              className="absolute -top-2.5 left-7 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium uppercase tracking-wider text-white"
              style={{ backgroundColor: "#1A1815" }}
            >
              Most popular
            </div>
            <h2 className="text-[18px] tracking-[-0.01em]" style={{ fontWeight: 500 }}>
              Pro
            </h2>
            <p className="text-[13px] text-[#737373] mt-1 mb-5">
              For getting real work shipped.
            </p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-[40px] tabular-nums leading-none" style={{ fontWeight: 500 }}>
                ${PRO_PRICE_USD}
              </span>
              <span className="text-[14px] text-[#737373]">/mo</span>
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#525252] mb-7 flex-1">
              <Row>Unlimited workspaces</Row>
              <Row>{fmtCount(pro.aiMessagesPerMonth)} AI messages / month</Row>
              <Row>Unlimited file uploads</Row>
              <Row>{fmtBytes(pro.storageBytes)} storage</Row>
              <Row>No &quot;Built with Primy&quot; watermark</Row>
              <Row>Brand voice + visual profiles</Row>
              <Row>Full slash command set</Row>
              <Row>Snapshot history (20 per artifact)</Row>
            </ul>
            <CTAButton href="/login?mode=signup" variant="primary" className="w-full">
              Get started
            </CTAButton>
            <p className="mt-3 text-[11px] text-center text-[#737373] leading-relaxed">
              Coming soon. Beta users get Pro free for 60 days.
            </p>
          </div>

          {/* Team — coming soon */}
          <div className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-[#fafafa] p-7 flex flex-col relative">
            <div className="absolute top-4 right-4 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#737373] bg-white border border-[rgba(0,0,0,0.08)]">
              Coming soon
            </div>
            <h2 className="text-[18px] tracking-[-0.01em] text-[#525252]" style={{ fontWeight: 500 }}>
              Team
            </h2>
            <p className="text-[13px] text-[#a3a3a3] mt-1 mb-5">
              For shipping with a team.
            </p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-[40px] tabular-nums leading-none text-[#525252]" style={{ fontWeight: 500 }}>
                $20
              </span>
              <span className="text-[14px] text-[#a3a3a3]">/seat</span>
            </div>
            <ul className="space-y-2.5 text-[13px] text-[#737373] mb-7 flex-1">
              <Row muted>Everything in Pro</Row>
              <Row muted>Shared workspaces</Row>
              <Row muted>Member roles</Row>
              <Row muted>Custom domains for shares</Row>
              <Row muted>Priority support</Row>
            </ul>
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center h-9 rounded-[6px] text-[13px] font-medium border border-[rgba(0,0,0,0.06)] bg-white text-[#a3a3a3] cursor-not-allowed"
            >
              Available v1.2
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Check
        className="mt-[3px] w-3.5 h-3.5 flex-shrink-0"
        strokeWidth={2.25}
        style={{ color: muted ? "#a3a3a3" : "#171717" }}
      />
      <span>{children}</span>
    </li>
  );
}

/* ──────────────────────────────────────────────
   Feature comparison matrix
   ────────────────────────────────────────────── */

function FeatureMatrix() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;

  const sections: { title: string; rows: { label: string; free: React.ReactNode; pro: React.ReactNode }[] }[] = [
    {
      title: "Limits",
      rows: [
        {
          label: "Workspaces",
          free: <span className="tabular-nums">{fmtCount(free.workspaces)}</span>,
          pro: <span className="tabular-nums">Unlimited</span>,
        },
        {
          label: "AI messages / month",
          free: <span className="tabular-nums">{fmtCount(free.aiMessagesPerMonth)}</span>,
          pro: <span className="tabular-nums">{fmtCount(pro.aiMessagesPerMonth)}</span>,
        },
        {
          label: "File uploads / month",
          free: <span className="tabular-nums">{fmtCount(free.fileUploadsPerMonth)}</span>,
          pro: <span className="tabular-nums">Unlimited</span>,
        },
        {
          label: "Storage",
          free: <span className="tabular-nums">{fmtBytes(free.storageBytes)}</span>,
          pro: <span className="tabular-nums">{fmtBytes(pro.storageBytes)}</span>,
        },
        {
          label: "Snapshot history per artifact",
          free: <span className="tabular-nums">{fmtCount(free.snapshotsPerArtifact)}</span>,
          pro: <span className="tabular-nums">{fmtCount(pro.snapshotsPerArtifact)}</span>,
        },
      ],
    },
    {
      title: "Features",
      rows: [
        {
          label: "Documents, spreadsheets, decks",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
        {
          label: "Project memory across files",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
        {
          label: "Drag-in file extraction (PDF, DOCX, XLSX)",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
        {
          label: "Public share links",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
        {
          label: '"Built with Primy" watermark on shares',
          free: fmtBool(free.watermarkOnShares),
          pro: fmtBool(pro.watermarkOnShares),
        },
        {
          label: "Brand voice profiles",
          free: fmtBool(false),
          pro: fmtBool(pro.brandProfiles),
        },
        {
          label: "Brand visual profiles",
          free: fmtBool(false),
          pro: fmtBool(pro.brandProfiles),
        },
        {
          label: "Magic slash commands (full set)",
          free: fmtBool(false),
          pro: fmtBool(pro.fullSlashCommands),
        },
        {
          label: "Server-side PDF export",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
        {
          label: "PowerPoint (.pptx) export",
          free: fmtBool(true),
          pro: fmtBool(true),
        },
      ],
    },
  ];

  return (
    <section className="bg-[#fafafa] border-y border-[rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-20 lg:py-24">
        <h2
          className="text-[28px] sm:text-[32px] tracking-[-0.02em] text-[#171717] mb-10 text-center"
          style={{ fontWeight: 500 }}
        >
          Compare plans
        </h2>

        <div className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-white overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-[rgba(0,0,0,0.06)]">
            <div className="px-5 py-4 text-[12px] uppercase tracking-[0.08em] font-medium text-[#737373]">
              Plan
            </div>
            <div className="px-5 py-4 text-[12px] uppercase tracking-[0.08em] font-medium text-[#737373]">
              Free
            </div>
            <div
              className="px-5 py-4 text-[12px] uppercase tracking-[0.08em] font-medium"
              style={{ color: "#B87426" }}
            >
              Pro
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <div className="grid grid-cols-[2fr_1fr_1fr] bg-[#fafafa] border-y border-[rgba(0,0,0,0.04)]">
                <div className="px-5 py-2.5 text-[11px] uppercase tracking-[0.08em] font-medium text-[#525252]">
                  {section.title}
                </div>
                <div />
                <div />
              </div>
              {section.rows.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr] items-center border-b last:border-b-0 border-[rgba(0,0,0,0.04)]"
                >
                  <div className="px-5 py-3.5 text-[13px] text-[#171717]">{row.label}</div>
                  <div className="px-5 py-3.5 text-[13px] text-[#525252]">{row.free}</div>
                  <div className="px-5 py-3.5 text-[13px] text-[#171717]">{row.pro}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FAQ — native <details>
   ────────────────────────────────────────────── */

function FAQ() {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "What happens when I hit a limit?",
      a: (
        <>
          You&apos;ll see a friendly modal with the limit you reached and a single
          upgrade button. Until limits go live in production, every signup
          gets Pro behavior so the beta runs unblocked.
        </>
      ),
    },
    {
      q: "Can I cancel anytime?",
      a: <>Yes. Cancel from Settings, and your plan stays active until the end of the billing period.</>,
    },
    {
      q: "Do you offer refunds?",
      a: <>Yes. Full refund within 7 days of any charge, no questions asked. Email us and we&apos;ll process it the same day.</>,
    },
    {
      q: "Is my data private?",
      a: (
        <>
          Yes. Your files and artifacts are used only as context for AI inside
          your own project. We never train models on your content and never
          share it with third parties.
        </>
      ),
    },
    {
      q: "What payment methods do you accept?",
      a: (
        <>
          Coming soon. We&apos;ll integrate Razorpay, Paddle, or Lemon Squeezy
          depending on your region. For the beta, every user is on the house.
        </>
      ),
    },
    {
      q: "Can I use my own AI key?",
      a: (
        <>
          No. We use volume pricing on a single managed AI account so we can
          keep Pro at a flat rate without surprise overages. It also keeps
          billing simple: one subscription, no metered side-charges.
        </>
      ),
    },
  ];

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[760px] px-6 lg:px-8 py-20 lg:py-24">
        <h2
          className="text-[28px] sm:text-[32px] tracking-[-0.02em] text-[#171717] mb-10 text-center"
          style={{ fontWeight: 500 }}
        >
          Frequently asked
        </h2>

        <div className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-white overflow-hidden">
          {items.map((item, i) => (
            <details
              key={i}
              className="group border-b last:border-b-0 border-[rgba(0,0,0,0.06)]"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-[rgba(0,0,0,0.02)] transition-colors duration-150">
                <span className="text-[14px] font-medium text-[#171717]">
                  {item.q}
                </span>
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full border border-[rgba(0,0,0,0.08)] text-[#525252] transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M6 1.5v9M1.5 6h9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 pt-0 text-[13.5px] leading-[1.65] text-[#525252]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Final CTA
   ────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: "#1A1815" }}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.10]" aria-hidden>
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px bg-white"
            style={{
              top: `${15 + i * 11}%`,
              left: "10%",
              width: `${30 + ((i * 13) % 50)}%`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1200px] px-6 lg:px-8 py-20 lg:py-24 text-center">
        <h2
          className="text-[32px] sm:text-[44px] tracking-[-0.02em] text-white"
          style={{ fontWeight: 500 }}
        >
          Start with one project.
          <br />
          Free forever.
        </h2>
        <p className="mt-5 text-[15px] text-white/85 max-w-[480px] mx-auto leading-relaxed">
          Upgrade when you outgrow it. No credit card to begin.
        </p>
        <div className="mt-9">
          <CTAButton href="/login?mode=signup" variant="inverse" size="lg">
            Get started
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
