"use client";

import { ArrowRightLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { DocView } from "./DocView";

export function DocPanel() {
  const docContent = useAppStore((s) => s.docContent);

  const wordCount = docContent.trim()
    ? docContent.trim().split(/\s+/).length
    : 0;
  const charCount = docContent.length;

  const handleSendToSheet = () => {
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: {
          content:
            "Convert the current document content into a well-structured spreadsheet. Organize the information into appropriate columns and rows.",
        },
      })
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <DocView />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {wordCount} words &middot; {charCount} chars
        </span>
        {docContent && (
          <button
            onClick={handleSendToSheet}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--color-bg-hover)] transition-all duration-200"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Send to Sheet
          </button>
        )}
      </div>
    </div>
  );
}
