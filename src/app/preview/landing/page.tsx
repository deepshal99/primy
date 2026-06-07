"use client";

/* ──────────────────────────────────────────────────────────────
   /preview/landing — clean, magicpath/conduit-inspired landing (v3).
   Standalone. Does NOT touch the real "/" page.
   - Hero is clean (NO gradient behind text). Two modes via a light
     toggle: "Product" (magicpath-style app screen) and "Chat".
   - Color comes from small entity accents (dots/icons), not auras.
   - The only soft tints are the contained, uniform card headers.
   Governed by docs/superpowers/specs/2026-06-06-primy-landing-design-system.md
   ────────────────────────────────────────────────────────────── */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Newsreader, Inter_Tight } from "next/font/google";
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Sheet,
  Presentation,
  LayoutTemplate,
  Paperclip,
  Wand2,
  Layers,
  X,
  Check,
} from "lucide-react";

/* Two display options for headlines (compare via the floating switch).
   Body / UI always stays Inter (brand). Marketing-only. */
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const SERIF = serif.style.fontFamily;
const SANS = sans.style.fontFamily;

/* heading typography depends on the chosen mode */
type FontMode = "sans" | "serif";
const HeadCtx = createContext<{ family: string; isSerif: boolean }>({ family: SERIF, isSerif: true });
function useHead() {
  return useContext(HeadCtx);
}
/* returns inline style for a heading at a given size, mode-aware */
function headStyle(h: { family: string; isSerif: boolean }, fontSize: string, lineHeight = 1.05) {
  return {
    fontFamily: h.family,
    fontWeight: 500, // light-medium, reducto-like — never bold
    fontSize,
    lineHeight,
    letterSpacing: h.isSerif ? "-0.015em" : "-0.022em",
  } as React.CSSProperties;
}

const C = {
  canvas: "#FCFBF8",
  surface: "#FFFDFB",
  sunken: "#F7F7F4",
  ink: "#1A1815",
  ink2: "#3B3A37",
  ink3: "#706E68",
  inkMuted: "#B9B6AE",
  amber: "#FFB43F",
  amberText: "#B87426",
  amberDeep: "#E0852B",
  blue: "#4285F4",
  green: "#42C366",
  deck: "#FFAD45",
  purple: "#8757D7",
  pink: "#F073A7",
  teal: "#67CEC8",
  sand: "#F4EDE2", // soft warm colored section bg (zapier-style, light not dark)
  mist: "#EDF1F8", // soft cool colored section bg
  border: "rgba(24,24,22,0.08)",
  borderStrong: "rgba(24,24,22,0.12)",
  borderFaint: "rgba(24,24,22,0.05)",
};

/* solid pastel tints per entity color — lively color BLOCKS (not gradients) */
const TINT: Record<string, string> = {
  [/* blue */ "#4285F4"]: "#EAF1FE",
  [/* green */ "#42C366"]: "#E7F7EC",
  [/* deck amber */ "#FFAD45"]: "#FFF2DF",
  [/* purple */ "#8757D7"]: "#F1EAFB",
};
const tintOf = (color: string) => TINT[color] ?? C.sunken;
const EASE = "cubic-bezier(0.32,0.72,0,1)";

