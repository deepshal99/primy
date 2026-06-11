"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/shared/Logo";
import { C, BODY, DISPLAY } from "./theme";

/* ─────────────────────────────────────────────────────────────
   Self-driving Primy demo: the hero IS the product.
   Loop: prompt types itself → thinking → doc artifact pops →
   page artifact pops → cursors drift → hold → reset.
   Pure DOM + transform/opacity animation. No assets.
   ───────────────────────────────────────────────────────────── */

const PROMPT = "Turn my notes into a proposal and a one-pager for Acme";

type Phase = "idle" | "typing" | "thinking" | "doc" | "page" | "hold";

export function HeroDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars, setChars] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setPhase("hold");
      setChars(PROMPT.length);
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));

    async function loop() {
      while (alive) {
        setPhase("idle");
        setChars(0);
        await wait(900);
        setPhase("typing");
        for (let i = 1; i <= PROMPT.length; i++) {
          if (!alive) return;
          setChars(i);
          await wait(34);
        }
        await wait(450);
        setPhase("thinking");
        await wait(1700);
        setPhase("doc");
        await wait(1400);
        setPhase("page");
        await wait(1200);
        setPhase("hold");
        await wait(5200);
      }
    }
    loop();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  const docIn = phase === "doc" || phase === "page" || phase === "hold";
  const pageIn = phase === "page" || phase === "hold";
  const cursorsIn = pageIn;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 1138,
        margin: "0 auto",
        borderRadius: 16,
        background: C.white,
        boxShadow: `${C.ring}, ${C.shadowDemo}`,
        overflow: "hidden",
        aspectRatio: "1138 / 700",
        textAlign: "left",
        userSelect: "none",
      }}
      aria-label="Primy product demo"
    >
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {/* sidebar */}
        <div
          style={{
            width: "19%",
            minWidth: 168,
            background: C.sidebar,
            borderRight: `1px solid ${C.border}`,
            padding: "14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontFamily: BODY,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 14px" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "#1A1815", display: "grid", placeItems: "center" }}>
              <LogoMark size={12} style={{ color: "#fff" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Primy</span>
          </div>
          {["Quick Note", "Library", "Search"].map((it) => (
            <div key={it} style={{ fontSize: 12, color: C.body, padding: "6px 8px", borderRadius: 6 }}>
              {it}
            </div>
          ))}
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: C.faint, textTransform: "uppercase", padding: "14px 8px 6px" }}>
            Workspaces
          </div>
          {[
            { n: "Acme Co", d: C.amber, active: true },
            { n: "Brightline", d: C.blue },
            { n: "Fieldnote", d: C.purple },
            { n: "Personal", d: C.green },
          ].map((w) => (
            <div
              key={w.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: w.active ? C.ink : C.body,
                fontWeight: w.active ? 600 : 400,
                padding: "6px 8px",
                borderRadius: 6,
                background: w.active ? "#FFFFFF" : "transparent",
                boxShadow: w.active ? C.shadowCard : "none",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 99, background: w.d }} />
              {w.n}
            </div>
          ))}
        </div>

        {/* canvas */}
        <div style={{ flex: 1, position: "relative", background: C.alt }}>
          {/* top bar */}
          <div
            style={{
              height: 44,
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              background: C.white,
              fontFamily: BODY,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Acme Co</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex" }}>
                {["#F073A7", "#4285F4"].map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 99,
                      background: c,
                      border: "2px solid #fff",
                      marginLeft: i ? -6 : 0,
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontSize: 8.5,
                      fontWeight: 700,
                    }}
                  >
                    {i === 0 ? "M" : "D"}
                  </div>
                ))}
              </div>
              <div
                style={{
                  height: 24,
                  padding: "0 10px",
                  borderRadius: 6,
                  background: C.inkBtn,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                Share
              </div>
            </div>
          </div>

          {/* board area */}
          <div style={{ position: "absolute", inset: "44px 0 0 0", padding: 22 }}>
            {/* uploaded source files (always present) */}
            <div style={{ display: "flex", gap: 8, fontFamily: BODY }}>
              {[
                { n: "kickoff-notes.pdf", c: "#E07A6A" },
                { n: "budget.xlsx", c: C.green },
                { n: "scope.docx", c: C.blue },
              ].map((f) => (
                <div
                  key={f.n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: "5px 9px",
                    fontSize: 11,
                    color: C.body,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: f.c }} />
                  {f.n}
                </div>
              ))}
            </div>

            {/* artifact: proposal doc */}
            <ArtifactCard
              show={docIn}
              style={{ position: "absolute", left: 24, top: 64, width: "37%" }}
              dot={C.blue}
              label="Acme proposal"
              kind="Doc"
            >
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 15, color: C.ink, letterSpacing: "-0.01em" }}>
                  Acme growth proposal
                </div>
                {[100, 92, 96, 60].map((w, i) => (
                  <div key={i} style={{ height: 6, width: `${w}%`, borderRadius: 3, background: "rgba(24,24,22,0.08)", marginTop: i === 0 ? 10 : 7 }} />
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {[C.blue, C.green, C.amber].map((c) => (
                    <div key={c} style={{ flex: 1, height: 34, borderRadius: 6, background: c, opacity: 0.16 }} />
                  ))}
                </div>
                {[88, 95].map((w, i) => (
                  <div key={i} style={{ height: 6, width: `${w}%`, borderRadius: 3, background: "rgba(24,24,22,0.08)", marginTop: 7 }} />
                ))}
              </div>
            </ArtifactCard>

            {/* artifact: one-pager (page = hero artifact) */}
            <ArtifactCard
              show={pageIn}
              style={{ position: "absolute", left: "44%", top: 96, width: "40%" }}
              dot={C.purple}
              label="Acme one-pager"
              kind="Page"
            >
              <div style={{ background: C.white, padding: "14px 16px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 16, color: C.ink, letterSpacing: "-0.015em" }}>
                  Acme, meet your next quarter
                </div>
                <div style={{ height: 5, width: "62%", borderRadius: 3, background: "rgba(24,24,22,0.10)", marginTop: 8 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end", height: 44 }}>
                  {[18, 30, 24, 40, 34, 44].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: h, borderRadius: "3px 3px 0 0", background: i === 5 ? C.purple : "rgba(24,24,22,0.10)" }} />
                  ))}
                </div>
                <div style={{ display: "inline-block", marginTop: 12, padding: "5px 10px", borderRadius: 99, background: C.purple, color: "#fff", fontSize: 10, fontWeight: 600, fontFamily: BODY }}>
                  Book a call
                </div>
              </div>
            </ArtifactCard>

            {/* cursors */}
            <Cursor show={cursorsIn} name="Primy" color={C.amberDeep} agent style={{ left: "58%", top: "30%" }} drift="mpDriftA" />
            <Cursor show={cursorsIn} name="You" color={C.blue} style={{ left: "26%", top: "58%" }} drift="mpDriftB" />

            {/* chat input */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 18,
                transform: "translateX(-50%)",
                width: "min(560px, 86%)",
                background: C.white,
                border: `1px solid ${C.borderStrong}`,
                borderRadius: 12,
                boxShadow: C.shadowCard,
                padding: "11px 13px",
                fontFamily: BODY,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: "#1A1815", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <LogoMark size={10} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: chars ? C.ink : C.faint, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {chars ? PROMPT.slice(0, chars) : "Ask Primy to create anything"}
                  {phase === "typing" && <span className="mpCaret" />}
                </div>
                {phase === "thinking" ? (
                  <div style={{ display: "flex", gap: 3, paddingRight: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="mpDot" style={{ animationDelay: `${i * 160}ms` }} />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: chars === PROMPT.length ? C.amberDeep : "rgba(24,24,22,0.08)",
                      display: "grid",
                      placeItems: "center",
                      transition: "background 200ms ease",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 13V3M3.8 7.2 8 3l4.2 4.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({
  show,
  style,
  dot,
  label,
  kind,
  children,
}: {
  show: boolean;
  style: React.CSSProperties;
  dot: string;
  label: string;
  kind: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...style,
        background: C.white,
        borderRadius: 10,
        boxShadow: `${C.ring}, 0 14px 36px rgba(58,42,18,0.12)`,
        overflow: "hidden",
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(14px) scale(0.97)",
        transition: "opacity 420ms var(--ease-out), transform 420ms var(--ease-out)",
        fontFamily: BODY,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 12px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: C.ink }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: dot }} />
          {label}
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{kind}</span>
      </div>
      {children}
    </div>
  );
}

function Cursor({
  show,
  name,
  color,
  agent,
  style,
  drift,
}: {
  show: boolean;
  name: string;
  color: string;
  agent?: boolean;
  style: React.CSSProperties;
  drift: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        ...style,
        opacity: show ? 1 : 0,
        transition: "opacity 500ms ease",
        animation: `${drift} 9s ease-in-out infinite`,
        pointerEvents: "none",
      }}
    >
      {agent && <span className="mpHalo" style={{ borderColor: color }} />}
      <svg width="15" height="15" viewBox="0 0 24 24" fill={color} aria-hidden style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.18))" }}>
        <path d="M5 3l14 7.5-6.2 1.6L9.5 18 5 3z" />
      </svg>
      <span
        style={{
          position: "absolute",
          left: 13,
          top: 13,
          background: color,
          color: "#fff",
          fontSize: 10,
          fontWeight: 600,
          fontFamily: BODY,
          padding: "2.5px 7px",
          borderRadius: 99,
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
}
