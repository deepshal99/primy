"use client";

/* ──────────────────────────────────────────────────────────────
   The Primy marketing landing (renders on "/" and /preview/magicpath).
   Clean hero + live demos as proof, airy alternating sections, tight
   grotesk display. Color roles: ink = primary action, blue =
   interactive, amber = AI signal, entity colors = contextual layer.
   Spec: docs/superpowers/specs/2026-06-10-primy-magicpath-landing.md
   ────────────────────────────────────────────────────────────── */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/shared/Logo";
import { PLAN_LIMITS, PRO_PRICE_USD } from "@/lib/plans";
import { C, ENTITY, BODY, DISPLAY, MAXW } from "./theme";
import { Eyebrow, H1, H2, Accent, Body, BtnPrimary, BtnSecondary, Section, Reveal, ArrowIcon } from "./ui";
import { HeroDemo } from "./HeroDemo";
import { BoardScene, FlowDiagram, ShareLinkBlock, SplitCard } from "./scenes";
import { LivePageCard } from "./LivePage";

const SIGNUP = "/login";
const CONTACT = "mailto:info@pixeldust.in";

/* honest marquee: who this is for, not fake customer logos */
const ROLES = [
  "Solo consultants",
  "Fractional CMOs",
  "Agencies of one",
  "Brand studios",
  "Freelance strategists",
  "Indie founders",
  "Boutique agencies",
  "Product marketers",
  "Ops consultants",
  "Coaches and advisors",
  "Grant writers",
  "Researchers",
];

export default function Landing() {
  return (
    <div style={{ background: C.white, fontFamily: BODY, color: C.body }}>
      <GlobalKeyframes />
      <Nav />
      <Announcement />
      <Hero />
      <RoleStrip />
      <EntityGrid />
      <ActMultiplayer />
      <ActBringEverything />
      <ActChatToDeliverable />
      <ActInstantLinks />
      <PricingTeaser />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ───────────── nav ───────────── */

function Nav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 70,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          maxWidth: MAXW,
          margin: "0 auto",
          height: "100%",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1A1815", display: "grid", placeItems: "center" }}>
            <LogoMark size={14} style={{ color: "#fff" }} />
          </div>
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em", color: C.ink }}>Primy</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 13.5, fontWeight: 500 }}>
          <Link href="/pricing" className="mpNavLink" style={{ color: C.body, textDecoration: "none" }}>
            Pricing
          </Link>
          <Link href="/login" className="mpNavLink" style={{ color: C.blueText, textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>
          <BtnPrimary href={SIGNUP} style={{ height: 32, padding: "0 12px" }}>
            Start free
          </BtnPrimary>
        </nav>
      </div>
    </header>
  );
}

/* ───────────── announcement strip ───────────── */

function Announcement() {
  return (
    <div style={{ background: C.neutralTint, padding: "11px 24px", textAlign: "center" }}>
      <Link
        href={SIGNUP}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          fontSize: 13,
          fontWeight: 500,
          color: C.body,
          textDecoration: "none",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#fff",
            background: C.blue,
            borderRadius: 99,
            padding: "2.5px 8px",
          }}
        >
          New
        </span>
        Introducing Primy: the AI studio for client work
        <span style={{ color: C.blueText, display: "inline-flex" }}>
          <ArrowIcon size={12} />
        </span>
      </Link>
    </div>
  );
}

/* ───────────── hero (rotating entity word: the four things you ship) ───────────── */

const ROTATE = [
  { w: "page", c: C.purpleText },
  { w: "deck", c: C.amberText },
  { w: "doc", c: C.blueText },
  { w: "sheet", c: C.greenText },
];

function RotatingWord() {
  const [idx, setIdx] = useState(0);
  const [out, setOut] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const t = setInterval(() => {
      setOut(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % ROTATE.length);
        setOut(false);
      }, 220);
    }, 2400);
    return () => clearInterval(t);
  }, []);
  const cur = ROTATE[idx];
  return (
    <span
      style={{
        color: cur.c,
        display: "inline-block",
        opacity: out ? 0 : 1,
        transform: out ? "translateY(10px)" : "none",
        filter: out ? "blur(5px)" : "none",
        transition: "opacity 220ms var(--ease-out), transform 220ms var(--ease-out), filter 220ms var(--ease-out)",
      }}
    >
      {cur.w}.
    </span>
  );
}

