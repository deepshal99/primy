"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { AlertTriangle } from "lucide-react";

/**
 * In-app confirm dialog — replaces native `confirm()` (which blocks the page and
 * looks foreign). Call `await confirmDialog({...})` from anywhere; it resolves to
 * true/false. A single <ConfirmHost/> (mounted in the root layout) renders it.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

const useConfirmStore = create<{
  current: Pending | null;
  open: (p: Pending) => void;
  close: () => void;
}>((set) => ({
  current: null,
  open: (p) => set({ current: p }),
  close: () => set({ current: null }),
}));

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current);
  const close = useConfirmStore((s) => s.close);
  const [shown, setShown] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const settle = (value: boolean) => {
    current?.resolve(value);
    setShown(false);
    // Let the exit animation play before unmounting.
    setTimeout(close, 140);
  };

  useEffect(() => {
    if (!current) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      confirmRef.current?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); settle(false); }
      if (e.key === "Enter") { e.preventDefault(); settle(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;

  const danger = current.tone === "danger";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{ background: "rgba(0,0,0,0.45)", opacity: shown ? 1 : 0 }}
        onClick={() => settle(false)}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] p-5 transition-all duration-150"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-pane)",
          borderRadius: 14,
          transform: shown ? "scale(1)" : "scale(0.96)",
          opacity: shown ? 1 : 0,
        }}
      >
        <div className="flex items-start gap-3.5">
          {danger && (
            <span
              className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: "color-mix(in srgb, var(--destructive) 14%, transparent)", color: "var(--destructive)" }}
            >
              <AlertTriangle className="w-[18px] h-[18px]" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
              {current.title}
            </h2>
            {current.message && (
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                {current.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => settle(false)}
            className="h-9 px-3.5 rounded-[9px] text-[13px] font-medium press hover-row"
            style={{ color: "var(--ink-2)" }}
          >
            {current.cancelLabel || "Cancel"}
          </button>
          <button
            ref={confirmRef}
            onClick={() => settle(true)}
            className="h-9 px-4 rounded-[9px] text-[13px] font-medium press focus-visible:outline-none focus-visible:ring-2"
            style={
              danger
                ? { background: "var(--destructive)", color: "var(--destructive-foreground)" }
                : { background: "var(--primary)", color: "var(--primary-foreground)" }
            }
          >
            {current.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
