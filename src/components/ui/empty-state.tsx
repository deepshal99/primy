"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** Optional small illustrative element (icon, SVG, or CSS shape). Sized 40-56px. */
  icon?: ReactNode;
  /** Primary headline. Warm, direct voice. */
  heading: string;
  /** Sub-line below heading. Helpful, brief. */
  description?: string;
  /** CTA buttons or chips. Heat-orange reserved for the primary CTA only. */
  action?: ReactNode;
  /** Outer wrapper class. Default centers content with 64px vertical padding. */
  className?: string;
  /** Inner content max width. Default 480px. */
  maxWidth?: number;
  /** Stagger entry animation. Default true. */
  animate?: boolean;
}

/**
 * EmptyState — the standard "no data" surface across Primy.
 *
 * Layout: centered, max-width 480px, generous (64px) vertical breathing
 * room. Concentric radii are used wherever cards/buttons are inserted
 * via the `action` slot.
 *
 * Voice rules: warm, direct, helpful. Never apologetic.
 *
 * Typography: heading uses the heading family (Degular/Inter), tight
 * tracking, 18px / weight 500. Description is 13-14px, muted text.
 */
export function EmptyState({
  icon,
  heading,
  description,
  action,
  className,
  maxWidth = 480,
  animate = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-16",
        animate && "animate-fade-in",
        className
      )}
    >
      <div
        className="flex flex-col items-center w-full"
        style={{ maxWidth }}
      >
        {icon && (
          <div
            className={cn(
              "mb-5 flex items-center justify-center",
              animate && "animate-fade-in-up"
            )}
          >
            {icon}
          </div>
        )}
        <h3
          className={cn(
            "text-[18px] font-medium text-[#171717] tracking-[-0.01em] leading-tight mb-1.5 font-heading",
            animate && "animate-fade-in-up animation-delay-100"
          )}
        >
          {heading}
        </h3>
        {description && (
          <p
            className={cn(
              "text-[13px] text-[#737373] leading-relaxed max-w-[400px]",
              animate && "animate-fade-in-up animation-delay-200"
            )}
          >
            {description}
          </p>
        )}
        {action && (
          <div
            className={cn(
              "mt-6 flex flex-wrap items-center justify-center gap-2",
              animate && "animate-fade-in-up animation-delay-300"
            )}
          >
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