function Hero() {
  const scrollToLive = () => {
    const el = document.getElementById("live-page");
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };
  return (
    <section style={{ background: C.alt }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "96px 24px 110px", textAlign: "center" }}>
        <Reveal>
          <H1>
            Turn scattered files into
            <br />
            a client-ready <RotatingWord />
          </H1>
        </Reveal>
        <Reveal delay={80}>
          <Body style={{ maxWidth: 680, margin: "22px auto 0" }}>
            Primy is the AI studio for independents. Chat to create docs, sheets, decks, and pages. Drag in any file, and
            per-client memory keeps everything connected.
          </Body>
        </Reveal>
        <Reveal delay={140}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            <BtnPrimary href={SIGNUP}>
              Start creating free
              <ArrowIcon size={12} />
            </BtnPrimary>
            <BtnSecondary onClick={scrollToLive}>See it in action</BtnSecondary>
          </div>
          <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 18, fontSize: 12.5, color: C.muted }}>
            {["Free forever plan", "No credit card"].map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8.5 6.5 12 13 4.5" stroke={C.greenText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={220} style={{ marginTop: 56 }}>
          <HeroDemo />
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── role marquee (honest: who it is for) ───────────── */

function RoleStrip() {
  return (
    <section style={{ background: C.alt, paddingBottom: 96 }}>
      <Eyebrow style={{ textAlign: "center", marginBottom: 30 }}>Built for independents who ship client work</Eyebrow>
      <div style={{ position: "relative", overflow: "hidden", maxWidth: 980, margin: "0 auto" }}>
        <div className="mpMarquee" style={{ display: "flex", gap: 14, width: "max-content" }}>
          {[...ROLES, ...ROLES].map((w, i) => (
            <span
              key={`${w}${i}`}
              style={{
                fontFamily: BODY,
                fontWeight: 500,
                fontSize: 13.5,
                color: C.body,
                whiteSpace: "nowrap",
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 99,
                padding: "8px 16px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, background: ENTITY[i % 4].color }} />
              {w}
            </span>
          ))}
        </div>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: 90, background: `linear-gradient(90deg, ${C.alt}, transparent)` }} />
        <div style={{ position: "absolute", inset: "0 0 0 auto", width: 90, background: `linear-gradient(270deg, ${C.alt}, transparent)` }} />
      </div>
    </section>
  );
}

/* ───────────── the four deliverables (solid pastel tints, one per entity) ───────────── */

function EntityGrid() {
  return (
    <Section bg={C.white}>
      <div style={{ textAlign: "center" }}>
        <Reveal>
          <Eyebrow style={{ textAlign: "center", marginBottom: 18 }}>One studio</Eyebrow>
          <H2>Four deliverables, one chat</H2>
          <Body style={{ maxWidth: 560, margin: "20px auto 0" }}>
            Everything a client engagement needs, made in the same place and connected to the same memory.
          </Body>
        </Reveal>
      </div>
      <Reveal delay={100} style={{ marginTop: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="mpFourCol">
          {ENTITY.map((e) => (
            <EntityCard key={e.key} e={e} />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function EntityCard({ e }: { e: (typeof ENTITY)[number] }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: C.white,
        boxShadow: hover ? `${C.ring}, 0 14px 34px rgba(24,24,22,0.10)` : `${C.ring}, ${C.shadowCard}`,
        transform: hover ? "translateY(-3px)" : "none",
        transition: "transform 180ms var(--ease-out), box-shadow 180ms var(--ease-out)",
      }}
    >
      <div style={{ background: e.tint, height: 130, display: "grid", placeItems: "center" }}>
        <EntitySketch k={e.key} />
      </div>
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2.5, background: e.color }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 17, color: C.ink, letterSpacing: "-0.01em" }}>{e.name}</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: "19px", color: C.muted, marginTop: 7 }}>{e.line}</div>
      </div>
    </div>
  );
}

