"use client";

/* ──────────────────────────────────────────────────────────────
   /preview/landing2 — a close clone of dub.co's structure & visuals,
   themed to Primy. A separate experiment; does NOT touch
   /preview/landing or "/".

   dub signatures replicated:
   - centered hero: two-part pill, bold headline, two buttons, faint grid
   - tabs above a big framed product stage on a soft panel
   - grayscale logo cloud
   - outcome statement with inline colored icon badges + dot-matrix +
     floating UI fragments
   - feature sections: colored app-icon eyebrow, bold headline, ghost
     "Explore" button, and a FOCUSED code-built UI fragment (cascading
     cards / mini deck / mini board) — never a full app screenshot
   - 3-up sub-feature row with "Learn more →"
   - testimonial band on dot-matrix
   - vertical framing lines + horizontal section dividers throughout
   No gradients. No italics. Light surfaces. Our copy + brand.
   ────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Inter_Tight } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Presentation,
  LayoutTemplate,
  Globe,
  MessageSquare,
  Paperclip,
  ChevronDown,
} from "lucide-react";

const display = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const DISP = display.style.fontFamily;

const C = {
  page: "#FFFFFF",
  canvas: "#FAFAF8",
  surface: "#FFFFFF",
  sunken: "#F6F5F1",
  cream: "#FAF6EE",
  ink: "#1A1815",
  ink2: "#3B3A37",
  ink3: "#6F6D67",
  inkMuted: "#A8A59D",
  amber: "#FFB43F",
  amberText: "#B87426",
  blue: "#4285F4",
  green: "#42C366",
  deck: "#F0922E",
  purple: "#8757D7",
  teal: "#3FB3AC",
  border: "rgba(24,24,22,0.09)",
  borderStrong: "rgba(24,24,22,0.13)",
  borderFaint: "rgba(24,24,22,0.055)",
};
const EASE = "cubic-bezier(0.32,0.72,0,1)";
const TINT: Record<string, string> = {
  [C.blue]: "#EAF1FE",
  [C.green]: "#E7F7EC",
  [C.deck]: "#FDEBD8",
  [C.purple]: "#F1EAFB",
  [C.amber]: "#FFF3E0",
};
const tint = (c: string) => TINT[c] ?? C.sunken;

const head = (size: string, lh = 1.05, w = 600) =>
  ({ fontFamily: DISP, fontWeight: w, fontSize: size, lineHeight: lh, letterSpacing: "-0.025em" }) as React.CSSProperties;

// dub's dot-matrix backdrop (a dot pattern, not a color gradient)
const DOTS = (color = "rgba(24,24,22,0.13)", size = 16) =>
  ({
    backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
  }) as React.CSSProperties;

export default function Landing2() {
  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: C.page, color: C.ink, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <Nav />
      {/* dub's signature: one centered column framed by vertical lines */}
      <div
        className="mx-auto max-w-[1180px]"
        style={{ borderLeft: `1px solid ${C.borderFaint}`, borderRight: `1px solid ${C.borderFaint}` }}
      >
        <Hero />
        <LogoCloud />
        <OutcomeStatement />
        <FeatureChat />
        <SubFeatureTrio />
        <FeatureDecks />
        <Testimonial />
        <FeatureConnected />
        <Formats />
        <FinalCTA />
      </div>
      <Footer />
      <MotionCSS />
    </div>
  );
}

