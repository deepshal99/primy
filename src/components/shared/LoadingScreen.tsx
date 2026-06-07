"use client";

import { LogoMark } from "@/components/shared/Logo";

/**
 * LoadingScreen — the single, canonical full-screen loading state for Primy.
 *
 * It shows the brand glyph (the four ink bars) gently breathing inside the
 * ink chip, with an optional label. Use this for EVERY full-screen "the app /
 * page is loading" moment so the experience is identical everywhere.
 *
 * Variants:
 *   - "app"   (default) — adapts to the theme via tokens (authenticated app)
 *   - "light"           — fixed light surface (public/auth/share pages, which
 *                         deliberately stay light per the design system)
 */
export function LoadingScreen({
  label = "Loading Primy...",
  variant = "app",
  fullScreen = true,
}: {
  label?: string | null;
  variant?: "app" | "light";
  fullScreen?: boolean;
}) {
  const light = variant === "light";

  return (
    <div
      className={`${
        fullScreen ? "h-screen w-screen" : "h-full w-full"
      } flex items-center justify-center antialiased`}
      style={{ background: light ? "#FCFBF8" : "var(--background)" }}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
    >
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div className="relative flex items-center justify-center">
          {/* Soft pulsing glow behind the chip */}
          <span
            className="brand-loader-glow absolute inset-0 rounded-[15px]"
            style={{ background: "var(--accent-amber, #FFB43F)" }}
            aria-hidden
          />
          {/* Ink chip + brand mark */}
          <span
            className="brand-loader-mark relative flex items-center justify-center w-[52px] h-[52px] rounded-[15px]"
            style={{ background: "#1A1815", boxShadow: "0 6px 20px rgba(24,24,22,0.18)" }}
            aria-hidden
          >
            <LogoMark size={26} style={{ color: "#FFFFFF" }} />
          </span>
        </div>
        {label && (
          <p
            className="text-[13px]"
            style={{ color: light ? "#706E68" : "var(--muted-foreground, #706E68)" }}
          >
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
