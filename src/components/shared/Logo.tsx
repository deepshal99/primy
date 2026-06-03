"use client";

/**
 * LogoMark — the canonical Primy brand glyph (the four ink bars shown at the
 * top of the sidebar). SVG + currentColor so it scales cleanly at any size and
 * inherits `color`. This is the ONLY brand mark; never use a sparkle/star icon
 * as a stand-in for it.
 */
export function LogoMark({ size = 22, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden
    >
      <rect x="0" y="5" width="6" height="12" rx="3" />
      <rect x="7" y="2" width="5" height="18" rx="2.5" transform="rotate(-28 9.5 11)" />
      <rect x="12" y="3" width="5" height="16" rx="2.5" transform="rotate(28 14.5 11)" />
      <rect x="18" y="6" width="4" height="10" rx="2" />
    </svg>
  );
}

/**
 * BrandBars — the four-bar Primy motif reborn as a live status glyph. Same DNA
 * as the LogoMark (four rounded bars in the brand's tall-tall-mid-short rhythm),
 * upright so it can animate as a calm equalizer. Three states:
 *   - "active": amber bars do a gentle staggered wave (the work is happening)
 *   - "done":   deep-amber bars come to rest (step complete)
 *   - "pending": faint ink bars, low and still (not started)
 * Animation lives in motion.css (.brand-bars), transform-only + reduced-motion safe.
 */
export function BrandBars({
  state,
  size = 16,
  className,
}: {
  state: "pending" | "active" | "done";
  size?: number;
  className?: string;
}) {
  // Rest heights echo the LogoMark rhythm (med, tall, tall-ish, short).
  const heights = [0.55, 1, 0.82, 0.48];
  const color =
    state === "done"
      ? "var(--accent-amber-deep, #B87426)"
      : state === "active"
        ? "var(--accent-amber, #FFB43F)"
        : "var(--ink-4)";
  return (
    <span
      className={`brand-bars${className ? ` ${className}` : ""}`}
      data-state={state}
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: Math.max(1, Math.round(size * 0.11)),
        width: size,
        height: size,
        opacity: state === "pending" ? 0.55 : 1,
      }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="brand-bars-bar"
          style={{
            width: Math.max(2, Math.round(size * 0.16)),
            height: `${h * 100}%`,
            borderRadius: 999,
            background: color,
          }}
        />
      ))}
    </span>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2 cursor-default select-none">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#1A1815]">
        <LogoMark size={15} style={{ color: "#FFFFFF" }} />
      </div>
      <span className="text-heading font-heading text-[#171717]">
        Primy
      </span>
    </div>
  );
}