/* ── reveal + motion ── */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`l2-reveal${seen ? " in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
function MotionCSS() {
  return (
    <style>{`
      .l2-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s cubic-bezier(.32,.72,0,1),transform .6s cubic-bezier(.32,.72,0,1)}
      .l2-reveal.in{opacity:1;transform:none}
      .l2-fade{animation:l2Fade .45s cubic-bezier(.32,.72,0,1) both}
      @keyframes l2Fade{from{opacity:0;transform:scale(1.012)}to{opacity:1;transform:none}}
      /* card hover lift */
      .l2-lift{transition:transform .3s cubic-bezier(.32,.72,0,1),box-shadow .3s cubic-bezier(.32,.72,0,1)}
      @media (hover:hover){.l2-lift:hover{transform:translateY(-4px)}}
      /* scene life — gentle, slow, looping */
      .scn-pulse{transform-box:fill-box;transform-origin:center;animation:scnPulse 7s ease-in-out infinite}
      @keyframes scnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
      .scn-slow{animation:scnDrift 14s ease-in-out infinite}
      @keyframes scnDrift{0%,100%{transform:translateX(0)}50%{transform:translateX(-14px)}}
      .scn-bob{animation:scnBob 6s ease-in-out infinite}
      @keyframes scnBob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(-2deg)}}
      .scn-twinkle{animation:scnTwinkle 4.5s ease-in-out infinite}
      @keyframes scnTwinkle{0%,100%{opacity:.9}50%{opacity:.45}}
      /* floating chips drift */
      .l2-float{animation:l2Float 7s ease-in-out infinite}
      .l2-float-2{animation:l2Float 8.5s ease-in-out infinite .6s}
      @keyframes l2Float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
      @media (prefers-reduced-motion: reduce){
        .l2-reveal{opacity:1!important;transform:none!important;transition:none!important}
        .l2-fade,.scn-pulse,.scn-slow,.scn-bob,.scn-twinkle,.l2-float,.l2-float-2{animation:none!important}
      }
    `}</style>
  );
}

function Mark({ color = "#fff", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill={color} aria-hidden>
      <rect x="0" y="5" width="6" height="12" rx="3" />
      <rect x="7" y="2" width="5" height="18" rx="2.5" transform="rotate(-28 9.5 11)" />
      <rect x="12" y="3" width="5" height="16" rx="2.5" transform="rotate(28 14.5 11)" />
      <rect x="18" y="6" width="4" height="10" rx="2" />
    </svg>
  );
}

// bare colored glyph (no box) — entity color carries the meaning
function AppIcon({ color, icon: I, size = 20 }: { color: string; icon: typeof FileText; size?: number; r?: number }) {
  return <I style={{ width: size * 0.82, height: size * 0.82, color }} strokeWidth={2} />;
}

/* ── scenic illustration SYSTEM ──
   Variations on the brand's visual language (sun/dome, layered ridges, lake,
   orbit balloon, dots) — recomposed per surface so no two read the same and
   none is a 1:1 copy of the in-app HeroIllustration. Gentle drift keeps them
   alive. Palette: blue dome, amber/coral ridge, teal + cream lake. */
type SceneVariant = "ridge" | "dusk" | "peaks";
function SceneDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-dome`} x1="0.15" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#3C6CE0" />
        <stop offset="58%" stopColor="#5C8CEF" />
        <stop offset="100%" stopColor="#EBF1FD" />
      </linearGradient>
      <linearGradient id={`${uid}-ridge`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#F0896A" />
        <stop offset="52%" stopColor="#F4A24C" />
        <stop offset="100%" stopColor="#F8BE45" />
      </linearGradient>
      <linearGradient id={`${uid}-coral`} x1="0" y1="1" x2="1" y2="0.2">
        <stop offset="0%" stopColor="#EE7E73" />
        <stop offset="100%" stopColor="#F4A45A" />
      </linearGradient>
      <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0.1" y2="1">
        <stop offset="0%" stopColor="#4E92DB" />
        <stop offset="100%" stopColor="#DEEAF8" />
      </linearGradient>
      <linearGradient id={`${uid}-teal`} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#67CEC8" />
        <stop offset="100%" stopColor="#BFEDE9" />
      </linearGradient>
      <linearGradient id={`${uid}-lake`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#FCF6E0" />
        <stop offset="100%" stopColor="#F6E9C2" />
      </linearGradient>
      <radialGradient id={`${uid}-sun`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#FFD27A" />
        <stop offset="60%" stopColor="#F8BE45" />
        <stop offset="100%" stopColor="#F4A24C" />
      </radialGradient>
    </defs>
  );
}
// the orbit balloon motif (line + two circles), reused at different scales
function Orbit({ x, y, s = 1, w = 2 }: { x: number; y: number; s?: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="scn-bob" fill="none" stroke="#1A1815" strokeWidth={w} strokeLinecap="round">
        <path d="M0 96 L0 14" />
        <circle cx="-14" cy="-6" r="32" strokeOpacity="0.92" />
        <circle cx="22" cy="18" r="22" strokeOpacity="0.92" />
      </g>
    </g>
  );
}
function Dots({ pts }: { pts: [number, number, number][] }) {
  return (
    <g fill="#1A1815" className="scn-twinkle">
      {pts.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  );
}
function Scene({ variant, className, style }: { variant: SceneVariant; className?: string; style?: React.CSSProperties }) {
  const uid = `scn-${variant}`;
  return (
    <svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden role="img">
      <SceneDefs uid={uid} />

      {variant === "ridge" && (
        <>
          {/* sun rising on the right + layered warm ridges sweeping from left */}
          <circle className="scn-pulse" cx="1010" cy="252" r="226" fill={`url(#${uid}-sun)`} />
          <path d="M0 240 C 260 150 470 176 760 240 Z" fill={`url(#${uid}-coral)`} />
          <path className="scn-slow" d="M120 240 C 420 168 690 188 1040 116 L1200 240 Z" fill={`url(#${uid}-ridge)`} />
          <circle cx="196" cy="356" r="196" fill={`url(#${uid}-dome)`} />
          <ellipse cx="470" cy="206" rx="96" ry="18" fill={`url(#${uid}-teal)`} opacity="0.9" />
          <ellipse cx="560" cy="190" rx="170" ry="30" fill={`url(#${uid}-lake)`} transform="rotate(-7 560 190)" />
          <Dots pts={[[860, 120, 4], [904, 110, 4], [948, 98, 4], [992, 84, 3.4]]} />
          <Orbit x={236} y={92} s={1} />
        </>
      )}

      {variant === "dusk" && (
        <>
          {/* cool: a wide blue dome settling, teal+blue water, amber sliver left */}
          <path d="M0 240 C 120 196 230 200 360 240 Z" fill={`url(#${uid}-ridge)`} opacity="0.95" />
          <circle cx="640" cy="372" r="306" fill={`url(#${uid}-dome)`} />
          <path d="M300 240 C 560 198 820 206 1200 168 L1200 240 Z" fill={`url(#${uid}-water)`} />
          <ellipse cx="900" cy="214" rx="150" ry="22" fill={`url(#${uid}-teal)`} opacity="0.85" />
          <ellipse cx="980" cy="198" rx="180" ry="30" fill={`url(#${uid}-lake)`} transform="rotate(6 980 198)" />
          <Dots pts={[[210, 118, 4], [256, 110, 4], [302, 104, 3.6]]} />
          <Orbit x={1024} y={96} s={0.92} />
        </>
      )}

      {variant === "peaks" && (
        <>
          {/* energetic: overlapping ridges like a range, small sun behind */}
          <circle className="scn-pulse" cx="600" cy="150" r="86" fill={`url(#${uid}-sun)`} />
          <path d="M-20 240 C 200 120 320 132 520 240 Z" fill={`url(#${uid}-dome)`} />
          <path d="M360 240 C 560 110 700 128 900 240 Z" fill={`url(#${uid}-teal)`} opacity="0.95" />
          <path d="M720 240 C 920 124 1060 140 1240 240 Z" fill={`url(#${uid}-coral)`} />
          <Dots pts={[[150, 150, 4], [1050, 150, 4], [600, 50, 3.6]]} />
        </>
      )}
    </svg>
  );
}
// compact orbit-only accent for small corners
function OrbitAccent({ className, color = "#1A1815" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <g className="scn-bob" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
        <path d="M48 104 L48 36" />
        <circle cx="40" cy="30" r="26" strokeOpacity="0.9" />
        <circle cx="74" cy="50" r="17" strokeOpacity="0.9" />
      </g>
      <g fill={color} className="scn-twinkle">
        <circle cx="96" cy="92" r="4" />
        <circle cx="108" cy="84" r="3.4" />
      </g>
    </svg>
  );
}

/* ── nav ── */
function Nav() {
  return (
    <header
      className="sticky top-0 z-40"
      style={{ backgroundColor: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.borderFaint}` }}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: C.ink }}>
            <Mark size={14} />
          </span>
          <span className="text-[16px] font-medium tracking-[-0.02em]" style={{ fontFamily: DISP }}>
            Primy
          </span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {["Product", "Solutions", "Resources", "Customers", "Pricing"].map((l) => (
            <span
              key={l}
              className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] px-3 py-2 text-[13.5px] font-medium transition-colors hover:bg-[rgba(24,24,22,0.04)]"
              style={{ color: C.ink2 }}
            >
              {l}
              {(l === "Product" || l === "Solutions" || l === "Resources") && (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} style={{ color: C.inkMuted }} />
              )}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span
            className="hidden cursor-pointer items-center rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium transition-colors hover:bg-[rgba(24,24,22,0.04)] sm:inline-flex"
            style={{ color: C.ink2 }}
          >
            Log in
          </span>
          <span
            className="inline-flex cursor-pointer items-center rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: C.ink }}
          >
            Sign up
          </span>
        </div>
      </div>
    </header>
  );
}

/* ── hero ── */
const TABS = [
  { label: "Chat", color: C.amber, icon: MessageSquare, img: "/landing/app/chat.webp" },
  { label: "Documents", color: C.blue, icon: FileText, img: "/landing/app/doc.webp" },
  { label: "Decks", color: C.deck, icon: Presentation, img: "/landing/app/deck.webp" },
  { label: "Workspace", color: C.purple, icon: LayoutTemplate, img: "/landing/app/board.webp" },
];
function Hero() {
  const [tab, setTab] = useState(0);
  return (
    <section className="relative overflow-hidden">
      {/* faint grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${C.borderFaint} 1px, transparent 1px), linear-gradient(90deg, ${C.borderFaint} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          WebkitMaskImage: "radial-gradient(120% 65% at 50% 0%, #000 25%, transparent 72%)",
          maskImage: "radial-gradient(120% 65% at 50% 0%, #000 25%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto max-w-[840px] px-6 pt-16 text-center lg:pt-24">
        {/* two-part pill */}
        <div className="mb-7 flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full p-1 text-[13px]"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(24,24,22,0.05)" }}
          >
            <span className="rounded-full px-2.5 py-0.5 font-medium" style={{ color: C.ink2 }}>
              Introducing AI deck generation
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
              style={{ backgroundColor: C.sunken, color: C.ink2 }}
            >
              Read more <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>
        </div>
        <h1 style={head("clamp(40px,6vw,68px)", 1.02, 600)}>Turn a prompt into a deliverable.</h1>
        <p className="mx-auto mt-6 max-w-[540px] text-[17px] leading-[1.55]" style={{ color: C.ink3 }}>
          Primy is the AI workspace for documents, decks, and pages. Chat, and the work builds itself.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            className="inline-flex items-center rounded-[10px] px-5 font-medium text-white transition-transform active:scale-[0.98]"
            style={{ transitionTimingFunction: EASE, height: 46, fontSize: 14.5, backgroundColor: C.ink }}
          >
            Start for free
          </button>
          <button
            className="inline-flex items-center rounded-[10px] px-5 text-[14.5px] font-medium transition-transform active:scale-[0.98]"
            style={{ height: 46, backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }}
          >
            Get a demo
          </button>
        </div>
      </div>

      {/* tabs above the product stage */}
      <div className="relative mx-auto mt-16 flex max-w-[1120px] flex-wrap justify-center gap-2 px-6">
        {TABS.map((t, i) => {
          const active = i === tab;
          return (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor: active ? C.surface : "transparent",
                border: `1px solid ${active ? C.border : "transparent"}`,
                color: active ? C.ink : C.ink3,
                boxShadow: active ? "0 1px 2px rgba(24,24,22,0.05)" : "none",
              }}
            >
              <AppIcon color={t.color} icon={t.icon} size={18} r={5} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* product stage: warm scenic band (brand hero illustration) → product */}
      <div className="relative mt-9">
        <div
          className="absolute inset-x-0 bottom-0 top-24"
          style={{ backgroundColor: C.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, ...DOTS("rgba(24,24,22,0.05)", 18) }}
        />
        {/* scenic banner */}
        <div className="relative mx-auto max-w-[1120px] px-6">
          <div className="relative h-[200px] overflow-hidden rounded-[20px] sm:h-[240px]" style={{ boxShadow: "0 30px 60px -40px rgba(24,24,22,0.3)" }}>
            <Scene variant="ridge" className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: `linear-gradient(to bottom, transparent, ${C.canvas})` }} />
          </div>
        </div>
        {/* product, lifted to overlap the scene */}
        <div className="relative mx-auto -mt-16 max-w-[1000px] px-6 pb-0">
          <div
            className="overflow-hidden rounded-[14px] rounded-b-none p-1.5"
            style={{
              backgroundColor: "rgba(255,255,255,0.75)",
              border: `1px solid ${C.border}`,
              borderBottom: "none",
              boxShadow: "0 50px 90px -42px rgba(24,24,22,0.36), 0 2px 8px rgba(24,24,22,0.05)",
            }}
          >
            <div
              className="relative overflow-hidden rounded-[9px] rounded-b-none"
              style={{ aspectRatio: "1600 / 760", border: `1px solid ${C.borderFaint}`, borderBottom: "none" }}
            >
              <img
                key={tab}
                src={TABS[tab].img}
                alt={`Primy ${TABS[tab].label.toLowerCase()}`}
                className="l2-fade absolute inset-0 block h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── logo cloud ── */
const LOGOS: { name: string; mark: "ring" | "wedge" | "bars" | "dot" | "diamond" }[] = [
  { name: "Northwind", mark: "ring" },
  { name: "Lumen", mark: "dot" },
  { name: "Vertex", mark: "wedge" },
  { name: "Foundry", mark: "bars" },
  { name: "Polaris", mark: "diamond" },
  { name: "Kepler", mark: "ring" },
  { name: "Outset", mark: "wedge" },
];
function LogoGlyph({ mark }: { mark: string }) {
  const c = "#9B988F";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      {mark === "ring" && <circle cx="9" cy="9" r="6.2" stroke={c} strokeWidth="2.2" />}
      {mark === "dot" && <circle cx="9" cy="9" r="6" fill={c} />}
      {mark === "wedge" && <path d="M9 2 L16 15 H2 Z" fill={c} />}
      {mark === "bars" && (
        <g fill={c}>
          <rect x="2" y="4" width="3.4" height="10" rx="1.2" />
          <rect x="7.3" y="2" width="3.4" height="14" rx="1.2" />
          <rect x="12.6" y="6" width="3.4" height="8" rx="1.2" />
        </g>
      )}
      {mark === "diamond" && <path d="M9 2 L16 9 L9 16 L2 9 Z" fill={c} />}
    </svg>
  );
}
function LogoCloud() {
  return (
    <section style={{ backgroundColor: C.surface, borderTop: `1px solid ${C.borderFaint}` }}>
      <div className="mx-auto max-w-[1180px] px-6 py-14 lg:px-8">
        <p className="text-center text-[12.5px] font-medium tracking-[0.02em]" style={{ color: C.ink3 }}>
          The studio behind on-brand work at fast-moving teams
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {LOGOS.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-2 opacity-80">
              <LogoGlyph mark={l.mark} />
              <span className="text-[17px] font-semibold tracking-[-0.01em]" style={{ fontFamily: DISP, color: "#9B988F" }}>
                {l.name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── outcome statement (dub's flowing paragraph with inline icon badges) ── */
function OutcomeStatement() {
  return (
    <section className="relative overflow-hidden" style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.surface }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ ...DOTS("rgba(24,24,22,0.10)", 16), opacity: 0.6 }} />
      {/* floating fragments */}
      <FloatChip className="left-[5%] top-[26%] hidden l2-float lg:flex" icon={FileText} color={C.blue} title="Proposal.doc" sub="Drafting" />
      <FloatChip className="left-[8%] bottom-[16%] hidden l2-float-2 lg:flex" icon={MessageSquare} color={C.amber} title="Ask Primy" sub="Build a deck" />
      <FloatChip className="right-[5%] top-[20%] hidden l2-float-2 lg:flex" icon={Presentation} color={C.deck} title="Q3 Deck" sub="12 slides" />
      <FloatChip className="right-[8%] bottom-[20%] hidden l2-float lg:flex" icon={Globe} color={C.purple} title="Landing.page" sub="Live" />

      <div className="relative mx-auto max-w-[760px] px-6 py-28 text-center lg:py-36">
        <Reveal>
          <p style={head("clamp(26px,3.6vw,40px)", 1.32, 500)}>
            <span style={{ color: C.ink }}>Work isn&rsquo;t just about typing.</span>{" "}
            <span style={{ color: C.ink3 }}>
              Primy turns a chat into{" "}
              <InlineToken color={C.blue} icon={FileText} label="documents" />,{" "}
              <InlineToken color={C.deck} icon={Presentation} label="decks" />, and{" "}
              <InlineToken color={C.purple} icon={Globe} label="pages" />. On brand, in one place, in seconds.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
function InlineToken({ color, icon, label }: { color: string; icon: typeof FileText; label: string }) {
  return (
    <span className="inline-flex translate-y-[3px] items-center gap-1.5 whitespace-nowrap" style={{ color: C.ink }}>
      <AppIcon color={color} icon={icon} size={26} r={7} />
      {label}
    </span>
  );
}
function FloatChip({
  className = "",
  icon: I,
  color,
  title,
  sub,
}: {
  className?: string;
  icon: typeof FileText;
  color: string;
  title: string;
  sub: string;
}) {
  return (
    <div
      className={`absolute z-10 items-center gap-2.5 rounded-[12px] px-3 py-2.5 ${className}`}
      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 16px 30px -18px rgba(24,24,22,0.28)" }}
    >
      <AppIcon color={color} icon={I} size={26} r={7} />
      <span className="text-left leading-tight">
        <span className="block text-[12.5px] font-medium" style={{ color: C.ink }}>
          {title}
        </span>
        <span className="block text-[11px]" style={{ color: C.ink3 }}>
          {sub}
        </span>
      </span>
    </div>
  );
}

/* ── zapier/conduit-style gradient card holding a real product screen ── */
function ProductCard({
  color,
  img,
  alt,
  url = "app.primy.com",
  pad = "p-6 sm:p-9",
}: {
  color: string;
  img: string;
  alt: string;
  url?: string;
  pad?: string;
}) {
  return (
    <div
      className={`l2-lift relative overflow-hidden rounded-[24px] ${pad}`}
      style={{
        background: `radial-gradient(130% 130% at 0% 0%, ${color}38, transparent 52%), linear-gradient(165deg, ${tint(color)}, ${C.surface})`,
        border: `1px solid ${color}26`,
      }}
    >
      {/* framed screenshot with light browser chrome */}
      <div
        className="relative overflow-hidden rounded-[13px]"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 34px 64px -32px rgba(24,24,22,0.4)" }}
      >
        <div className="flex items-center gap-1.5 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${C.borderFaint}` }}>
          {["#F5655B", "#F6BE50", "#62C554"].map((d) => (
            <span key={d} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d, opacity: 0.85 }} />
          ))}
          <span
            className="ml-2 hidden flex-1 truncate rounded-[6px] px-2.5 py-1 text-[11px] sm:block"
            style={{ backgroundColor: C.sunken, color: C.ink3, maxWidth: 240 }}
          >
            {url}
          </span>
        </div>
        <img src={img} alt={alt} className="block w-full" />
      </div>
    </div>
  );
}