function EntitySketch({ k }: { k: string }) {
  if (k === "doc")
    return (
      <div style={{ width: 84, height: 86, borderRadius: 7, background: C.white, boxShadow: C.shadowCard, padding: 11 }}>
        <div style={{ height: 6, width: "58%", borderRadius: 3, background: C.blue, opacity: 0.85 }} />
        {[92, 78, 86, 50].map((w, i) => (
          <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: "rgba(24,24,22,0.10)", marginTop: 7 }} />
        ))}
      </div>
    );
  if (k === "sheet")
    return (
      <div style={{ width: 96, height: 76, borderRadius: 7, background: C.white, boxShadow: C.shadowCard, overflow: "hidden" }}>
        <div style={{ height: 15, background: "rgba(66,195,102,0.20)", borderBottom: "1px solid rgba(24,24,22,0.07)" }} />
        {[0, 1, 2, 3].map((r) => (
          <div key={r} style={{ display: "flex", height: 15, borderBottom: r < 3 ? "1px solid rgba(24,24,22,0.05)" : "none" }}>
            {[0, 1, 2].map((c) => (
              <div key={c} style={{ flex: 1, borderRight: c < 2 ? "1px solid rgba(24,24,22,0.05)" : "none", display: "grid", placeItems: "center" }}>
                {r === 1 && c === 2 && <span style={{ width: "62%", height: 4, borderRadius: 2, background: "rgba(66,195,102,0.55)" }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  if (k === "deck")
    return (
      <div style={{ width: 104, height: 64, borderRadius: 7, background: "#23211E", boxShadow: C.shadowCard, padding: 11, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ height: 7, width: "56%", borderRadius: 3, background: C.amber }} />
        <div>
          <div style={{ height: 4, width: "88%", borderRadius: 2, background: "rgba(255,255,255,0.36)" }} />
          <div style={{ height: 4, width: "60%", borderRadius: 2, background: "rgba(255,255,255,0.22)", marginTop: 5 }} />
        </div>
      </div>
    );
  return (
    <div style={{ width: 96, height: 80, borderRadius: 7, background: C.white, boxShadow: C.shadowCard, overflow: "hidden" }}>
      <div style={{ height: 13, borderBottom: "1px solid rgba(24,24,22,0.07)", display: "flex", alignItems: "center", gap: 3, padding: "0 7px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 3.5, height: 3.5, borderRadius: 99, background: "rgba(24,24,22,0.18)" }} />
        ))}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ height: 5, width: "52%", borderRadius: 2, background: "rgba(24,24,22,0.16)" }} />
        <div style={{ height: 4, width: "78%", borderRadius: 2, background: "rgba(24,24,22,0.08)", marginTop: 6 }} />
        <div style={{ display: "inline-block", height: 10, width: 34, borderRadius: 99, background: C.purple, marginTop: 9 }} />
      </div>
    </div>
  );
}

/* ───────────── act 1: shared workspaces (board scene) ───────────── */

function ActMultiplayer() {
  return (
    <Section bg={C.alt}>
      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 64, alignItems: "center" }} className="mpTwoCol">
        <Reveal>
          <Eyebrow dot={C.teal} style={{ marginBottom: 18 }}>
            Shared workspaces
          </Eyebrow>
          <H2>
            You and Primy,
            <br />
            working in
            <br />
            <Accent c={C.tealText}>the same space</Accent>
          </H2>
          <Body style={{ marginTop: 20, maxWidth: 400 }}>
            Every client gets a workspace. You write, Primy drafts, teammates comment, and the AI works right where your
            files live.
          </Body>
          <Body style={{ marginTop: 12, maxWidth: 400 }}>
            No exporting, no pasting between tools. The conversation and the deliverable share one home.
          </Body>
          <div style={{ marginTop: 24 }}>
            <BtnSecondary href={SIGNUP}>
              Start a workspace
              <ArrowIcon size={12} />
            </BtnSecondary>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <BoardScene />
        </Reveal>
      </div>
    </Section>
  );
}

/* ───────────── act 2: drag in anything (diagram + sub-features) ───────────── */

function ActBringEverything() {
  return (
    <Section bg={C.white}>
      <Reveal>
        <div style={{ display: "flex", marginBottom: 18 }}>
          {[
            { c: "#E07A6A", g: "PDF" },
            { c: C.greenText, g: "XLS" },
            { c: C.blueText, g: "DOC" },
          ].map((f, i) => (
            <div
              key={f.g}
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: C.white,
                border: `1px solid ${C.border}`,
                boxShadow: C.shadowCard,
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 700,
                color: f.c,
                marginLeft: i ? -10 : 0,
              }}
            >
              {f.g}
            </div>
          ))}
        </div>
        <Eyebrow style={{ marginBottom: 18 }}>Bring everything in</Eyebrow>
        <H2>
          Drag in anything.
          <br />
          Ship something polished.
        </H2>
        <Body style={{ marginTop: 20, maxWidth: 560 }}>
          Drop notes, spreadsheets, briefs, and old decks straight into the chat. Primy reads them, remembers them per
          client, and turns them into the deliverable you ask for.
        </Body>
      </Reveal>

      <Reveal delay={120} style={{ marginTop: 72 }}>
        <FlowDiagram />
      </Reveal>

      <Reveal delay={80} style={{ marginTop: 88 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }} className="mpTwoCol">
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, color: C.ink, letterSpacing: "-0.015em" }}>
              Memory per client
            </div>
            <Body style={{ marginTop: 10, fontSize: 14.5, lineHeight: "22px" }}>
              Brand voice, numbers, and past work stay attached to each workspace. Ask for the next deliverable and it
              already knows the context.
            </Body>
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, color: C.ink, letterSpacing: "-0.015em" }}>
              Share with one link
            </div>
            <Body style={{ marginTop: 10, fontSize: 14.5, lineHeight: "22px" }}>
              Every doc, sheet, deck, and page gets a clean public link the moment it is ready to send.
            </Body>
            <div style={{ marginTop: 16 }}>
              <ShareLinkBlock />
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────── act 3: chat becomes the deliverable (split card) ───────────── */

