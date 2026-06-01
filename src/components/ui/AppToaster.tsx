"use client";

import { Toaster } from "sonner";
import { Check, X, Info, TriangleAlert, LoaderCircle } from "lucide-react";

/**
 * Primy toasts — a floating "ink" pill, centered at the bottom of the screen.
 *
 * Design: a single dark stadium pill that hugs its content (left:0/right:0 +
 * margin-inline:auto centres it within sonner's absolutely-positioned stack),
 * with a per-type colour-coded icon that pops in. The colour is the only type
 * signal, so a toast is scannable at a glance. Appearance lives here; the icon
 * pop + entrance flourish live in globals.css (`.primy-toast*`).
 */
export function AppToaster() {
  const ic = (node: React.ReactNode, color: string) => (
    <span className="primy-toast-ic" style={{ color }}>{node}</span>
  );
  return (
    <Toaster
      position="bottom-center"
      offset={26}
      gap={10}
      visibleToasts={4}
      icons={{
        success: ic(<Check size={13} strokeWidth={3.2} />, "#5CD08A"),
        error: ic(<X size={13} strokeWidth={3.2} />, "#FF7A7A"),
        info: ic(<Info size={14} strokeWidth={2.6} />, "#7FB4FF"),
        warning: ic(<TriangleAlert size={13} strokeWidth={2.6} />, "#FFB43F"),
        loading: ic(<LoaderCircle size={14} strokeWidth={2.8} className="primy-toast-spin" />, "#FFB43F"),
      }}
      toastOptions={{
        style: {
          // hug content + centre within sonner's stack column
          width: "fit-content",
          maxWidth: "min(460px, calc(100vw - 28px))",
          left: 0,
          right: 0,
          marginInline: "auto",
          // the ink pill
          background: "linear-gradient(176deg, #2A2620 0%, #1A1815 64%)",
          color: "#F3F0EA",
          border: "none",
          borderRadius: "9999px",
          padding: "10px 17px 10px 12px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "13px",
          fontWeight: 450,
          letterSpacing: "-0.01em",
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04), 0 14px 34px -10px rgba(24,24,22,0.55), 0 3px 10px -3px rgba(24,24,22,0.45)",
        },
        classNames: {
          toast: "primy-toast",
          title: "primy-toast-title",
          description: "primy-toast-desc",
          icon: "primy-toast-icon",
          closeButton: "primy-toast-close",
          actionButton: "primy-toast-action",
        },
      }}
    />
  );
}
