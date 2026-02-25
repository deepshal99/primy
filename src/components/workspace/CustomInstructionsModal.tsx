"use client";

import { useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

export function CustomInstructionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projectMemory = useAppStore((s) => s.projectMemory);
  const updateProjectMemory = useAppStore((s) => s.updateProjectMemory);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedUpdate = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateProjectMemory({ customInstructions: value || undefined });
      }, 500);
    },
    [updateProjectMemory]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="relative w-full max-w-md rounded-2xl border animate-scale-in"
        style={{
          backgroundColor: design.colors.bg.elevated,
          borderColor: design.colors.border.default,
          boxShadow: design.shadows.lg,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${design.colors.border.light}` }}
        >
          <span style={{ fontSize: "15px", fontWeight: 600, color: design.colors.text.primary }}>
            Add Context
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <textarea
            defaultValue={projectMemory.customInstructions || ""}
            onChange={(e) => debouncedUpdate(e.target.value)}
            placeholder="Add any context about this project for the AI — e.g. what it's about, how you want responses, any preferences..."
            rows={6}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl outline-none transition-colors text-[13px] resize-none leading-relaxed"
            style={{
              backgroundColor: design.colors.bg.secondary,
              color: design.colors.text.primary,
              border: `1px solid ${design.colors.border.default}`,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; }}
          />
          <p className="mt-3" style={{ fontSize: "11px", color: design.colors.text.placeholder, lineHeight: "1.4" }}>
            This context will be shared with the AI in every message. Changes save automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
