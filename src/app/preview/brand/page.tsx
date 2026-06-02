/**
 * /preview/brand — standalone palette preview (Pragcel-inspired).
 * Self-contained: all colors hardcoded here, no live tokens touched.
 */

const C = {
  primary: "#111111",
  secondary: "#FCFBF8",
  surface: "#F7F5EF",
  border: "#E8E6E1",
  muted: "#6E6E73",
  blue: "#1D63D4",
  violet: "#9B78D8",
  orange: "#FF7A2F",
  yellow: "#FFD22A",
  green: "#48D49B",
};

const RAINBOW = `linear-gradient(105deg, ${C.blue} 0%, ${C.violet} 26%, #F46B8E 44%, ${C.orange} 62%, ${C.yellow} 80%, ${C.green} 100%)`;
const FONT = "Inter, system-ui, -apple-system, sans-serif";

function Swatch({ name, hex, dark, big }: { name: string; hex: string; dark?: boolean; big?: boolean }) {
  return (
    <div className="rounded-[14px] overflow-hidden flex flex-col" style={{ border: `1px solid ${C.border}`, background: C.secondary }}>
      <div style={{ background: hex, height: big ? 104 : 76 }} />
      <div className="px-3.5 py-3">
        <div className="text-[13px] font-semibold" style={{ color: C.primary }}>{name}</div>
        <div className="text-[12px] font-mono mt-0.5" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{hex}</div>
      </div>
    </div>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center h-[30px] px-3.5 rounded-full text-[13px] font-medium" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

const ENTITY = [
  { label: "Doc", color: C.blue, soft: "#E7EEFB" },
  { label: "Sheet", color: C.green, soft: "#E2F7EE" },
  { label: "Deck", color: C.orange, soft: "#FFEEE2" },
  { label: "Page", color: C.violet, soft: "#F0EAFA" },
];

function MiniCard({ title, kind, children }: { title: string; kind: typeof ENTITY[number]; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] p-4 flex flex-col" style={{ background: C.secondary, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(17,17,17,0.04), 0 10px 24px rgba(17,17,17,0.03)", minHeight: 168 }}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: C.primary }}>{title}</div>
        <span style={{ color: C.muted }}>···</span>
      </div>
      <div className="flex-1">{children}</div>
      <div className="flex items-center justify-between mt-4">
        <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11px] font-medium" style={{ background: kind.soft, color: kind.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: kind.color }} /> {kind.label}
        </span>
        <span className="text-[11px]" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>2h ago</span>
      </div>
    </div>
  );
}