/* ── section header used by feature sections ── */
function FeatureHeader({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: { label: string; color: string; icon: typeof FileText };
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Reveal>
      <div className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: C.ink }}>
        <AppIcon color={eyebrow.color} icon={eyebrow.icon} size={22} r={6} />
        {eyebrow.label}
      </div>
      <h2 style={head("clamp(30px,3.8vw,46px)", 1.05, 600)}>{title}</h2>
      <p className="mt-4 max-w-[460px] text-[16px] leading-[1.6]" style={{ color: C.ink3 }}>
        {body}
      </p>
      <button
        className="mt-7 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13.5px] font-medium transition-transform active:scale-[0.98]"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }}
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </Reveal>
  );
}

/* ── FEATURE: chat → wide real product card (centered) ── */
function FeatureChat() {
  return (
    <section style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.surface }}>
      <div className="mx-auto max-w-[1180px] px-6 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[640px] text-center">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: C.ink }}>
              <AppIcon color={C.amber} icon={MessageSquare} size={22} />
              Primy Chat
            </div>
            <h2 style={head("clamp(30px,3.8vw,46px)", 1.05, 600)}>It starts with a chat.</h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[16px] leading-[1.6]" style={{ color: C.ink3 }}>
              Ask in plain language. Primy creates the right artifact, fills it with your context, and keeps editing as you
              talk.
            </p>
          </Reveal>
        </div>
        <Reveal delay={80} className="mt-12">
          <ProductCard color={C.amber} img="/landing/feat/chat.webp" alt="Primy chat" pad="p-5 sm:p-10" />
        </Reveal>
      </div>
    </section>
  );
}

