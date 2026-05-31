import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Sheet,
  Presentation,
  Sparkles,
  Layers,
  Brain,
  Upload,
  Check,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTAButton } from "@/components/marketing/CTAButton";
import { RedirectIfAuthenticated } from "@/components/marketing/RedirectIfAuthenticated";
import { PLAN_LIMITS, PRO_PRICE_USD } from "@/lib/plans";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Drafta — The AI workspace for docs, sheets, and decks",
  description:
    "Chat to create and edit docs, sheets, and decks. Drag in any file. Project memory keeps everything connected — so you never copy-paste from ChatGPT again.",
};

/* ──────────────────────────────────────────────
   Marketing landing
   Pure server component. Static.
   ────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-white text-[#171717]"
      style={{ fontFeatureSettings: "'tnum'" }}
    >
      <RedirectIfAuthenticated />
      <MarketingNav />
      <main>
        <Hero />
        <ValueProps />
        <KillerDemo />
        <Artifacts />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Hero — split layout, asymmetric
   ────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 pt-20 lg:pt-28 pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left: copy */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[rgba(0,0,0,0.08)] bg-white text-[11px] font-medium text-[#525252] mb-6">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#FFB43F" }}
              />
              <span>Now in beta — Pro free for 60 days</span>
            </div>

            <h1
              className="text-[40px] sm:text-[52px] lg:text-[60px] leading-[1.04] tracking-[-0.025em] text-[#171717]"
              style={{ fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif" }}
            >
              The AI workspace
              <br />
              for docs, sheets,
              <br />
              and decks.
            </h1>

            <p className="mt-6 max-w-[520px] text-[16px] leading-[1.6] text-[#525252]">
              Chat to create and edit them all. Drag in any file.
              Project memory keeps everything connected — so you
              never copy-paste from ChatGPT again.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAButton href="/login?mode=signup" variant="primary" size="lg">
                Get started — free
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.25} />
              </CTAButton>
              <CTAButton href="/pricing" variant="ghost" size="lg">
                See pricing
              </CTAButton>
            </div>

            <div className="mt-8 flex items-center gap-5 text-[12px] text-[#737373]">
              <div className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" strokeWidth={2.25} style={{ color: "#42c366" }} />
                Free forever plan
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" strokeWidth={2.25} style={{ color: "#42c366" }} />
                No credit card
              </div>
            </div>
          </div>

          {/* Right: staged product preview */}
          <div className="lg:col-span-6">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="relative">
      {/* Soft gradient halo behind */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[24px] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(255,180,63,0.10) 0%, rgba(255,180,63,0) 60%)",
        }}
      />
      <div
        className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.04)]"
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(0,0,0,0.10)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(0,0,0,0.10)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(0,0,0,0.10)]" />
          </div>
          <div className="text-[10px] text-[#a3a3a3] tracking-wide">
            drafta.preview
          </div>
          <div className="w-12" />
        </div>

        {/* Inner mock UI: chat + workspace */}
        <div className="rounded-[12px] bg-white border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <div className="grid grid-cols-12 min-h-[380px]">
            {/* Sidebar */}
            <div className="col-span-3 border-r border-[rgba(0,0,0,0.06)] bg-[#fafafa] p-3">
              <div className="text-[9px] uppercase tracking-wider text-[#a3a3a3] font-medium mb-2 px-1">
                Project
              </div>
              <div className="space-y-1">
                <MockSidebarRow color="#2a6dfb" label="Brand brief" active />
                <MockSidebarRow color="#42c366" label="Q3 metrics" />
                <MockSidebarRow color="#FFAD45" label="Launch deck" />
              </div>
              <div className="mt-4 text-[9px] uppercase tracking-wider text-[#a3a3a3] font-medium mb-2 px-1">
                Files
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-[#737373] px-1.5 py-1 rounded-[4px] hover:bg-[rgba(0,0,0,0.03)] truncate">
                  research.pdf
                </div>
                <div className="text-[10px] text-[#737373] px-1.5 py-1 rounded-[4px] hover:bg-[rgba(0,0,0,0.03)] truncate">
                  customers.csv
                </div>
              </div>
            </div>

            {/* Workspace */}
            <div className="col-span-6 border-r border-[rgba(0,0,0,0.06)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-3 h-3" style={{ color: "#2a6dfb" }} strokeWidth={2} />
                <span className="text-[11px] font-medium text-[#171717]">Brand brief</span>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "82%" }} />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.05)]" style={{ width: "94%" }} />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.05)]" style={{ width: "70%" }} />
                <div className="h-3" />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "38%" }} />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.05)]" style={{ width: "88%" }} />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.05)]" style={{ width: "62%" }} />
                <div className="h-2 rounded-full bg-[rgba(0,0,0,0.05)]" style={{ width: "76%" }} />
                <div className="h-3" />
                <div
                  className="h-2 rounded-full"
                  style={{ width: "44%", backgroundColor: "rgba(255,180,63,0.20)" }}
                />
                <div
                  className="h-2 rounded-full"
                  style={{ width: "60%", backgroundColor: "rgba(255,180,63,0.14)" }}
                />
              </div>
            </div>

            {/* Chat */}
            <div className="col-span-3 p-3 bg-[#fafafa]">
              <div className="text-[9px] uppercase tracking-wider text-[#a3a3a3] font-medium mb-2">
                Chat
              </div>
              <div className="space-y-2">
                <MockChatBubble role="user">
                  Make a brief from research.pdf
                </MockChatBubble>
                <MockChatBubble role="assistant">
                  Drafted in your Brand brief doc.
                </MockChatBubble>
              </div>
              <div className="mt-3 h-7 rounded-[6px] bg-white border border-[rgba(0,0,0,0.08)] flex items-center px-2 text-[10px] text-[#a3a3a3]">
                Ask anything…
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSidebarRow({
  color,
  label,
  active,
}: {
  color: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-1.5 py-1 rounded-[4px] ${
        active ? "bg-[rgba(0,0,0,0.04)]" : ""
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-[#171717] truncate">{label}</span>
    </div>
  );
}

function MockChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="text-[10px] leading-snug px-2 py-1.5 rounded-[6px] bg-white border border-[rgba(0,0,0,0.06)] text-[#525252]">
        {children}
      </div>
    );
  }
  return (
    <div
      className="text-[10px] leading-snug px-2 py-1.5 rounded-[6px] text-white"
      style={{ backgroundColor: "#1A1815" }}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Value props — three columns
   ────────────────────────────────────────────── */

function ValueProps() {
  const items = [
    {
      icon: Layers,
      title: "One workspace",
      body:
        'Docs, sheets, and decks live together. No more "where did I save that?" — every artifact lives inside the project that produced it.',
    },
    {
      icon: Brain,
      title: "Project memory",
      body:
        "AI remembers every file, doc, and conversation in your project. No more re-explaining context every time you open a new chat.",
    },
    {
      icon: Upload,
      title: "Drag in anything",
      body:
        "PDFs, spreadsheets, voice memos, screenshots. AI reads them all and builds with full context — never starting from a blank page.",
    },
  ];

  return (
    <section className="border-t border-[rgba(0,0,0,0.06)] bg-white">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-24 lg:py-28">
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-white p-6 hover:border-[rgba(0,0,0,0.12)] hover:-translate-y-[1px] transition-all duration-200 ease-out"
            >
              <div
                className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#fafafa] mb-5"
              >
                <item.icon
                  className="w-4 h-4 text-[#171717]"
                  strokeWidth={1.75}
                />
              </div>
              <h3
                className="text-[18px] tracking-[-0.01em] text-[#171717] mb-2"
                style={{ fontWeight: 500 }}
              >
                {item.title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-[#525252]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Killer demo — Without Drafta vs With Drafta
   ────────────────────────────────────────────── */

function KillerDemo() {
  return (
    <section className="bg-[#fafafa] border-y border-[rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-24 lg:py-28">
        <div className="text-center mb-14">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#737373] font-medium mb-3">
            Stop the loop
          </div>
          <h2
            className="text-[32px] sm:text-[40px] tracking-[-0.02em] text-[#171717]"
            style={{ fontWeight: 500 }}
          >
            Never copy-paste from ChatGPT again.
          </h2>
          <p className="mt-4 text-[15px] text-[#525252] max-w-[560px] mx-auto leading-relaxed">
            Most AI tools forget what you did yesterday. Drafta remembers
            every file and every artifact in the project — so the second
            ask is faster than the first.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Without Drafta */}
          <div className="rounded-[16px] border border-[rgba(0,0,0,0.06)] bg-white p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[11px] font-medium text-[#737373] uppercase tracking-[0.08em]">
                Without Drafta
              </span>
            </div>

            <div className="relative">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "ChatGPT", tone: "#a3a3a3" },
                  { label: "Docs", tone: "#a3a3a3" },
                  { label: "Sheets", tone: "#a3a3a3" },
                  { label: "Slides", tone: "#a3a3a3" },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-2.5 py-3 text-center"
                  >
                    <div className="text-[11px] font-medium text-[#525252]">
                      {t.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sketchy connectors */}
              <svg
                className="w-full h-10 mt-2"
                viewBox="0 0 400 40"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M 50 5 C 70 30, 130 30, 150 5"
                  fill="none"
                  stroke="rgba(0,0,0,0.16)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 150 35 C 170 10, 230 10, 250 35"
                  fill="none"
                  stroke="rgba(0,0,0,0.16)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 250 5 C 270 30, 330 30, 350 5"
                  fill="none"
                  stroke="rgba(0,0,0,0.16)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 350 35 C 250 -5, 100 -5, 50 35"
                  fill="none"
                  stroke="rgba(0,0,0,0.10)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
              </svg>

              <ul className="mt-4 space-y-2 text-[13px] text-[#525252]">
                <BadBullet>Re-explain the project to the AI every chat.</BadBullet>
                <BadBullet>Copy AI output → paste into Docs → reformat.</BadBullet>
                <BadBullet>Numbers in Sheets fall out of sync with the deck.</BadBullet>
                <BadBullet>By Friday, nobody knows which file is current.</BadBullet>
              </ul>
            </div>
          </div>

          {/* With Drafta */}
          <div
            className="rounded-[16px] border bg-white p-6 lg:p-8"
            style={{ borderColor: "rgba(255,180,63,0.20)" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#FFB43F" }} strokeWidth={2.25} />
              <span
                className="text-[11px] font-medium uppercase tracking-[0.08em]"
                style={{ color: "#B87426" }}
              >
                With Drafta
              </span>
            </div>

            <div className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#fafafa] p-3 mb-3">
              <div className="text-[10px] uppercase tracking-wider text-[#737373] font-medium mb-2">
                One project · One memory
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ArtifactPill icon={FileText} color="#2a6dfb" label="Doc" />
                <ArtifactPill icon={Sheet} color="#42c366" label="Sheet" />
                <ArtifactPill icon={Presentation} color="#FFAD45" label="Deck" />
              </div>
            </div>

            <ul className="space-y-2 text-[13px] text-[#525252]">
              <GoodBullet>Drag in any file. AI reads them all once.</GoodBullet>
              <GoodBullet>Ask once: "Draft a brief, build the metrics, make the deck."</GoodBullet>
              <GoodBullet>Cross-references stay in sync across artifacts.</GoodBullet>
              <GoodBullet>Tomorrow, the AI still remembers everything.</GoodBullet>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function BadBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-[7px] inline-block w-3 h-px"
        style={{ backgroundColor: "rgba(0,0,0,0.24)" }}
      />
      <span className="leading-[1.55]">{children}</span>
    </li>
  );
}

function GoodBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check
        className="mt-[3px] w-3.5 h-3.5 flex-shrink-0"
        strokeWidth={2.25}
        style={{ color: "#FFB43F" }}
      />
      <span className="leading-[1.55]">{children}</span>
    </li>
  );
}

function ArtifactPill({
  icon: Icon,
  color,
  label,
}: {
  icon: typeof FileText;
  color: string;
  label: string;
}) {
  return (
    <div
      className="rounded-[6px] bg-white border border-[rgba(0,0,0,0.06)] px-2 py-2 flex items-center gap-1.5"
    >
      <Icon className="w-3 h-3" style={{ color }} strokeWidth={2} />
      <span className="text-[11px] font-medium text-[#171717]">{label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Three artifact types — doc, sheet, deck
   ────────────────────────────────────────────── */

function Artifacts() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-24 lg:py-28">
        <div className="max-w-[640px] mb-14">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#737373] font-medium mb-3">
            Three formats, one chat
          </div>
          <h2
            className="text-[32px] sm:text-[40px] tracking-[-0.02em] text-[#171717]"
            style={{ fontWeight: 500 }}
          >
            Everything your project ships in.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          <ArtifactCard
            color="#2a6dfb"
            tint="rgba(42,109,251,0.06)"
            icon={FileText}
            type="Documents"
            pitch="Briefs, proposals, status updates — drafted with Plate-grade rich text."
            preview={<DocPreview />}
          />
          <ArtifactCard
            color="#42c366"
            tint="rgba(66,195,102,0.06)"
            icon={Sheet}
            type="Spreadsheets"
            pitch="Track metrics, build models, paste in CSVs. Univer powers it under the hood."
            preview={<SheetPreview />}
          />
          <ArtifactCard
            color="#FFAD45"
            tint="rgba(255,173,69,0.06)"
            icon={Presentation}
            type="Decks"
            pitch="Pitch decks and launch decks generated full-fidelity. Export to PDF or PPTX."
            preview={<DeckPreview />}
          />
        </div>
      </div>
    </section>
  );
}

function ArtifactCard({
  color,
  tint,
  icon: Icon,
  type,
  pitch,
  preview,
}: {
  color: string;
  tint: string;
  icon: typeof FileText;
  type: string;
  pitch: string;
  preview: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-[rgba(0,0,0,0.06)] bg-white overflow-hidden hover:border-[rgba(0,0,0,0.12)] hover:-translate-y-[1px] transition-all duration-200 ease-out">
      <div
        className="border-b border-[rgba(0,0,0,0.04)] p-5"
        style={{ background: tint }}
      >
        {preview}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2.25} />
          <span
            className="text-[11px] uppercase tracking-[0.08em] font-medium"
            style={{ color }}
          >
            {type}
          </span>
        </div>
        <p className="text-[14px] leading-[1.55] text-[#525252]">{pitch}</p>
      </div>
    </div>
  );
}

function DocPreview() {
  return (
    <div className="rounded-[8px] bg-white border border-[rgba(0,0,0,0.06)] p-4 space-y-2">
      <div className="h-2.5 rounded-full bg-[rgba(0,0,0,0.10)]" style={{ width: "55%" }} />
      <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "92%" }} />
      <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "84%" }} />
      <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "70%" }} />
      <div className="h-1" />
      <div className="h-2 rounded-full bg-[rgba(42,109,251,0.20)]" style={{ width: "44%" }} />
      <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "78%" }} />
    </div>
  );
}

