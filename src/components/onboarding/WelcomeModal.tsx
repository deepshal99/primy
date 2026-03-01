"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Table2, GitBranch, Presentation } from "lucide-react";

const LS_KEY = "drafta_welcomed";

const features = [
  {
    icon: FileText,
    label: "Documents",
    color: "#4a7aed",
    bg: "rgba(74, 122, 237, 0.08)",
  },
  {
    icon: Table2,
    label: "Spreadsheets",
    color: "#2e9e47",
    bg: "rgba(46, 158, 71, 0.08)",
  },
  {
    icon: GitBranch,
    label: "Diagrams",
    color: "#7c5cb8",
    bg: "rgba(124, 92, 184, 0.08)",
  },
  {
    icon: Presentation,
    label: "Presentations",
    color: "#d4582a",
    bg: "rgba(212, 88, 42, 0.08)",
  },
] as const;

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(LS_KEY)) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(LS_KEY, "true");
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Drafta AI"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-[480px] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Top accent bar */}
        <div className="h-1 bg-[#ff4a00]" />

        <div className="px-8 pt-7 pb-8">
          {/* Header */}
          <h2 className="text-xl font-semibold text-[#1a1a2e] tracking-tight">
            Welcome to Drafta AI
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-[#6b6b80]">
            Your AI-powered workspace for documents, spreadsheets, diagrams,
            and presentations. Everything you create is connected through a
            smart AI assistant.
          </p>

          {/* Feature grid */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, color, bg }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-4 py-3.5"
                style={{ backgroundColor: bg }}
              >
                <Icon size={20} strokeWidth={1.8} style={{ color }} />
                <span
                  className="text-sm font-medium"
                  style={{ color }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={dismiss}
            className="mt-7 w-full rounded-xl bg-[#ff4a00] py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#e54300] active:scale-[0.98] cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