function ActChatToDeliverable() {
  return (
    <Section bg={C.alt}>
      <div style={{ textAlign: "center" }}>
        <Reveal>
          <Eyebrow dot={C.purple} style={{ textAlign: "center", marginBottom: 18 }}>
            From chat to deliverable
          </Eyebrow>
          <H2>
            The chat becomes <Accent c={C.purpleText}>the deliverable</Accent>
          </H2>
          <Body style={{ maxWidth: 600, margin: "20px auto 0" }}>
            Describe the change in plain English and watch the page update next to it. Every edit lands styled, on brand,
            and ready to send.
          </Body>
        </Reveal>
      </div>
      <Reveal delay={120} style={{ marginTop: 64 }}>
        <SplitCard />
      </Reveal>
      <Reveal delay={80} style={{ marginTop: 72 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, maxWidth: 880, margin: "0 auto" }} className="mpTwoCol">
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, color: C.ink, letterSpacing: "-0.015em" }}>
              Every edit in plain English
            </div>
            <Body style={{ marginTop: 10, fontSize: 14.5, lineHeight: "22px" }}>
              Swap a chart, tighten a section, change the pricing. You describe it, the deliverable updates in place.
            </Body>
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, color: C.ink, letterSpacing: "-0.015em" }}>
              On brand by default
            </div>
            <Body style={{ marginTop: 10, fontSize: 14.5, lineHeight: "22px" }}>
              Colors, type, and tone come from the client workspace, so the third deliverable matches the first.
            </Body>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────── act 4: instant links (interactive page) ───────────── */

function ActInstantLinks() {
  return (
    <Section bg={C.white} innerStyle={{ scrollMarginTop: 70 }}>
      <div id="live-page" style={{ textAlign: "center", scrollMarginTop: 110 }}>
        <Reveal>
          <Eyebrow dot={C.blue} style={{ textAlign: "center", marginBottom: 18 }}>
            Instant links
          </Eyebrow>
          <H2>
            Send{" "}
            <span style={{ color: C.blueText, textDecorationLine: "underline", textDecorationThickness: 3, textUnderlineOffset: 7, textDecorationColor: "rgba(66,133,244,0.4)" }}>
              a link
            </span>
            , not an attachment
          </H2>
          <Body style={{ maxWidth: 620, margin: "20px auto 0" }}>
            Pages are Primy&apos;s signature deliverable: live, interactive, and viewable by anyone. This one is real, go
            ahead and click it.
          </Body>
        </Reveal>
      </div>
      <Reveal delay={140} style={{ marginTop: 72 }}>
        <LivePageCard />
      </Reveal>
    </Section>
  );
}