/* ── 3-up sub-feature row (dub's "Custom domains / Advanced / QR") ── */
const TRIO = [
  { icon: MessageSquare, color: C.amber, title: "Per-project memory", body: "Every file and decision stays in context, so the second ask is faster than the first.", active: true },
  { icon: Paperclip, color: C.blue, title: "Drag in anything", body: "Drop PDFs, sheets, and docs. Primy reads them and builds with full context." },
  { icon: ArrowUpRight, color: C.purple, title: "Export anywhere", body: "Ship to PDF, PPTX, or a live page. On brand, ready to send." },
];
function SubFeatureTrio() {
  return (
    <section style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.surface }}>
      <div className="mx-auto grid max-w-[1180px] gap-px px-6 py-16 sm:grid-cols-3 lg:px-8" style={{ rowGap: 0 }}>
        {TRIO.map((t, i) => (
          <Reveal key={t.title} delay={i * 60}>
            <div className="px-2 sm:px-6" style={{ borderLeft: i === 0 ? "none" : `1px solid ${C.borderFaint}` }}>
              <AppIcon color={t.color} icon={t.icon} size={26} r={7} />
              <h3 className="mt-4 text-[16px] font-medium" style={{ fontFamily: DISP, color: C.ink }}>
                {t.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.6]" style={{ color: C.ink3 }}>
                {t.body}
              </p>
              <span
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium"
                style={{ color: t.active ? C.amberText : C.ink3 }}
              >
                Learn more <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── FEATURE: decks → wide real product card (centered, warm section) ── */
function FeatureDecks() {
  return (
    <section style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.cream }}>
      <div className="mx-auto max-w-[1180px] px-6 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[640px] text-center">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: C.ink }}>
              <AppIcon color={C.deck} icon={Presentation} size={22} />
              Primy Decks
            </div>
            <h2 style={head("clamp(30px,3.8vw,46px)", 1.05, 600)}>Decks that design themselves.</h2>
            <p className="mx-auto mt-4 max-w-[500px] text-[16px] leading-[1.6]" style={{ color: C.ink3 }}>
              Describe it and Primy generates a full deck from your project, on your brand theme. Edit any slide by
              chatting, then export to PDF or PPTX.
            </p>
          </Reveal>
        </div>
        <Reveal delay={80} className="mt-12">
          <ProductCard color={C.deck} img="/landing/feat/deck.webp" alt="Primy deck generation" url="app.primy.com/deck" pad="p-5 sm:p-10" />
        </Reveal>
      </div>
    </section>
  );
}

