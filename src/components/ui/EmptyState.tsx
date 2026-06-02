"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * EmptyState — the one warm, on-brand "nothing here yet" primitive used across
 * Primy (project home, recents, quick notes, search no-results, empty
 * workspaces, version history…).
 *
 * Mirrors the polished chat `MessageListEmpty`: an amber icon chip, a
 * `font-heading` title with tight tracking, a muted description, and pill
 * actions — all entering with a staggered fade. Built entirely on CSS vars so
 * it is dark-mode aware; the only hardcoded colour is the amber accent on the
 * icon chip, which the codebase already pins to #FFB43F everywhere.
 *
 * Motion is handled by `.animate-fade-in-up` + `.animation-delay-*` utilities,
 * which the global `prefers-reduced-motion` rule already neutralises.
 *
 * Voice: warm, direct, never apologetic. Distinguish FIRST-RUN copy ("Start
 * your first…") from EMPTY-AFTER-DELETE copy (a calm clean slate) at the call
 * site — the component just renders whatever strings you give it.
 */

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  /** Lucide icon rendered inside the amber chip. Ignored if `illustration` is set. */
  icon?: LucideIcon;
  /** Custom illustration node — replaces the default icon chip entirely. */
  illustration?: ReactNode;
  /** Primary headline. Warm, direct voice. */
  title: string;
  /** Optional sub-line. Helpful, brief. */
  description?: string;
  /** Primary call to action (ink-filled pill). */
  action?: EmptyStateAction;
  /** Secondary call to action (bordered pill). */
  secondaryAction?: EmptyStateAction;
  /** Optional custom action slot — overrides `action`/`secondaryAction` when set. */
  children?: ReactNode;
  /** Density. sm = inline/sidebar, md = panel (default), lg = full-page. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: {
    wrap: "px-4 py-8",
    chip: "w-10 h-10 rounded-[12px]",
    iconPx: 18,
    title: "text-[14px]",
    desc: "text-[12.5px] max-w-[260px]",
    gapAfterChip: "mb-3",
  },
  md: {
    wrap: "px-6 py-12",
    chip: "w-12 h-12 rounded-[14px]",
    iconPx: 22,
    title: "text-[15.5px]",
    desc: "text-[13px] max-w-[340px]",
    gapAfterChip: "mb-4",
  },
  lg: {
    wrap: "px-8 py-16",
    chip: "w-14 h-14 rounded-[16px]",
    iconPx: 26,
    title: "text-[18px]",
    desc: "text-[13.5px] max-w-[400px]",
    gapAfterChip: "mb-5",
  },
} as const;

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "primary" | "secondary" }) {
  const Icon = action.icon;
  return (
    <button
      onClick={action.onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] font-medium press lift",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-amber)]/40",
        variant === "primary"
          ? "text-[var(--primary-foreground)]"
          : "border",
      )}
      style={
        variant === "primary"
          ? { background: "var(--primary)" }
          : { background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--ink-2)" }
      }
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {action.label}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  children,
  size = "md",
  className,
}: EmptyStateProps) {
  const s = SIZES[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        s.wrap,
        className,
      )}
    >
      {/* Icon chip / illustration */}
      {illustration ? (
        <div className={cn("animate-fade-in-up", s.gapAfterChip)}>{illustration}</div>
      ) : Icon ? (
        <div
          className={cn(
            "relative flex items-center justify-center animate-fade-in-up",
            s.chip,
            s.gapAfterChip,
          )}
          style={{
            background: "rgba(255,180,63,0.08)",
            border: "1px solid rgba(255,180,63,0.16)",
          }}
          aria-hidden
        >
          <Icon size={s.iconPx} strokeWidth={1.75} className="text-[#FFB43F]" />
        </div>
      ) : null}

      {/* Title */}
      <h3
        className={cn(
          "font-heading font-medium tracking-[-0.01em] leading-tight text-balance animate-fade-in-up animation-delay-100",
          s.title,
        )}
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            "mt-1.5 leading-relaxed text-pretty animate-fade-in-up animation-delay-200",
            s.desc,
          )}
          style={{ color: "var(--ink-3)" }}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(children || action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up animation-delay-300">
          {children ?? (
            <>
              {action && <ActionButton action={action} variant="primary" />}
              {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
