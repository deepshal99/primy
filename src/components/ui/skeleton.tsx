"use client";

import { cn } from "@/lib/cn";

/**
 * Skeleton primitive — used everywhere a loading state needs to mirror
 * the layout of incoming content.
 *
 * Style: 8% gray (rgba(0,0,0,0.06)) base with a soft pulse. A subtle
 * sheen sweep is layered on top via gradient — keeps the surface alive
 * without the harsh "loader bar" feel. 1.2s linear infinite.
 *
 * Variants:
 *  - `pulse` (default) — gentle opacity pulse, suitable for blocks.
 *  - `shimmer` — gradient sweep across the surface, suitable for cards.
 *
 * Respects `prefers-reduced-motion`.
 */
function Skeleton({
  className,
  variant = "pulse",
  ...props
}: React.ComponentProps<"div"> & { variant?: "pulse" | "shimmer" }) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      className={cn(
        "skeleton-base rounded-md",
        variant === "shimmer" ? "skeleton-shimmer" : "skeleton-pulse",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
