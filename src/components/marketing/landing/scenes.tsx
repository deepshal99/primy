"use client";

import { useState } from "react";
import { LogoMark } from "@/components/shared/Logo";
import { C, BODY, DISPLAY } from "./theme";

/* ───────────── Act 1: the project board, worked on live ─────────────
   Not an abstract cursor panel: a real Primy board (columns of entity
   cards) with human + agent cursors drifting over it. */

const BOARD: { col: string; cards: { t: string; k: string; c: string }[] }[] = [
  {
    col: "Drafts",
    cards: [
      { t: "Kickoff notes", k: "Doc", c: C.blue },
      { t: "Scope outline", k: "Doc", c: C.blue },
    ],
  },
  {
    col: "In progress",
    cards: [
      { t: "Pricing model", k: "Sheet", c: C.green },
      { t: "Pitch deck", k: "Deck", c: C.amber },
    ],
  },
  {
    col: "Ready to send",
    cards: [{ t: "Acme one-pager", k: "Page", c: C.purple }],
  },
];

export function BoardScene() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 420,
        borderRadius: 16,
        background: C.white,
        boxShadow: `${C.ring}, ${C.shadowCard}`,
        overflow: "hidden",
        fontFamily: BODY,
      }}
      aria-hidden
    >
      {/* board header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: C.teal }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>Brightline</span>
        <span style={{ fontSize: 11, color: C.faint }}>Shared workspace</span>
        <div style={{ marginLeft: "auto", display: "flex" }}>
          {[
            { c: C.pink, t: "M" },
            { c: C.blue, t: "D" },
          ].map((a, i) => (
            <span
              key={a.t}
              style={{
                width: 20,
                height: 20,
                borderRadius: 99,
                background: a.c,
                border: "2px solid #fff",
                marginLeft: i ? -6 : 0,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 8.5,
                fontWeight: 700,
              }}
            >
              {a.t}
            </span>
          ))}
        </div>
      </div>

      {/* columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, padding: 18, background: C.alt, position: "absolute", inset: "49px 0 0 0" }}>
        {BOARD.map((col) => (
          <div key={col.col}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, padding: "2px 4px 10px" }}>
              {col.col}
              <span style={{ color: C.faint, marginLeft: 6 }}>{col.cards.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.cards.map((card) => (
                <div key={card.t} style={{ background: C.white, borderRadius: 10, boxShadow: C.shadowCard, padding: "11px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: C.ink }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: card.c }} />
                    {card.t}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{card.k}</span>
                    <span style={{ height: 4, width: 46, borderRadius: 2, background: "rgba(24,24,22,0.07)" }} />
                  </div>
                </div>
              ))}
              {/* the card Primy is writing right now */}
              {col.col === "In progress" && (
                <div style={{ background: C.white, borderRadius: 10, boxShadow: C.shadowCard, padding: "11px 12px", border: `1px solid ${C.amberTint}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: C.ink }}>
                    <LogoMark size={11} style={{ color: C.amberDeep }} />
                    Q3 review deck
                    <span className="mpDot" style={{ marginLeft: "auto" }} />
                  </div>
                  <div style={{ height: 4, width: "72%", borderRadius: 2, background: C.amberTint, marginTop: 10 }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <SceneCursor name="You" color={C.blue} avatar="D" left="24%" top="38%" drift="mpDriftA" />
      <SceneCursor name="Maya" color={C.pink} avatar="M" left="66%" top="64%" drift="mpDriftB" />
      <SceneCursor name="Primy" color={C.amberDeep} agent left="48%" top="50%" drift="mpDriftC" />
    </div>
  );
}

function SceneCursor({
  name,
  color,
  avatar,
  agent,
  left,
  top,
  drift,
}: {
  name: string;
  color: string;
  avatar?: string;
  agent?: boolean;
  left: string;
  top: string;
  drift: string;
}) {
  return (
    <div style={{ position: "absolute", left, top, animation: `${drift} 10s ease-in-out infinite`, pointerEvents: "none" }}>
      {agent && <span className="mpHalo" style={{ borderColor: color }} />}
      <svg width="17" height="17" viewBox="0 0 24 24" fill={color} aria-hidden style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.18))" }}>
        <path d="M5 3l14 7.5-6.2 1.6L9.5 18 5 3z" />
      </svg>
      <span
        style={{
          position: "absolute",
          left: 14,
          top: 15,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: color,
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: BODY,
          padding: "3px 8px",
          borderRadius: 99,
          whiteSpace: "nowrap",
        }}
      >
        {avatar ? (
          <span style={{ width: 13, height: 13, borderRadius: 99, background: "rgba(255,255,255,0.3)", display: "grid", placeItems: "center", fontSize: 8 }}>
            {avatar}
          </span>
        ) : (
          <LogoMark size={10} style={{ color: "#fff" }} />
        )}
        {name}
      </span>
    </div>
  );
}

/* ───────────── Act 2: connector diagram (files → Primy → mini artifacts) ───────────── */

/* tiny artifact previews instead of labeled pills: the outputs LOOK like the product */
function MiniDoc() {
  return (
    <div style={{ width: 64, height: 44, borderRadius: 6, background: C.white, border: `1px solid ${C.border}`, padding: 7 }}>
      <div style={{ height: 5, width: "55%", borderRadius: 2, background: C.blue, opacity: 0.85 }} />
      {[90, 75, 84].map((w, i) => (
        <div key={i} style={{ height: 3, width: `${w}%`, borderRadius: 2, background: "rgba(24,24,22,0.10)", marginTop: 4.5 }} />
      ))}
    </div>
  );
}
function MiniSheet() {
  return (
    <div style={{ width: 64, height: 44, borderRadius: 6, background: C.white, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ height: 9, background: "rgba(66,195,102,0.18)", borderBottom: `1px solid ${C.border}` }} />
      {[0, 1, 2].map((r) => (
        <div key={r} style={{ display: "flex", height: 9, borderBottom: r < 2 ? `1px solid rgba(24,24,22,0.05)` : "none" }}>
          {[0, 1, 2].map((c) => (
            <div key={c} style={{ flex: 1, borderRight: c < 2 ? `1px solid rgba(24,24,22,0.05)` : "none" }} />
          ))}
        </div>
      ))}
    </div>
  );
}
function MiniDeck() {
  return (
    <div style={{ width: 64, height: 44, borderRadius: 6, background: "#23211E", padding: 8, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ height: 5, width: "62%", borderRadius: 2, background: C.amber }} />
      <div>
        <div style={{ height: 3, width: "85%", borderRadius: 2, background: "rgba(255,255,255,0.34)" }} />
        <div style={{ height: 3, width: "60%", borderRadius: 2, background: "rgba(255,255,255,0.22)", marginTop: 4 }} />
      </div>
    </div>
  );
}
function MiniPage() {
  return (
    <div style={{ width: 64, height: 44, borderRadius: 6, background: C.white, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ height: 8, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 2, padding: "0 4px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 2.5, height: 2.5, borderRadius: 99, background: "rgba(24,24,22,0.18)" }} />
        ))}
      </div>
      <div style={{ padding: 6 }}>
        <div style={{ height: 4, width: "52%", borderRadius: 2, background: "rgba(24,24,22,0.16)" }} />
        <div style={{ display: "inline-block", height: 6, width: 22, borderRadius: 99, background: C.purple, marginTop: 5 }} />
      </div>
    </div>
  );
}

export function FlowDiagram() {
  const files = [
    { n: "kickoff-notes.pdf", c: "#E07A6A" },
    { n: "budget.xlsx", c: C.green },
    { n: "scope.docx", c: C.blue },
    { n: "brand-deck.pdf", c: C.purple },
  ];
  const outs = [
    { n: "Proposal", k: "Doc", c: C.blue, mini: <MiniDoc /> },
    { n: "Pricing model", k: "Sheet", c: C.green, mini: <MiniSheet /> },
    { n: "Pitch deck", k: "Deck", c: C.amber, mini: <MiniDeck /> },
    { n: "One-pager", k: "Page", c: C.purple, mini: <MiniPage /> },
  ];
  return (
    <div style={{ position: "relative", width: "100%", fontFamily: BODY }}>
      <div className="mpFlowGrid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1.2fr", alignItems: "center", gap: 0 }}>
        {/* left: source files */}
        <div className="mpFlowFiles" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
          {files.map((f) => (
            <div
              key={f.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 9,
                padding: "9px 13px",
                fontSize: 12.5,
                color: C.body,
                boxShadow: C.shadowCard,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2.5, background: f.c }} />
              {f.n}
            </div>
          ))}
        </div>

        {/* center: connectors + Primy node */}
        <div className="mpFlowCenter" style={{ position: "relative", width: 300, height: 280, margin: "0 8px" }}>
          <svg width="300" height="280" viewBox="0 0 300 280" fill="none" style={{ position: "absolute", inset: 0 }} aria-hidden>
            {[44, 108, 172, 236].map((y) => (
              <path key={`l${y}`} d={`M0 ${y} C 60 ${y}, 80 140, 128 140`} stroke="rgba(24,24,22,0.14)" strokeWidth="1.25" />
            ))}
            {[44, 108, 172, 236].map((y) => (
              <path key={`r${y}`} d={`M172 140 C 220 140, 240 ${y}, 300 ${y}`} stroke="rgba(24,24,22,0.14)" strokeWidth="1.25" />
            ))}
            {/* traveling sparks, one per output, staggered */}
            {[
              { y: 44, c: C.blue, d: "0s" },
              { y: 108, c: C.green, d: "0.7s" },
              { y: 172, c: C.amber, d: "1.4s" },
              { y: 236, c: C.purple, d: "2.1s" },
            ].map((s) => (
              <circle key={s.y} r="2.4" fill={s.c} className="mpTravelDot" style={{ animationDelay: s.d, offsetPath: `path('M172 140 C 220 140, 240 ${s.y}, 300 ${s.y}')` }} />
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1A1815",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 14px 34px rgba(24,24,22,0.22)",
            }}
          >
            <LogoMark size={30} style={{ color: "#fff" }} />
          </div>
        </div>

        {/* right: deliverables as mini artifacts */}
        <div className="mpFlowOuts" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          {outs.map((o) => (
            <div
              key={o.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 7,
                paddingRight: 16,
                boxShadow: C.shadowCard,
              }}
            >
              {o.mini}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{o.n}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: o.c }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{o.k}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* memory rail under the node (amber = the AI signal) */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: C.amberTint,
            borderRadius: 99,
            padding: "8px 15px",
            fontSize: 12,
            fontWeight: 500,
            color: C.amberDeep,
          }}
        >
          <LogoMark size={11} style={{ color: C.amberDeep }} />
          Per-client memory keeps every deliverable connected
        </div>
      </div>
    </div>
  );
}

/* copyable share-link block: links are blue, so this block is blue */
export function ShareLinkBlock() {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: C.blueTint,
        border: `1px solid ${C.blueBorder}`,
        borderRadius: 12,
        padding: "12px 14px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12.5,
        color: C.body,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        primy.app/<span style={{ color: C.blueText, fontWeight: 600 }}>share</span>/acme-proposal
      </span>
      <button
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        style={{ border: "none", background: "transparent", cursor: "pointer", color: copied ? C.blueText : C.muted, display: "grid", placeItems: "center", padding: 2 }}
        aria-label="Copy link"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ───────────── Act 3: split card (chat ↔ rendered deliverable) ───────────── */

export function SplitCard() {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: `${C.ring}, 0 24px 60px rgba(24,24,22,0.10)`,
        background: C.white,
        minHeight: 420,
        fontFamily: BODY,
      }}
    >
      {/* left: the chat */}
      <div style={{ padding: "26px 28px", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 14, background: C.alt }}>
        <ChatBubble who="you" text="Make the pricing section three tiers and add a guarantee under it" />
        <ChatBubble who="primy" text="Done. Three tiers with the middle one highlighted, plus a 30-day guarantee note." />
        <ChatBubble who="you" text="Swap the hero photo for the chart from budget.xlsx" />
        <ChatBubble who="primy" text="Updated. The Q3 chart is in the hero now, styled to match the page." />
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, background: C.white, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "9px 12px", color: C.faint, fontSize: 12.5 }}>
          <LogoMark size={11} style={{ color: C.faint }} />
          Describe the next change
        </div>
      </div>

      {/* right: the page it renders (white Primy paper, purple = page identity) */}
      <div style={{ background: C.white, padding: "26px 28px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: C.purple }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Page</span>
          <span style={{ fontSize: 11, color: C.faint }}>acme-one-pager</span>
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 20, color: C.ink, letterSpacing: "-0.015em" }}>Acme growth plan</div>
        <div style={{ display: "flex", gap: 7, alignItems: "flex-end", height: 64, marginTop: 14 }}>
          {[22, 36, 30, 48, 40, 58, 52].map((h, i) => (
            <div key={i} style={{ flex: 1, height: h, borderRadius: "3px 3px 0 0", background: i === 5 ? C.purple : "rgba(24,24,22,0.08)" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginTop: 18 }}>
          {["Starter", "Growth", "Scale"].map((t, i) => (
            <div
              key={t}
              style={{
                borderRadius: 8,
                background: i === 1 ? C.inkBtn : C.alt,
                color: i === 1 ? "#FAFAFA" : C.ink,
                padding: "12px 10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>{t}</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 17, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{["$2k", "$5k", "$9k"][i]}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center" }}>30-day satisfaction guarantee</div>
      </div>

      {/* seam badge */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 44,
          height: 44,
          borderRadius: 99,
          background: C.inkBtn,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 22px rgba(24,24,22,0.3)",
        }}
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 8h10M14 4.5 17.5 8 14 11.5M17 16H7M10 12.5 6.5 16l3.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function ChatBubble({ who, text }: { who: "you" | "primy"; text: string }) {
  const isYou = who === "you";
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", flexDirection: isYou ? "row-reverse" : "row" }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          flexShrink: 0,
          background: isYou ? C.blue : "#1A1815",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        {isYou ? "D" : <LogoMark size={11} style={{ color: "#fff" }} />}
      </div>
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "9px 12px",
          fontSize: 12.5,
          lineHeight: "18px",
          color: C.body,
          maxWidth: "82%",
        }}
      >
        {text}
      </div>
    </div>
  );
}