/* ───────────── pricing teaser (real plan data, links to /pricing) ───────────── */

function PricingTeaser() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  const rows = (items: string[]) =>
    items.map((t) => (
      <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, lineHeight: "20px", color: C.body }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden style={{ marginTop: 3, flexShrink: 0 }}>
          <path d="M3 8.5 6.5 12 13 4.5" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t}
      </li>
    ));
  return (
    <Section bg={C.alt}>
      <div style={{ textAlign: "center" }}>
        <Reveal>
          <Eyebrow style={{ textAlign: "center", marginBottom: 18 }}>Pricing</Eyebrow>
          <H2>
            Free forever. <Accent c={C.greenText}>Upgrade when you grow.</Accent>
          </H2>
          <Body style={{ maxWidth: 520, margin: "20px auto 0" }}>
            Start with one workspace. Unlock everything when client work picks up.
          </Body>
        </Reveal>
      </div>
      <Reveal delay={100} style={{ marginTop: 56 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 760, margin: "0 auto" }} className="mpTwoCol">
          {/* Free */}
          <div style={{ background: C.white, borderRadius: 16, boxShadow: `${C.ring}, ${C.shadowCard}`, padding: "26px 26px 24px", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 18, color: C.ink }}>Free</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                $0<span style={{ fontSize: 13, color: C.faint, fontFamily: BODY }}>/mo</span>
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>For trying out the studio.</div>
            <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {rows([
                `${free.workspaces} workspace`,
                `${free.aiMessagesPerMonth} AI messages / mo`,
                `${free.fileUploadsPerMonth} file uploads / mo`,
                `${Math.round(free.storageBytes / (1024 * 1024))} MB storage`,
              ])}
            </ul>
            <div style={{ marginTop: 22 }}>
              <BtnSecondary href={SIGNUP} style={{ width: "100%", justifyContent: "center" }}>
                Start free
              </BtnSecondary>
            </div>
          </div>
          {/* Pro */}
          <div style={{ position: "relative", background: C.white, borderRadius: 16, boxShadow: `0 0 0 1.5px ${C.ink}, 0 14px 34px rgba(24,24,22,0.10)`, padding: "26px 26px 24px", textAlign: "left" }}>
            <span
              style={{
                position: "absolute",
                top: -10,
                left: 26,
                background: C.inkBtn,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderRadius: 99,
                padding: "3.5px 10px",
              }}
            >
              Most popular
            </span>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 18, color: C.ink }}>Pro</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                ${PRO_PRICE_USD}
                <span style={{ fontSize: 13, color: C.faint, fontFamily: BODY }}>/mo</span>
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>For shipping real client work.</div>
            <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {rows([
                "Unlimited workspaces",
                `${pro.aiMessagesPerMonth.toLocaleString()} AI messages / mo`,
                "Unlimited file uploads",
                `${Math.round(pro.storageBytes / (1024 * 1024 * 1024))} GB storage`,
                "Brand voice + visual profiles",
              ])}
            </ul>
            <div style={{ marginTop: 22 }}>
              <BtnPrimary href={SIGNUP} style={{ width: "100%", justifyContent: "center" }}>
                Start free
              </BtnPrimary>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: C.blueText, textDecoration: "none" }}>
            See full pricing
            <ArrowIcon size={12} />
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}

/* ───────────── final CTA ───────────── */

