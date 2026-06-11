"use client";

import { useState } from "react";
import { C, BODY, DISPLAY } from "./theme";

/* ───────────── Act 4: genuinely interactive shared page in browser chrome ─────────────
   The page artifact is white Primy paper: ink type, blue for everything
   interactive (it is a live page, links are blue). */

const TABS = ["Overview", "Scope", "Pricing"] as const;
type Tab = (typeof TABS)[number];

export function LivePageCard() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [hoverBar, setHoverBar] = useState<number | null>(null);

  return (
    <div style={{ position: "relative", maxWidth: 980, margin: "0 auto" }}>
      {/* floating tooltip pill */}
      <div
        style={{
          position: "absolute",
          top: -16,
          left: 26,
          zIndex: 2,
          background: "#1A1815",
          color: "#FAFAFA",
          fontFamily: BODY,
          fontSize: 12,
          fontWeight: 500,
          padding: "7px 13px",
          borderRadius: 99,
          boxShadow: "0 10px 26px rgba(24,24,22,0.28)",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 99, background: C.green }} />
        Live page. Try clicking around
      </div>

      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: C.white,
          boxShadow: `${C.ring}, ${C.shadowDemo}`,
          fontFamily: BODY,
        }}
      >
        {/* browser chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 42,
            padding: "0 14px",
            borderBottom: `1px solid ${C.border}`,
            background: C.alt,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {["#E0857B", "#E8C57B", "#9BC78F"].map((c) => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: 99, background: c }} />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              maxWidth: 380,
              margin: "0 auto",
              height: 24,
              borderRadius: 99,
              background: C.white,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              color: C.muted,
            }}
          >
            primy.app/<span style={{ color: C.blueText, fontWeight: 600 }}>share</span>/acme-onepager
          </div>
          <div style={{ width: 46 }} />
        </div>

        {/* the page itself */}
        <div style={{ background: C.white, padding: "38px 44px 44px", minHeight: 430 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, letterSpacing: "-0.02em", color: C.ink }}>
              Acme x Studio North
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    height: 30,
                    padding: "0 13px",
                    borderRadius: 99,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: BODY,
                    fontSize: 12,
                    fontWeight: 600,
                    background: tab === t ? C.blue : "rgba(24,24,22,0.05)",
                    color: tab === t ? "#fff" : C.ink,
                    transition: "background 140ms ease, color 140ms ease",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tab === "Overview" && (
            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 14, lineHeight: "22px", color: C.body, maxWidth: 380 }}>
                  A 90-day plan to lift qualified pipeline without growing headcount. Built from your notes, your numbers, and your brand.
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  {[
                    { k: "Pipeline lift", v: "+38%", c: C.greenText },
                    { k: "Time to launch", v: "3 wks", c: C.ink },
                    { k: "Channels", v: "4", c: C.ink },
                  ].map((s) => (
                    <div key={s.k} style={{ background: C.alt, borderRadius: 10, padding: "14px 16px", minWidth: 104 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 22, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: C.alt, borderRadius: 12, padding: "18px 18px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Projected pipeline
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120, marginTop: 14 }}>
                  {[34, 48, 42, 64, 58, 84].map((h, i) => (
                    <div key={i} style={{ flex: 1, position: "relative" }} onMouseEnter={() => setHoverBar(i)} onMouseLeave={() => setHoverBar(null)}>
                      {hoverBar === i && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: h + 8,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#1A1815",
                            color: "#FAFAFA",
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "3px 7px",
                            borderRadius: 6,
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ${h * 4}k
                        </div>
                      )}
                      <div
                        style={{
                          height: h,
                          borderRadius: "3px 3px 0 0",
                          background: i === 5 ? C.blue : "rgba(24,24,22,0.10)",
                          transition: "background 140ms ease",
                          ...(hoverBar === i ? { background: i === 5 ? C.blueText : "rgba(24,24,22,0.22)" } : null),
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9.5, color: C.faint }}>
                  {["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "Scope" && (
            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 720 }}>
              {[
                ["Positioning sprint", "Week 1. Narrative, offer, proof."],
                ["Site and one-pager", "Week 2. Pages shipped from this workspace."],
                ["Outbound engine", "Weeks 3 to 6. Sequences plus the tracking sheet."],
                ["Reporting", "Ongoing. A live deck your team can open anytime."],
              ].map(([t, d]) => (
                <div key={t} style={{ background: C.alt, borderRadius: 10, padding: "15px 16px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{t}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: "18px" }}>{d}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "Pricing" && (
            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 720 }}>
              {[
                ["Starter", "$2,400", "Positioning + one-pager"],
                ["Growth", "$5,200", "Everything in Starter + outbound"],
                ["Scale", "$9,000", "Full engine + weekly reporting"],
              ].map(([t, p, d], i) => (
                <div
                  key={t}
                  style={{
                    background: i === 1 ? C.inkBtn : C.alt,
                    color: i === 1 ? "#FAFAFA" : C.ink,
                    borderRadius: 12,
                    padding: "18px 16px",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{p}</div>
                  <div style={{ fontSize: 11.5, marginTop: 8, opacity: 0.72, lineHeight: "17px" }}>{d}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
