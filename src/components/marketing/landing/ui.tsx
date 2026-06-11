"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { C, DISPLAY, BODY, MAXW } from "./theme";

/* ───────────── shared primitives (magicpath language) ───────────── */

export function Eyebrow({ children, dot, style }: { children: React.ReactNode; dot?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: BODY,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.muted,
        display: "flex",
        alignItems: "center",
        gap: 7,
        justifyContent: style?.textAlign === "center" ? "center" : undefined,
        ...style,
      }}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: dot, flexShrink: 0 }} />}
      {children}
    </div>
  );
}

/* H1: 64/1.0, −3.2% tracking. H2: 48/1.0, −2.5%. One phrase in accent. */
export function H1({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h1
      style={{
        fontFamily: DISPLAY,
        fontWeight: 500,
        fontSize: "clamp(40px, 6vw, 64px)",
        lineHeight: 1.0,
        letterSpacing: "-0.032em",
        color: C.ink,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function H2({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      style={{
        fontFamily: DISPLAY,
        fontWeight: 500,
        fontSize: "clamp(32px, 4.4vw, 48px)",
        lineHeight: 1.02,
        letterSpacing: "-0.025em",
        color: C.ink,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/* one colored phrase per headline; the color is contextual to the section */
export function Accent({ c = C.blueText, children }: { c?: string; children: React.ReactNode }) {
  return <span style={{ color: c }}>{children}</span>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontFamily: BODY,
        fontSize: 16,
        lineHeight: "24px",
        fontWeight: 400,
        color: C.body,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/* Buttons: 36px tall, 8px radius, 13px label, flat hover-darken only. */
type BtnProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  href?: string;
  onClick?: () => void;
};

export function BtnPrimary({ children, style, href, onClick }: BtnProps) {
  const [hover, setHover] = useState(false);
  const s: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    height: 36,
    padding: "0 14px",
    borderRadius: 8,
    border: "none",
    background: hover ? C.inkBtnHover : C.inkBtn,
    color: "#FAFAFA",
    fontFamily: BODY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 140ms ease",
    ...style,
  };
  if (href)
    return (
      <Link href={href} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={s}>
        {children}
      </Link>
    );
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={s}>
      {children}
    </button>
  );
}

export function BtnSecondary({ children, style, href, onClick }: BtnProps) {
  const [hover, setHover] = useState(false);
  const s: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    height: 36,
    padding: "0 14px",
    borderRadius: 8,
    border: `1px solid ${C.btnBorder}`,
    background: hover ? "#F6F5F2" : C.white,
    color: C.ink,
    fontFamily: BODY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 140ms ease",
    ...style,
  };
  if (href)
    return (
      <Link href={href} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={s}>
        {children}
      </Link>
    );
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={s}>
      {children}
    </button>
  );
}

/* Section shell: alternating white/warm, airy padding, 1140px column. */
export function Section({
  bg,
  children,
  style,
  innerStyle,
}: {
  bg: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}) {
  return (
    <section style={{ background: bg, borderTop: `1px solid ${C.border}`, ...style }}>
      <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "120px 24px", ...innerStyle }}>{children}</div>
    </section>
  );
}

/* Scroll reveal: fade + rise + blur-to-sharp (their signature entrance). */
export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(16px)",
        filter: shown ? "none" : "blur(7px)",
        transition: `opacity 640ms var(--ease-out) ${delay}ms, transform 640ms var(--ease-out) ${delay}ms, filter 640ms var(--ease-out) ${delay}ms`,
        willChange: "opacity, transform, filter",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* small helpers */
export function ArrowIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