/* ── testimonial band ── */
function Testimonial() {
  return (
    <section className="relative overflow-hidden" style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.surface }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ ...DOTS("rgba(24,24,22,0.10)", 16), opacity: 0.6 }} />
      <OrbitAccent className="pointer-events-none absolute left-[3%] top-[18%] hidden h-16 w-16 opacity-[0.18] lg:block" />
      <div className="relative mx-auto max-w-[1000px] px-6 py-24 lg:px-8 lg:py-28">
        <Reveal>
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto] lg:gap-16">
            <p style={head("clamp(22px,2.8vw,32px)", 1.32, 500)}>
              <span style={{ color: C.ink }}>
                &ldquo;What used to be a weekend of copy-pasting from ChatGPT is now one chat. Primy ships the deck, the doc,
                and the page, all on brand.&rdquo;
              </span>
            </p>
            <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:text-right">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: tint(C.amber), color: C.amberText, fontFamily: DISP }}
              >
                ME
              </div>
              <div>
                <div className="text-[14px] font-medium" style={{ color: C.ink }}>
                  Maya Ellis
                </div>
                <div className="text-[13px]" style={{ color: C.ink3 }}>
                  Fractional CMO, Northwind
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FEATURE: connected project → mini board fragment ── */
function FeatureConnected() {
  return (
    <section style={{ borderTop: `1px solid ${C.borderFaint}`, backgroundColor: C.surface }}>
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <Reveal delay={80} className="lg:order-2">
          <ProductCard color={C.purple} img="/landing/feat/board.webp" alt="Primy connected workspace" url="app.primy.com/workspace" pad="p-4 sm:p-6" />
        </Reveal>
        <div className="lg:order-1">
          <FeatureHeader
            eyebrow={{ label: "One workspace", color: C.purple, icon: LayoutTemplate }}
            title="Everything stays connected."
            body="Docs, decks, and pages live in one project sharing the same memory. Reference any file, and the AI already knows it."
            cta="See how it works"
          />
        </div>
      </div>
    </section>
  );
}

