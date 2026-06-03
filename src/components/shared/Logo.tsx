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
