"use client";

import { useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";

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
      <div className="absolute inset-0 bg-black/30 transition-opacity duration-150" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-[#e8e8ed] bg-white animate-scale-in"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0eee9]">
          <span className="text-[15px] font-semibold text-[#171717]">
            Add Context
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#95928E] hover:bg-[#f5f4f0] transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <textarea
            defaultValue={projectMemory.customInstructions || ""}
            onChange={(e) => debouncedUpdate(e.target.value)}
            placeholder="Add any context about this project for the AI -- e.g. what it's about, how you want responses, any preferences..."
            rows={6}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl outline-none transition-colors duration-150 text-[13px] text-[#171717] resize-none leading-relaxed bg-[#F1F0ED] border border-[rgba(24,24,22,0.08)] focus:border-[#FFB43F] placeholder:text-[#B9B6AE]"
            style={{ minHeight: "24px" }}
          />
          <p className="mt-3 text-[11px] text-[#B9B6AE] leading-[1.4]">
            This context will be shared with the AI in every message. Changes save automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