/* ── formats ── */
const FORMATS = ["PDF", "DOCX", "XLSX", "CSV", "TXT", "MD", "PNG", "JSON", "PPTX", "ZIP"];
function Formats() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: C.sunken, borderTop: `1px solid ${C.borderFaint}` }}>
      {/* peaks variant as a colored decorative range above the heading */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44">
        <Scene variant="peaks" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 0%, ${C.sunken}80 55%, ${C.sunken} 88%)` }} />
      </div>
      <div className="relative mx-auto max-w-[1180px] px-6 pb-24 pt-40 text-center lg:px-8 lg:pb-28 lg:pt-44">
        <Reveal>
          <h2 style={head("clamp(28px,3.4vw,42px)", 1.07, 600)}>Drag in anything. It just reads it.</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-[1.6]" style={{ color: C.ink3 }}>
            Drop in files and let Primy build with full context, never from a blank page.
          </p>
          <div className="mx-auto mt-10 flex max-w-[760px] flex-wrap items-center justify-center gap-3">
            {FORMATS.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium tabular-nums"
                style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink2 }}
              >
                <Paperclip className="h-3.5 w-3.5" strokeWidth={2} style={{ color: C.amberText }} /> {f}
              </span>
            ))}
            <span className="inline-flex items-center rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium" style={{ color: C.ink3 }}>
              and more
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── final CTA ── */
function FinalCTA() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: C.surface, borderTop: `1px solid ${C.borderFaint}` }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${C.borderFaint} 1px, transparent 1px), linear-gradient(90deg, ${C.borderFaint} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          WebkitMaskImage: "radial-gradient(110% 80% at 50% 100%, #000 25%, transparent 72%)",
          maskImage: "radial-gradient(110% 80% at 50% 100%, #000 25%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto max-w-[1180px] px-6 pt-28 text-center lg:px-8 lg:pt-32">
        <h2 style={head("clamp(34px,4.6vw,56px)", 1.02, 600)}>Stop doing it by hand.</h2>
        <p className="mx-auto mt-5 max-w-[440px] text-[16px] leading-[1.6]" style={{ color: C.ink3 }}>
          Start with one project. Free forever, no credit card.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <button
            className="inline-flex items-center rounded-[10px] px-6 font-medium text-white transition-transform active:scale-[0.98]"
            style={{ transitionTimingFunction: EASE, height: 48, fontSize: 15, backgroundColor: C.ink }}
          >
            Start for free
          </button>
          <button
            className="inline-flex items-center rounded-[10px] px-6 text-[15px] font-medium transition-transform active:scale-[0.98]"
            style={{ height: 48, backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }}
          >
            Get a demo
          </button>
        </div>
        {/* cool scenic close (a different composition than the hero) */}
        <div className="relative mx-auto mt-16 h-[150px] max-w-[1000px] overflow-hidden rounded-t-[22px] sm:h-[180px]">
          <Scene variant="dusk" className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ backgroundColor: C.surface, borderTop: `1px solid ${C.borderFaint}` }}>
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ backgroundColor: C.ink }}>
            <Mark size={12} />
          </span>
          <span className="text-[13px] font-medium">Primy</span>
        </div>
        <div className="flex items-center gap-5 text-[12.5px]" style={{ color: C.ink3 }}>
          {["Product", "Pricing", "Customers", "Privacy", "Terms"].map((l) => (
            <span key={l} className="cursor-pointer transition-colors hover:text-[#1A1815]">
              {l}
            </span>
          ))}
        </div>
        <span className="text-[12px]" style={{ color: C.inkMuted }}>
          © 2026 Primy
        </span>
      </div>
    </footer>
  );
}