export default function BrandPreview() {
  return (
    <div style={{ background: C.secondary, color: C.primary, fontFamily: FONT, minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <div className="max-w-[1080px] mx-auto px-8 py-14">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-[10px]" style={{ background: C.primary }}>
            <span className="text-[18px] font-bold" style={{ color: C.secondary }}>D</span>
          </div>
          <span className="text-[22px] font-semibold tracking-[-0.03em]">Primy</span>
          <span className="ml-2 text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}>Brand preview</span>
        </div>
        <p className="text-[15px] mb-8" style={{ color: C.muted }}>Clean product palette: black wordmark, warm off-white surfaces, candy accents at 10%.</p>

        {/* Rainbow hero */}
        <div className="rounded-[20px] overflow-hidden mb-14 relative" style={{ border: `1px solid ${C.border}`, height: 220 }}>
          <div style={{ position: "absolute", inset: 0, background: RAINBOW }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 120%, rgba(252,251,248,0.92) 0%, rgba(252,251,248,0) 55%)" }} />
          <div className="absolute left-7 bottom-6 flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-[9px]" style={{ background: C.primary }}>
              <span className="text-[15px] font-bold" style={{ color: C.secondary }}>D</span>
            </div>
            <span className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: C.primary }}>Primy</span>
          </div>
        </div>

        {/* Palette */}
        <SectionLabel>Core</SectionLabel>
        <div className="grid grid-cols-2 gap-4 mb-10">
          <Swatch name="Primary" hex={C.primary} big dark />
          <Swatch name="Secondary" hex={C.secondary} big />
        </div>

        <SectionLabel>Neutrals</SectionLabel>
        <div className="grid grid-cols-3 gap-4 mb-10">
          <Swatch name="Surface" hex={C.surface} />
          <Swatch name="Border" hex={C.border} />
          <Swatch name="Muted Text" hex={C.muted} />
        </div>

        <SectionLabel>Accents <span style={{ color: C.muted, fontWeight: 400 }}>· used sparingly (~10%)</span></SectionLabel>
        <div className="grid grid-cols-5 gap-4 mb-10">
          <Swatch name="Blue" hex={C.blue} />
          <Swatch name="Violet" hex={C.violet} />
          <Swatch name="Orange" hex={C.orange} />
          <Swatch name="Yellow" hex={C.yellow} />
          <Swatch name="Green" hex={C.green} />
        </div>

        {/* Ratio bar */}
        <SectionLabel>Usage ratio</SectionLabel>
        <div className="rounded-full overflow-hidden flex h-12 mb-2" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-center text-[12px] font-medium" style={{ width: "70%", background: C.surface, color: C.muted }}>70% · Off-white + Surface</div>
          <div className="flex items-center justify-center text-[12px] font-medium" style={{ width: "20%", background: C.primary, color: C.secondary }}>20% · Ink</div>
          <div className="flex items-center justify-center text-[12px] font-medium" style={{ width: "10%", background: RAINBOW, color: "#fff" }}>10%</div>
        </div>
        <p className="text-[12.5px] mb-14" style={{ color: C.muted }}>Surfaces and text carry the UI; accents punctuate: entity dots, AI signal, highlights.</p>

        {/* Accent pills (Pragcel-style) */}
        <SectionLabel>Accent pills</SectionLabel>
        <div className="flex flex-wrap gap-2.5 mb-14">
          <Pill label="Document" bg={C.blue} fg="#fff" />
          <Pill label="Spreadsheet" bg={C.green} fg="#08231a" />
          <Pill label="Deck" bg={C.orange} fg="#fff" />
          <Pill label="Page" bg={C.violet} fg="#fff" />
          <Pill label="AI" bg={C.yellow} fg="#3a2e00" />
          <Pill label="Primary action" bg={C.primary} fg={C.secondary} />
          <Pill label="Soft" bg={C.surface} fg={C.muted} />
        </div>

        {/* Applied shell mock */}
        <SectionLabel>Applied: workspace</SectionLabel>
        <div className="rounded-[18px] overflow-hidden flex" style={{ border: `1px solid ${C.border}`, height: 460, background: C.surface }}>
          {/* sidebar */}
          <div className="flex flex-col flex-shrink-0 px-3 py-4" style={{ width: 196, background: C.secondary, borderRight: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 px-2 mb-5">
              <div className="flex items-center justify-center w-6 h-6 rounded-[7px]" style={{ background: C.primary }}><span className="text-[12px] font-bold" style={{ color: C.secondary }}>D</span></div>
              <span className="text-[15px] font-semibold tracking-[-0.02em]">Primy</span>
            </div>
            {["Inbox", "Quick Note", "Search"].map((n) => (
              <div key={n} className="flex items-center gap-2.5 h-[32px] px-2 rounded-[8px] text-[13px]" style={{ color: C.muted }}>
                <span className="w-3.5 h-3.5 rounded-[4px]" style={{ border: `1.5px solid ${C.muted}` }} />{n}
              </div>
            ))}
            <div className="text-[12px] font-medium px-2 mt-4 mb-2" style={{ color: C.muted }}>Workspaces</div>
            {[["Acme Rebrand", C.orange], ["Content Engine", C.green], ["Product 2026", C.blue]].map(([n, c]) => (
              <div key={n} className="flex items-center gap-2.5 h-[32px] px-2 rounded-[8px] text-[13px]" style={{ color: C.primary, background: n === "Acme Rebrand" ? C.surface : "transparent", fontWeight: n === "Acme Rebrand" ? 500 : 400 }}>
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] text-[10px] font-semibold" style={{ background: c as string, color: "#fff" }}>{(n as string)[0]}</span>
                <span className="truncate">{n}</span>
              </div>
            ))}
          </div>
          {/* board */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 h-[52px] px-6 flex-shrink-0">
              <span className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ border: `1.5px solid ${C.muted}` }} />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">Acme Rebrand: Q3 Launch</span>
              <div className="flex-1" />
              <span className="inline-flex items-center px-2.5 h-7 rounded-[8px] text-[12px] font-medium" style={{ background: C.primary, color: C.secondary }}>Share</span>
            </div>
            <div className="flex-1 overflow-hidden px-6 pb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: C.blue }} />
                <span className="text-[14px] font-semibold">Docs</span>
                <span className="text-[12px]" style={{ color: C.muted }}>2</span>
              </div>
              <div className="grid grid-cols-3 gap-3.5">
                <MiniCard title="Creative Brief" kind={ENTITY[0]}>
                  <p className="text-[11.5px] leading-[1.5] line-clamp-4" style={{ color: C.muted }}>Acme reads as dated and enterprise-heavy. Reposition as the approachable expert: sharp, warm, human.</p>
                </MiniCard>
                <MiniCard title="Launch Budget" kind={ENTITY[1]}>
                  <div className="rounded-[8px] overflow-hidden text-[10.5px]" style={{ border: `1px solid ${C.border}` }}>
                    <div className="grid grid-cols-3" style={{ background: ENTITY[1].soft, color: ENTITY[1].color, fontWeight: 600 }}>{["Item", "Owner", "Cost"].map((h) => <div key={h} className="px-2 py-1.5">{h}</div>)}</div>
                    {[["Brand", "Maya", "18k"], ["Launch", "Dev", "24k"]].map((r, i) => <div key={i} className="grid grid-cols-3" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>{r.map((c, j) => <div key={j} className="px-2 py-1.5">{c}</div>)}</div>)}
                  </div>
                </MiniCard>
                <MiniCard title="Kickoff Deck" kind={ENTITY[2]}>
                  <div className="rounded-[10px] h-full flex items-end p-2" style={{ background: RAINBOW, minHeight: 64 }}>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(252,251,248,0.85)", color: C.primary }}>8 slides</span>
                  </div>
                </MiniCard>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[12.5px] mt-6" style={{ color: C.muted }}>
          Route: <span className="font-mono" style={{ color: C.primary }}>/preview/brand</span>. Nothing in the live app changed. Say the word and I’ll wire this palette into the real tokens.
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3.5" style={{ color: C.muted }}>{children}</div>;
}
