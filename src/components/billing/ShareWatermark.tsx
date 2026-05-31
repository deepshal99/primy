"use client";

/**
 * ShareWatermark — "Built with Drafta" pill rendered on share viewers
 * when the artifact owner is on the free plan. Mirrors the Calendly /
 * Loom pattern: subtle but clickable, fixed bottom-right.
 *
 * Pro owners get a clean canvas — this returns null.
 */

import type { Plan } from "@/lib/plans";

interface ShareWatermarkProps {
  /** Effective plan of the artifact owner. */
  ownerPlan: Plan;
}

export function ShareWatermark({ ownerPlan }: ShareWatermarkProps) {
  if (ownerPlan === "pro") return null;

  return (
    <a
      href="/?ref=share"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Built with Drafta"
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 antialiased transition-all duration-150 ease-out hover:-translate-y-0.5 hover:text-neutral-900"
      style={{
        borderRadius: 9999,
        backgroundColor: "#ffffff",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)",
        backdropFilter: "saturate(140%)",
        WebkitFontSmoothing: "antialiased",
        letterSpacing: "-0.005em",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 1px 2px rgba(0, 0, 0, 0.05), 0 8px 20px rgba(0, 0, 0, 0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)";
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block flex-shrink-0"
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          backgroundColor: "#1A1815",
          boxShadow: "0 0 0 2px rgba(24, 24, 22, 0.12)",
        }}
      />
      <span>
        Built with <span className="font-semibold">Drafta</span>
      </span>
    </a>
  );
}