function SheetPreview() {
  return (
    <div className="rounded-[8px] bg-white border border-[rgba(0,0,0,0.06)] overflow-hidden">
      <div className="grid grid-cols-4 border-b border-[rgba(0,0,0,0.06)]">
        {["", "Q1", "Q2", "Q3"].map((h, i) => (
          <div
            key={i}
            className="h-7 text-[10px] flex items-center justify-center text-[#737373] font-medium border-r last:border-r-0 border-[rgba(0,0,0,0.06)] tabular-nums bg-[#fafafa]"
          >
            {h}
          </div>
        ))}
      </div>
      {[
        ["MRR", "$2.4k", "$6.1k", "$12k"],
        ["Users", "120", "340", "812"],
        ["Churn", "4.2%", "3.1%", "2.7%"],
      ].map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 border-b last:border-b-0 border-[rgba(0,0,0,0.04)]">
          {row.map((c, ci) => (
            <div
              key={ci}
              className={`h-7 text-[10px] flex items-center justify-center border-r last:border-r-0 border-[rgba(0,0,0,0.04)] tabular-nums ${
                ci === 0 ? "text-[#525252] font-medium" : "text-[#171717]"
              }`}
            >
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DeckPreview() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="aspect-[4/3] rounded-[6px] bg-white border border-[rgba(0,0,0,0.06)] p-2 flex flex-col justify-between"
        >
          <div className="space-y-1">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: i === 0 ? "70%" : "55%",
                backgroundColor:
                  i === 0 ? "rgba(255,173,69,0.50)" : "rgba(0,0,0,0.10)",
              }}
            />
            <div className="h-1 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "85%" }} />
          </div>
          <div className="h-1 rounded-full bg-[rgba(0,0,0,0.06)]" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Pricing teaser — Free vs Pro
   ────────────────────────────────────────────── */

function PricingTeaser() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;

  return (
    <section className="bg-[#fafafa] border-y border-[rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-24 lg:py-28">
        <div className="text-center mb-12">
          <h2
            className="text-[32px] sm:text-[40px] tracking-[-0.02em] text-[#171717]"
            style={{ fontWeight: 500 }}
          >
            Free forever. Upgrade when you grow.
          </h2>
          <p className="mt-4 text-[15px] text-[#525252] max-w-[520px] mx-auto leading-relaxed">
            Start with one project, then unlock unlimited workspaces and
            everything else when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-[860px] mx-auto">
          {/* Free */}
          <div className="rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-white p-7">
            <div className="flex items-baseline justify-between mb-1">
              <h3
                className="text-[18px] tracking-[-0.01em]"
                style={{ fontWeight: 500 }}
              >
                Free
              </h3>
              <div className="text-[24px] tabular-nums" style={{ fontWeight: 500 }}>
                $0<span className="text-[13px] text-[#a3a3a3] ml-0.5">/mo</span>
              </div>
            </div>
            <p className="text-[13px] text-[#737373] mb-5">
              For trying out the workspace.
            </p>
            <ul className="space-y-2.5 text-[13px] text-[#525252]">
              <PricingRow>{free.workspaces} workspace</PricingRow>
              <PricingRow>{free.aiMessagesPerMonth} AI messages / mo</PricingRow>
              <PricingRow>{free.fileUploadsPerMonth} file uploads / mo</PricingRow>
              <PricingRow>{Math.round(free.storageBytes / (1024 * 1024))} MB storage</PricingRow>
            </ul>
            <div className="mt-6">
              <CTAButton href="/login?mode=signup" variant="secondary" className="w-full">
                Get started
              </CTAButton>
            </div>
          </div>

          {/* Pro */}
          <div
            className="rounded-[12px] border bg-white p-7 relative"
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
            <div className="flex items-baseline justify-between mb-1">
              <h3
                className="text-[18px] tracking-[-0.01em]"
                style={{ fontWeight: 500 }}
              >
                Pro
              </h3>
              <div className="text-[24px] tabular-nums" style={{ fontWeight: 500 }}>
                ${PRO_PRICE_USD}
                <span className="text-[13px] text-[#a3a3a3] ml-0.5">/mo</span>
              </div>
            </div>
            <p className="text-[13px] text-[#737373] mb-5">
              For getting real work shipped.
            </p>
            <ul className="space-y-2.5 text-[13px] text-[#525252]">
              <PricingRow>Unlimited workspaces</PricingRow>
              <PricingRow>{pro.aiMessagesPerMonth.toLocaleString()} AI messages / mo</PricingRow>
              <PricingRow>Unlimited file uploads</PricingRow>
              <PricingRow>{Math.round(pro.storageBytes / (1024 * 1024 * 1024))} GB storage</PricingRow>
              <PricingRow>Brand voice + visual profiles</PricingRow>
              <PricingRow>No "Built with Drafta" watermark</PricingRow>
            </ul>
            <div className="mt-6">
              <CTAButton href="/login?mode=signup" variant="primary" className="w-full">
                Get started
              </CTAButton>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#525252] hover:text-[#171717] transition-colors duration-150"
          >
            See full pricing
            <ArrowRight className="w-3 h-3" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PricingRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check
        className="mt-[3px] w-3.5 h-3.5 flex-shrink-0"
        strokeWidth={2.25}
        style={{ color: "#171717" }}
      />
      <span>{children}</span>
    </li>
  );
}

/* ──────────────────────────────────────────────
   Final CTA band
   ────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: "#1A1815" }}>
      {/* Subtle decorative lines */}
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

      <div className="relative mx-auto max-w-[1200px] px-6 lg:px-8 py-24 lg:py-28 text-center">
        <h2
          className="text-[32px] sm:text-[44px] tracking-[-0.02em] text-white"
          style={{ fontWeight: 500 }}
        >
          Start with one project.
          <br />
          Free forever.
        </h2>
        <p className="mt-5 text-[15px] text-white/85 max-w-[480px] mx-auto leading-relaxed">
          Sign up in 30 seconds. Drag in your first file. Watch the
          AI build your next doc, sheet, or deck.
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
