"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const shortcuts = [
  { keys: ["\u2318", "K"], desc: "Search files & content" },
  { keys: ["\u2318", "N"], desc: "New project" },
  { keys: ["\u2318", "B"], desc: "Toggle sidebar" },
  { keys: ["\u2318", "/"], desc: "Focus chat input" },
  { keys: ["\u2318", "W"], desc: "Close current tab" },
  { keys: ["\u2318", "Z"], desc: "Undo AI changes" },
  { keys: ["\u2318", "\u21E7", "Z"], desc: "Redo AI changes" },
  { keys: ["\u2318", "1"], desc: "Open first table" },
  { keys: ["\u2318", "2"], desc: "Open first document" },
  { keys: ["Enter"], desc: "Send message" },
  { keys: ["Shift", "Enter"], desc: "New line in message" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShow = () => setOpen(true);
    window.addEventListener("primy:show-shortcuts", handleShow);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "?" ) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("primy:show-shortcuts", handleShow);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-150" />
      <div
        className="relative w-full max-w-[380px] rounded-2xl border border-[#e8e8ed] bg-white p-6 animate-scale-in mx-4"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-heading-lg font-heading text-[#1a1a2e]">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#95928E] hover:bg-[#f5f4f0] t-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.desc}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-body-sm text-[#6b6b80]">
                {shortcut.desc}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-1.5 py-0.5 rounded-md border border-[#e8e8ed] bg-[#f5f5f3] text-[#6b6b80] text-label font-medium min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-label mt-5 text-center text-[#95928E]">
          Use Ctrl on Windows/Linux instead of {"\u2318"}
        </p>
      </div>
    </div>
  );
}
