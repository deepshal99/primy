"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Code2, Eye, Maximize2, X } from "lucide-react";

/**
 * Renders an HTML "visual document" page. The markup is shown in a sandboxed
 * iframe (isolated styles + scripts), with a Preview ⇄ Edit-HTML toggle and a
 * Present (fullscreen) mode. Edits flow through the store's updatePageHtml so
 * they persist via the normal debounced save.
 */
export function PagePanel() {
  const pageHtml = useAppStore((s) => s.pageHtml);
  const pageVersion = useAppStore((s) => s.pageVersion);
  const updatePageHtml = useAppStore((s) => s.updatePageHtml);

  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [present, setPresent] = useState(false);
  const [draft, setDraft] = useState(pageHtml);

  // Re-sync the editor draft when the page changes underneath us (open, AI op, undo)
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    setDraft(pageHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVersion]);

  // Esc exits present mode
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  const hasContent = pageHtml.trim().length > 0;

  const frame = (
    <iframe
      // key forces a fresh document when content changes (avoids stale scripts)
      key={pageVersion}
      title="HTML page preview"
      srcDoc={pageHtml}
      sandbox="allow-scripts allow-popups allow-forms"
      className="w-full h-full border-0 bg-white"
    />
  );

  if (present) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 h-[44px] border-b border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <span className="text-[12px] font-medium text-[#737373]">Presenting</span>
          <button
            onClick={() => setPresent(false)}
            className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] text-[#525252] hover:bg-[#f5f5f5] transition-colors t-fast"
          >
            <X size={14} /> Exit
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{frame}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Page toolbar */}
      <div className="flex items-center justify-between px-3 h-[40px] border-b border-[#f0efec] flex-shrink-0">
        <div className="inline-flex items-center rounded-md bg-[#f5f4f2] p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[5px] text-[12px] font-medium transition-colors t-fast ${
              mode === "preview" ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => setMode("code")}
            className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[5px] text-[12px] font-medium transition-colors t-fast ${
              mode === "code" ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            <Code2 size={13} /> HTML
          </button>
        </div>

        <button
          onClick={() => setPresent(true)}
          disabled={!hasContent}
          className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] font-medium text-[#525252] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors t-fast"
        >
          <Maximize2 size={13} /> Present
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {!hasContent ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-[320px] px-6">
              <div className="w-12 h-12 rounded-xl bg-[#f3eeff] flex items-center justify-center mx-auto mb-4">
                <Eye size={20} className="text-[#9061ff]" />
              </div>
              <p className="text-[14px] font-medium text-[#171717] mb-1">This page is empty</p>
              <p className="text-[13px] text-[#737373] leading-relaxed">
                Ask the assistant to turn a document into a visual page, or paste HTML in the editor.
              </p>
            </div>
          </div>
        ) : mode === "preview" ? (
          frame
        ) : (
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              updatePageHtml(e.target.value);
            }}
            spellCheck={false}
            className="w-full h-full resize-none border-0 outline-none p-4 font-mono text-[12.5px] leading-relaxed text-[#1a1a1a] bg-[#fafafa]"
            placeholder="<!doctype html> ..."
          />
        )}
      </div>
    </div>
  );
}
