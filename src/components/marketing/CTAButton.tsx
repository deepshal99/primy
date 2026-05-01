import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse";
type Size = "md" | "lg";

interface CTAButtonProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const sizeClasses: Record<Size, string> = {
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
};

/**
 * Marketing-only CTA button. Three variants used across the landing pages:
 * - primary  : heat-orange filled, white text — main conversion CTA
 * - secondary: white surface, muted border — pricing / "see more"
 * - ghost    : transparent, text-only — tertiary actions
 * - inverse  : white-on-transparent over heat-orange band
 */
export function CTAButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: CTAButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium transition-all duration-150 ease-out tabular-nums";

  const variantClasses: Record<Variant, string> = {
    primary:
      "text-white hover:brightness-95 active:scale-[0.99] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    secondary:
      "bg-white text-[#171717] border border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.16)] hover:-translate-y-[1px] active:translate-y-0",
    ghost:
      "bg-transparent text-[#525252] hover:text-[#171717] hover:bg-[rgba(0,0,0,0.04)]",
    inverse:
      "bg-white text-[#171717] hover:brightness-95 active:scale-[0.99]",
  };

  const style =
    variant === "primary" ? { backgroundColor: "#fa5d19" } : undefined;

  return (
    <Link
      href={href}
      className={cn(base, sizeClasses[size], variantClasses[variant], className)}
      style={style}
    >
      {children}
    </Link>
  );
}