function FinalCta() {
  return (
    <Section bg={C.white}>
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <Reveal>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#1A1815",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 26px",
              boxShadow: "0 14px 34px rgba(24,24,22,0.2)",
            }}
          >
            <LogoMark size={26} style={{ color: "#fff" }} />
          </div>
          <Eyebrow style={{ textAlign: "center", marginBottom: 18 }}>The end of copy-paste</Eyebrow>
          <H1 style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
            Never copy-paste from
            <br />
            ChatGPT again
          </H1>
          <Body style={{ maxWidth: 560, margin: "20px auto 0" }}>
            One workspace per client. One chat that ships the work. Start free and send your first deliverable today.
          </Body>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            <BtnPrimary href={SIGNUP}>
              Start creating free
              <ArrowIcon size={12} />
            </BtnPrimary>
            <BtnSecondary href={CONTACT}>Talk to us</BtnSecondary>
          </div>
          <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 30, flexWrap: "wrap" }}>
            {ENTITY.map((e) => (
              <span key={e.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: C.muted }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: e.color }} />
                {e.name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ───────────── footer (real destinations only) ───────────── */

function Footer() {
  const cols: [string, { label: string; href: string }[]][] = [
    [
      "Product",
      [
        { label: "Pricing", href: "/pricing" },
        { label: "Start free", href: SIGNUP },
        { label: "Sign in", href: "/login" },
      ],
    ],
    [
      "Legal",
      [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    ],
    [
      "Contact",
      [{ label: "Email us", href: CONTACT }],
    ],
  ];
  return (
    <footer style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "64px 24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 48, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: "#1A1815", display: "grid", placeItems: "center" }}>
                <LogoMark size={13} style={{ color: "#fff" }} />
              </div>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, letterSpacing: "-0.02em", color: C.ink }}>Primy</span>
            </div>
            <Body style={{ marginTop: 14, fontSize: 13.5, lineHeight: "21px", color: C.muted }}>
              The AI studio where independents create and ship client work.
            </Body>
          </div>
          <div style={{ display: "flex", gap: 72, flexWrap: "wrap" }}>
            {cols.map(([title, links]) => (
              <div key={title}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 14 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {links.map((l) =>
                    l.href.startsWith("/") ? (
                      <Link key={l.label} href={l.href} style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>
                        {l.label}
                      </Link>
                    ) : (
                      <a key={l.label} href={l.href} style={{ fontSize: 13, color: C.muted, textDecoration: "none" }}>
                        {l.label}
                      </a>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 48, paddingTop: 20, fontSize: 12, color: C.faint }}>
          © 2026 Primy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ───────────── keyframes (transform/opacity only, reduced-motion guarded) ───────────── */

function GlobalKeyframes() {
  return (
    <style>{`
      .mpMarquee { animation: mpScroll 60s linear infinite; }
      @keyframes mpScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

      .mpCaret {
        display: inline-block; width: 1.5px; height: 13px; margin-left: 2px;
        background: #171716; vertical-align: -2px;
        animation: mpBlink 0.9s steps(2, start) infinite;
      }
      @keyframes mpBlink { to { opacity: 0; } }

      .mpDot {
        width: 5px; height: 5px; border-radius: 99px; background: #B87426;
        display: inline-block; animation: mpBob 0.9s ease-in-out infinite;
      }
      @keyframes mpBob { 0%, 100% { transform: translateY(0); opacity: .45; } 50% { transform: translateY(-3px); opacity: 1; } }

      .mpHalo {
        position: absolute; left: -7px; top: -7px; width: 28px; height: 28px;
        border: 1.5px solid; border-radius: 99px; opacity: .5;
        animation: mpPulse 2s ease-in-out infinite;
      }
      @keyframes mpPulse { 0%, 100% { transform: scale(0.8); opacity: .55; } 50% { transform: scale(1.15); opacity: .15; } }

      .mpTravelDot { animation: mpTravel 3.2s ease-in-out infinite; offset-rotate: 0deg; }
      @keyframes mpTravel {
        0% { offset-distance: 0%; opacity: 0; }
        12% { opacity: 1; }
        82% { opacity: 1; }
        100% { offset-distance: 100%; opacity: 0; }
      }

      @keyframes mpDriftA { 0%, 100% { transform: translate(0, 0); } 30% { transform: translate(26px, -18px); } 65% { transform: translate(-14px, 14px); } }
      @keyframes mpDriftB { 0%, 100% { transform: translate(0, 0); } 35% { transform: translate(-22px, -12px); } 70% { transform: translate(18px, 10px); } }
      @keyframes mpDriftC { 0%, 100% { transform: translate(0, 0); } 40% { transform: translate(30px, 16px); } 75% { transform: translate(-20px, -10px); } }

      @media (max-width: 860px) {
        .mpTwoCol { grid-template-columns: 1fr !important; }
        .mpFourCol { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 560px) {
        .mpNavLink { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .mpMarquee, .mpCaret, .mpDot, .mpHalo, .mpTravelDot { animation: none !important; }
        [style*="mpDrift"] { animation: none !important; }
      }
    `}</style>
  );
}