export default function LandingPreview() {
  const [modal, setModal] = useState<{ open: boolean; prompt: string }>({
    open: false,
    prompt: "",
  });
  const openSignup = (prompt: string) => setModal({ open: true, prompt });
  const [heroMode, setHeroMode] = useState<"product" | "chat">("product");
  const [fontMode, setFontMode] = useState<FontMode>("sans");

  return (
    <HeadCtx.Provider value={{ family: fontMode === "serif" ? SERIF : SANS, isSerif: fontMode === "serif" }}>
      <div
        className="min-h-screen antialiased"
        style={{ backgroundColor: C.canvas, color: C.ink, fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <Nav onStart={() => openSignup("")} />
        <main>
          {heroMode === "product" ? (
            <HeroProduct onStart={() => openSignup("")} />
          ) : (
            <HeroChat onSubmit={openSignup} />
          )}
          <Reveal><StatementBand /></Reveal>
          <Reveal><Showcase /></Reveal>
          <Reveal><WhatYouMake /></Reveal>
          <Reveal><TheShift /></Reveal>
          <Reveal><FinalCTA onStart={() => openSignup("")} /></Reveal>
        </main>
        <LandingMotionCSS />
        <Footer />
        {modal.open && (
          <SignupModal prompt={modal.prompt} onClose={() => setModal({ open: false, prompt: "" })} />
        )}
        <ControlDock heroMode={heroMode} setHeroMode={setHeroMode} fontMode={fontMode} setFontMode={setFontMode} />
      </div>
    </HeadCtx.Provider>
  );
}

/* minimalist floating control: Font (Aa) Sans/Serif + Hero Product/Chat */
function ControlDock({
  heroMode,
  setHeroMode,
  fontMode,
  setFontMode,
}: {
  heroMode: "product" | "chat";
  setHeroMode: (m: "product" | "chat") => void;
  fontMode: FontMode;
  setFontMode: (m: FontMode) => void;
}) {
  const seg = (active: boolean) =>
    ({
      backgroundColor: active ? C.ink : "transparent",
      color: active ? "#fff" : C.ink3,
    }) as React.CSSProperties;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ backgroundColor: "rgba(255,253,251,0.9)", border: `1px solid ${C.border}`, backdropFilter: "blur(12px)", boxShadow: "0 8px 24px -10px rgba(24,24,22,0.25)" }}
      >
        <span className="pl-2.5 pr-1 text-[13px]" style={{ fontFamily: SERIF, color: C.inkMuted }}>Aa</span>
        {(["sans", "serif"] as const).map((m) => (
          <button key={m} onClick={() => setFontMode(m)} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors duration-150" style={seg(fontMode === m)}>
            {m}
          </button>
        ))}
        <span className="mx-1 h-4 w-px" style={{ backgroundColor: C.border }} />
        {(["product", "chat"] as const).map((m) => (
          <button key={m} onClick={() => setHeroMode(m)} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors duration-150" style={seg(heroMode === m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

/* scroll-reveal wrapper (gentle fade-up; degrades w/ reduced motion) */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
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
    <div ref={ref} className={`lp-reveal${seen ? " in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* one-time global keyframes for the landing preview */
function LandingMotionCSS() {
  return (
    <style>{`
      @keyframes lpRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
      .lp-rise { animation: lpRise .6s cubic-bezier(.32,.72,0,1) both }
      .lp-reveal { opacity: 0; transform: translateY(16px); transition: opacity .6s cubic-bezier(.32,.72,0,1), transform .6s cubic-bezier(.32,.72,0,1) }
      .lp-reveal.in { opacity: 1; transform: none }
      @media (prefers-reduced-motion: reduce) {
        .lp-rise, .lp-reveal { animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important }
      }
    `}</style>
  );
}

/* ──────────────────────────────────────────────
   Primitives
   ────────────────────────────────────────────── */

function PrimyMark({ color = "#fff", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill={color} aria-hidden>
      <rect x="0" y="5" width="6" height="12" rx="3" />
      <rect x="7" y="2" width="5" height="18" rx="2.5" transform="rotate(-28 9.5 11)" />
      <rect x="12" y="3" width="5" height="16" rx="2.5" transform="rotate(28 14.5 11)" />
      <rect x="18" y="6" width="4" height="10" rx="2" />
    </svg>
  );
}

/* centered section header — mode-aware title + Inter blurb. No eyebrow/label/dot. */
function SectionHead({ title, blurb }: { title: React.ReactNode; blurb?: string }) {
  const h = useHead();
  return (
    <div className="mx-auto mb-14 max-w-[680px] text-center sm:mb-16">
      <h2 className="text-balance" style={headStyle(h, "clamp(30px,4vw,52px)", 1.07)}>
        {title}
      </h2>
      {blurb && (
        <p className="mx-auto mt-5 max-w-[540px] text-[15px] leading-[1.6] sm:text-[16px]" style={{ color: C.ink3 }}>
          {blurb}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Nav
   ────────────────────────────────────────────── */

function Nav({ onStart }: { onStart: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 6);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header
      className="sticky top-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-300"
      style={{
        transitionTimingFunction: EASE,
        backgroundColor: scrolled ? "rgba(252,251,248,0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `1px solid ${scrolled ? C.borderFaint : "transparent"}`,
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: C.ink }}>
            <PrimyMark size={14} />
          </span>
          <span className="text-[15px] font-medium tracking-[-0.01em]">Primy</span>
        </div>
        <nav className="flex items-center gap-1">
          {["Product", "Pricing"].map((l) => (
            <span key={l} className="hidden cursor-pointer rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors duration-150 hover:bg-[rgba(24,24,22,0.04)] sm:inline" style={{ color: C.ink3 }}>
              {l}
            </span>
          ))}
          <span className="hidden cursor-pointer rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors duration-150 hover:bg-[rgba(24,24,22,0.04)] sm:inline" style={{ color: C.ink3 }}>
            Sign in
          </span>
          <button onClick={onStart} className="ml-1 inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium text-white transition-transform duration-200 active:scale-[0.98]" style={{ transitionTimingFunction: EASE, backgroundColor: C.ink }}>
            Get started
          </button>
        </nav>
      </div>
    </header>
  );
}

/* shared hero copy — mode-aware headline, Inter sub. No eyebrow, no dot, no italics. */
function HeroCopy() {
  const h = useHead();
  return (
    <>
      {/* two lines: line 1 stays on one row (nowrap on sm+), line 2 = accent */}
      <h1 style={headStyle(h, "clamp(38px,5.2vw,66px)", 1.06)}>
        <span className="sm:whitespace-nowrap">Stop doing docs by hand.</span>
        <br />
        <span style={{ color: C.amberDeep }}>Just ask.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-[560px] text-[17px] leading-[1.55] sm:text-[18px]" style={{ color: C.ink3 }}>
        Primy is an AI workspace for documents, spreadsheets, decks, and pages.
        You chat, and the AI builds and edits them for you.
      </p>
    </>
  );
}

/* ──────────────────────────────────────────────
   HERO — Product (magicpath-style): clean, no gradient,
   big app screen sitting on the canvas.
   ────────────────────────────────────────────── */

function HeroProduct({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[940px] px-6 pb-12 pt-20 text-center lg:pt-28">
        <HeroCopy />
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onStart}
            className="group inline-flex items-center gap-2 rounded-full pl-5 pr-2 font-medium text-white transition-transform duration-200 active:scale-[0.98]"
            style={{ transitionTimingFunction: EASE, height: 46, fontSize: 14.5, backgroundColor: C.ink }}
          >
            Start free
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" style={{ transitionTimingFunction: EASE, backgroundColor: "rgba(255,255,255,0.16)" }}>
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </button>
          <button className="inline-flex items-center rounded-full px-5 text-[14.5px] font-medium transition-colors duration-150" style={{ height: 46, backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }}>
            See how it works
          </button>
        </div>
        <div className="mt-7 flex items-center justify-center gap-5 text-[12.5px]" style={{ color: C.ink3 }}>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: C.green }} /> Free forever plan</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: C.green }} /> No credit card</span>
        </div>
      </div>

      {/* reducto-style artifact thumbnail row (themed to our 4 artifacts) */}
      <div className="mx-auto max-w-[1080px] px-6 pb-24 lg:px-8 lg:pb-28">
        <ArtifactThumbRow />
      </div>
    </section>
  );
}

/* a row of artifact "paper" thumbnails — reducto's hero document row, themed.
   Each shows mini content + a small entity-colored tag. Staggers in on load. */
function ArtifactThumbRow() {
  const items: { kind: "doc" | "sheet" | "deck" | "page"; color: string; tag: string }[] = [
    { kind: "doc", color: C.blue, tag: "Doc" },
    { kind: "sheet", color: C.green, tag: "Sheet" },
    { kind: "deck", color: C.deck, tag: "Deck" },
    { kind: "page", color: C.purple, tag: "Page" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.kind}
          className="lp-rise group relative aspect-[3/4] overflow-hidden rounded-[16px] p-3.5 transition-transform duration-300 hover:-translate-y-[5px]"
          style={{
            transitionTimingFunction: EASE,
            backgroundColor: tintOf(it.color),
            border: `1px solid ${it.color}26`,
            boxShadow: "0 18px 44px -26px rgba(24,24,22,0.22), 0 1px 2px rgba(24,24,22,0.04)",
            animationDelay: `${i * 90}ms`,
          }}
        >
          <span
            className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: it.color }}
          >
            {it.tag}
          </span>
          <div className="h-full w-full">
            <ArtifactPreview kind={it.kind} color={it.color} />
          </div>
        </div>
      ))}
    </div>
  );
}


/* ──────────────────────────────────────────────
   HERO — Chat (the earlier ChatGPT-style option), now gradient-free
   ────────────────────────────────────────────── */

const SUGGESTIONS = [
  { label: "Draft a project brief", color: C.blue, icon: FileText },
  { label: "Build a budget sheet", color: C.green, icon: Sheet },
  { label: "Make a pitch deck", color: C.deck, icon: Presentation },
  { label: "Design a landing page", color: C.purple, icon: LayoutTemplate },
];

function HeroChat({ onSubmit }: { onSubmit: (prompt: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (text?: string) => onSubmit((text ?? value).trim());

  return (
    <section className="relative">
      <div className="relative mx-auto max-w-[760px] px-6 pb-24 pt-20 text-center lg:pt-28">
        <HeroCopy />
        <div className="mx-auto mt-10 max-w-[620px]">
          <ChatInput value={value} onChange={setValue} onSubmit={() => submit()} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  onClick={() => submit(s.label)}
                  className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200 hover:-translate-y-[1px]"
                  style={{ transitionTimingFunction: EASE, backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink2 }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} style={{ color: s.color }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-9 flex items-center justify-center gap-5 text-[12.5px]" style={{ color: C.ink3 }}>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: C.green }} /> Free forever plan</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: C.green }} /> No credit card</span>
        </div>
      </div>
    </section>
  );
}

function ChatInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-[18px] p-2 pl-3.5 transition-shadow duration-300"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: "0 14px 40px -18px rgba(24,24,22,0.22), 0 2px 6px rgba(24,24,22,0.04)",
      }}
    >
      <Paperclip className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} style={{ color: C.inkMuted }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Ask Primy to draft a doc, build a sheet, make a deck..."
        className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#B9B6AE]"
        style={{ color: C.ink }}
      />
      <button
        onClick={onSubmit}
        aria-label="Send"
        className="group flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] text-white transition-transform duration-200 active:scale-[0.95]"
        style={{ transitionTimingFunction: EASE, backgroundColor: C.ink }}
      >
        <ArrowUpRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" strokeWidth={2} style={{ transitionTimingFunction: EASE }} />
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────
   STATEMENT BAND — short, punchy serif line (reducto rhythm).
   Deliberately short section: height = lower importance, high impact.
   ────────────────────────────────────────────── */

function StatementBand() {
  const h = useHead();
  // sparse colored squares over a dot-matrix (reducto stat-band motif), themed
  const squares = [
    { top: "18%", left: "12%", c: C.blue },
    { top: "66%", left: "20%", c: C.green },
    { top: "30%", left: "82%", c: C.purple },
    { top: "72%", left: "76%", c: C.deck },
    { top: "12%", left: "62%", c: C.amber },
    { top: "58%", left: "46%", c: C.blue },
  ];
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: C.canvas, borderTop: `1px solid ${C.borderFaint}`, borderBottom: `1px solid ${C.borderFaint}` }}>
      {/* dot matrix */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(24,24,22,0.10) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 50%, #000 10%, transparent 80%)",
          maskImage: "radial-gradient(80% 70% at 50% 50%, #000 10%, transparent 80%)",
          opacity: 0.5,
        }}
      />
      {squares.map((s, i) => (
        <span key={i} aria-hidden className="pointer-events-none absolute h-2.5 w-2.5 rounded-[2px]" style={{ top: s.top, left: s.left, backgroundColor: s.c, opacity: 0.85 }} />
      ))}
      <div className="relative mx-auto max-w-[900px] px-6 py-20 text-center lg:py-24">
        <p className="text-balance" style={{ ...headStyle(h, "clamp(25px,3.2vw,40px)", 1.26), color: C.ink }}>
          From a blank page to a finished deliverable
          <br className="hidden sm:block" />
          {" "}in a single <span style={{ color: C.amberDeep }}>conversation.</span>
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   SHOWCASE — reducto's interactive feature list + big product view.
   Left: clickable capability list. Right: our product mock, swaps per item.
   ────────────────────────────────────────────── */

/* each capability shows the screenshot that actually depicts it */
const CAPS = [
  { icon: Wand2, color: C.amber, accent: C.amberText, title: "Chat to create", body: "Describe what you need in plain English. Primy drafts it and edits it with you, right in the chat.", img: "/landing/app/chat.webp" },
  { icon: FileText, color: C.blue, accent: C.blue, title: "Write documents", body: "Briefs, proposals, and updates in rich text, drafted and refined by chatting.", img: "/landing/app/doc.webp" },
  { icon: Presentation, color: C.deck, accent: C.deck, title: "Build decks", body: "Full-fidelity pitch and launch decks generated from your project, export-ready.", img: "/landing/app/deck.webp" },
  { icon: Layers, color: C.purple, accent: C.purple, title: "One connected project", body: "Docs, sheets, decks, and pages share the same memory. Nothing to re-explain.", img: "/landing/app/board.webp" },
];

/* product screenshot floating in a soft colored card, bleeding off the bottom */
function ProductCard({ img, color, alt, height = 440 }: { img: string; color: string; alt: string; height?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px]"
      style={{
        height,
        background: `linear-gradient(155deg, ${color}26 0%, ${tintOf(color)} 48%, ${C.surface} 100%)`,
        border: `1px solid ${color}2e`,
      }}
    >
      <div
        className="lp-rise mx-5 mt-6 overflow-hidden rounded-t-[12px] sm:mx-8 sm:mt-8"
        style={{ border: `1px solid ${C.borderFaint}`, boxShadow: "0 30px 60px -28px rgba(24,24,22,0.32)" }}
      >
        <img src={img} alt={alt} className="block w-full" />
      </div>
    </div>
  );
}

function Showcase() {
  const h = useHead();
  const [active, setActive] = useState(0);
  return (
    <section style={{ backgroundColor: C.sand, borderTop: `1px solid ${C.borderFaint}`, borderBottom: `1px solid ${C.borderFaint}` }}>
      <div className="mx-auto max-w-[1160px] px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* left: capability list */}
          <div className="lg:col-span-5">
            <h2 className="text-balance" style={headStyle(h, "clamp(28px,3.4vw,44px)", 1.08)}>
              One chat. Every kind of work.
            </h2>
            <div className="mt-8">
              {CAPS.map((cap, i) => {
                const Icon = cap.icon;
                const on = i === active;
                return (
                  <button
                    key={cap.title}
                    onClick={() => setActive(i)}
                    className="w-full text-left"
                    style={{ borderTop: `1px solid ${C.borderFaint}`, ...(i === CAPS.length - 1 ? { borderBottom: `1px solid ${C.borderFaint}` } : {}) }}
                  >
                    <div className="flex items-center gap-3 py-4">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors duration-300"
                        style={{ transitionTimingFunction: EASE, backgroundColor: on ? cap.color : `${cap.color}14` }}
                      >
                        <Icon className="h-[17px] w-[17px]" strokeWidth={2} style={{ color: on ? "#fff" : cap.color }} />
                      </span>
                      <span className="text-[16px]" style={{ fontWeight: 500, color: on ? C.ink : C.ink2 }}>{cap.title}</span>
                    </div>
                    <div className="grid transition-[grid-template-rows] duration-300" style={{ transitionTimingFunction: EASE, gridTemplateRows: on ? "1fr" : "0fr" }}>
                      <div className="overflow-hidden">
                        <p className="pb-4 pl-[44px] pr-2 text-[14px] leading-[1.6]" style={{ color: C.ink3 }}>{cap.body}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* right: real app screenshot inside a soft colored card (zapier-style) */}
          <div className="lg:col-span-7">
            <ProductCard key={active} img={CAPS[active].img} color={CAPS[active].color} alt={`Primy: ${CAPS[active].title}`} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   WHAT YOU CAN MAKE — 4 uniform cards
   ────────────────────────────────────────────── */

const ARTIFACTS = [
  { icon: FileText, color: C.blue, name: "Documents", line: "Briefs, proposals, updates. Rich text, written and edited by chat.", preview: "doc" as const },
  { icon: Sheet, color: C.green, name: "Spreadsheets", line: "Track metrics and build models. Paste a CSV, ask for the math.", preview: "sheet" as const },
  { icon: Presentation, color: C.deck, name: "Decks", line: "Pitch and launch decks, full-fidelity. Export to PDF or PPTX.", preview: "deck" as const },
  { icon: LayoutTemplate, color: C.purple, name: "Pages", line: "Client-ready one-pagers and landing pages, on-brand, ready to ship.", preview: "page" as const, hero: true },
];

function WhatYouMake() {
  return (
    <section style={{ backgroundColor: C.canvas }}>
      <div className="mx-auto max-w-[1160px] px-6 py-24 lg:px-8 lg:py-32">
        <SectionHead
          title={<>Four things to make. One place to make them.</>}
          blurb='Every artifact lives in the project that made it, sharing the same memory. No more "where did I save that?"'
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ARTIFACTS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.name}
                className="group relative flex flex-col overflow-hidden rounded-[16px] transition-transform duration-300 hover:-translate-y-[3px]"
                style={{ transitionTimingFunction: EASE, backgroundColor: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(24,24,22,0.04)" }}
              >
                {/* mini-preview header on a solid pastel of the entity color */}
                <div className="relative h-[124px] overflow-hidden p-4" style={{ backgroundColor: tintOf(a.color), borderBottom: `1px solid ${a.color}1f` }}>
                  <ArtifactPreview kind={a.preview} color={a.color} />
                  {a.hero && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-medium uppercase text-white" style={{ letterSpacing: "0.08em", backgroundColor: C.purple }}>
                      Hero
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ backgroundColor: a.color }}>
                    <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                  </span>
                  <h3 className="text-[16px]" style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>{a.name}</h3>
                  <p className="mt-1.5 text-[13px] leading-[1.5]" style={{ color: C.ink3 }}>{a.line}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* tiny representative artifact previews — clean, entity-colored, no gradients */
function ArtifactPreview({ kind, color }: { kind: "doc" | "sheet" | "deck" | "page"; color: string }) {
  const line = (w: string, c = "rgba(24,24,22,0.08)") => (
    <div className="h-1.5 rounded-full" style={{ width: w, backgroundColor: c }} />
  );
  if (kind === "doc") {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 rounded-[8px] p-3" style={{ backgroundColor: C.surface, border: `1px solid ${C.borderFaint}` }}>
        {line("60%", `${color}66`)}
        {line("100%")}
        {line("92%")}
        {line("96%")}
        {line("70%")}
      </div>
    );
  }
  if (kind === "sheet") {
    return (
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 overflow-hidden rounded-[8px]" style={{ backgroundColor: C.surface, border: `1px solid ${C.borderFaint}` }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center" style={{ borderRight: i % 3 !== 2 ? `1px solid ${C.borderFaint}` : "none", borderBottom: i < 6 ? `1px solid ${C.borderFaint}` : "none", backgroundColor: i === 4 ? `${color}1f` : "transparent" }}>
            <div className="h-1 rounded-full" style={{ width: "52%", backgroundColor: i < 3 ? `${color}66` : "rgba(24,24,22,0.10)" }} />
          </div>
        ))}
      </div>
    );
  }
  if (kind === "deck") {
    return (
      <div className="flex h-full w-full items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 flex-col gap-1 rounded-[6px] p-2" style={{ height: "82%", backgroundColor: C.surface, border: `1px solid ${C.borderFaint}` }}>
            <div className="h-1.5 rounded-full" style={{ width: i === 0 ? "80%" : "60%", backgroundColor: i === 0 ? `${color}80` : "rgba(24,24,22,0.10)" }} />
            <div className="h-1 rounded-full" style={{ width: "92%", backgroundColor: "rgba(24,24,22,0.07)" }} />
            <div className="mt-auto h-3 rounded-[3px]" style={{ backgroundColor: `${color}14` }} />
          </div>
        ))}
      </div>
    );
  }
  // page
  return (
    <div className="flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-[8px] p-2.5" style={{ backgroundColor: C.surface, border: `1px solid ${C.borderFaint}` }}>
      <div className="h-5 rounded-[4px]" style={{ backgroundColor: `${color}1f` }} />
      <div className="flex gap-1.5">
        <div className="h-7 flex-1 rounded-[4px]" style={{ backgroundColor: "rgba(24,24,22,0.05)" }} />
        <div className="h-7 flex-1 rounded-[4px]" style={{ backgroundColor: `${color}14` }} />
        <div className="h-7 flex-1 rounded-[4px]" style={{ backgroundColor: "rgba(24,24,22,0.05)" }} />
      </div>
      <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: "rgba(24,24,22,0.08)" }} />
    </div>
  );
}

/* ──────────────────────────────────────────────
   [02] THE SHIFT — manual → just ask
   ────────────────────────────────────────────── */

function TheShift() {
  return (
    <section style={{ backgroundColor: C.sunken, borderTop: `1px solid ${C.borderFaint}`, borderBottom: `1px solid ${C.borderFaint}` }}>
      <div className="mx-auto max-w-[1160px] px-6 py-24 lg:px-8 lg:py-32">
        <SectionHead
          title={<>The manual work just quietly disappears.</>}
          blurb="Docs and sheets by hand are slow: format, copy, paste, repeat. With a chat window doing the work, the busywork is gone."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[16px] p-7" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
            <div className="mb-5 text-[11px] font-medium uppercase" style={{ letterSpacing: "0.1em", color: C.ink3 }}>The old way</div>
            <ul className="space-y-3.5">
              {[
                "Open a blank doc. Stare at it.",
                "Paste from ChatGPT, then reformat by hand.",
                "Numbers in the sheet drift out of sync with the deck.",
                "By Friday, nobody knows which file is current.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.ink2 }}>
                  <span className="mt-[9px] inline-block h-px w-3 flex-shrink-0" style={{ backgroundColor: "rgba(24,24,22,0.26)" }} />
                  <span className="leading-[1.5]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[16px] p-7" style={{ backgroundColor: C.surface, border: `1px solid rgba(255,180,63,0.3)`, boxShadow: "0 8px 30px -16px rgba(255,180,63,0.25)" }}>
            <div className="mb-5 flex items-center gap-1.5 text-[11px] font-medium uppercase" style={{ letterSpacing: "0.1em", color: C.amberText }}>
              <PrimyMark color={C.ink} size={13} /> With Primy
            </div>
            <ul className="space-y-3.5">
              {[
                "Drag in your files. The AI reads them all once.",
                'Ask once: "draft the brief, build the metrics, make the deck."',
                "Cross-references stay in sync across every artifact.",
                "Tomorrow, the AI still remembers everything.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.ink2 }}>
                  <Check className="mt-[2px] h-4 w-4 flex-shrink-0" strokeWidth={2.25} style={{ color: C.amber }} />
                  <span className="leading-[1.5]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   Final CTA — light, soft aura (no dark band)
   ────────────────────────────────────────────── */

function FinalCTA({ onStart }: { onStart: () => void }) {
  const h = useHead();
  return (
    <section style={{ backgroundColor: C.canvas }}>
      <div className="mx-auto max-w-[1160px] px-6 py-20 lg:px-8 lg:py-28">
        <div
          className="rounded-[20px] px-6 py-16 text-center sm:py-20"
          style={{ backgroundColor: C.sunken, border: `1px solid ${C.border}` }}
        >
          <h2 className="text-balance" style={headStyle(h, "clamp(30px,4.4vw,54px)", 1.05)}>
            Stop doing it by hand.
            <br />
            Start with one project.
          </h2>
          <p className="mx-auto mt-5 max-w-[460px] text-[16px] leading-[1.6]" style={{ color: C.ink2 }}>
            Sign up in 30 seconds. Drag in your first file. Watch the AI build your next
            doc, sheet, deck, or page.
          </p>
          <div className="mt-9 flex justify-center">
            <button
              onClick={onStart}
              className="group inline-flex items-center gap-2 rounded-full pl-6 pr-2 font-medium text-white transition-transform duration-200 active:scale-[0.98]"
              style={{ transitionTimingFunction: EASE, height: 48, fontSize: 15, backgroundColor: C.ink }}
            >
              Start free
              <span className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" style={{ transitionTimingFunction: EASE, backgroundColor: "rgba(255,255,255,0.16)" }}>
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ backgroundColor: C.canvas, borderTop: `1px solid ${C.borderFaint}` }}>
      <div className="mx-auto flex max-w-[1160px] flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row lg:px-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ backgroundColor: C.ink }}>
            <PrimyMark size={12} />
          </span>
          <span className="text-[13px] font-medium">Primy</span>
        </div>
        <div className="flex items-center gap-5 text-[12.5px]" style={{ color: C.ink3 }}>
          {["Product", "Pricing", "Privacy", "Terms"].map((l) => (
            <span key={l} className="cursor-pointer transition-colors hover:text-[#1A1815]">{l}</span>
          ))}
        </div>
        <span className="text-[12px]" style={{ color: C.inkMuted }}>© 2026 Primy</span>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   Signup modal (preview-only) — opens on submit/CTA
   ────────────────────────────────────────────── */

function SignupModal({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const h = useHead();
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", f);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(24,24,22,0.32)", backdropFilter: "blur(6px)", animation: "lpFade 200ms ease-out" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[20px] p-7"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 30px 80px -20px rgba(24,24,22,0.4)", animation: "lpPop 240ms cubic-bezier(0.32,0.72,0,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(24,24,22,0.05)]" style={{ color: C.ink3 }}>
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: C.ink }}>
          <PrimyMark size={17} />
        </span>
        <h3 className="mt-4" style={headStyle(h, "23px", 1.15)}>
          Create your account to build it
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-[1.5]" style={{ color: C.ink3 }}>
          Free forever plan. No credit card. 30 seconds to start.
        </p>

        {prompt && (
          <div className="mt-4 flex items-start gap-2 rounded-[12px] px-3 py-2.5" style={{ backgroundColor: C.sunken, border: `1px solid ${C.borderFaint}` }}>
            <span className="mt-0.5 text-[10px] font-medium uppercase" style={{ letterSpacing: "0.08em", color: C.inkMuted }}>You asked</span>
            <span className="text-[13px] leading-[1.45]" style={{ color: C.ink2 }}>{prompt}</span>
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-medium transition-colors" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }}>
            <GoogleG /> Continue with Google
          </button>
          <input placeholder="you@work.com" className="h-11 w-full rounded-[10px] px-3.5 text-[14px] outline-none" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.ink }} />
          <button className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-medium text-white transition-transform duration-200 active:scale-[0.99]" style={{ transitionTimingFunction: EASE, backgroundColor: C.ink }}>
            Continue with email
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-[2px]" strokeWidth={2} style={{ transitionTimingFunction: EASE }} />
          </button>
        </div>

        <p className="mt-4 text-center text-[12px]" style={{ color: C.ink3 }}>
          Already have an account? <span className="cursor-pointer font-medium" style={{ color: C.blue }}>Sign in</span>
        </p>
      </div>

      <style>{`
        @keyframes lpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lpPop { from { opacity: 0; transform: translateY(8px) scale(0.97) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { [style*="lpPop"], [style*="lpFade"] { animation: none !important } }
      `}</style>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
