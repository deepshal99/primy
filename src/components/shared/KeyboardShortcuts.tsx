"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { design } from "@/lib/design";

const shortcuts = [
  { keys: ["⌘", "K"], desc: "Search files & content" },
  { keys: ["⌘", "N"], desc: "New project" },
  { keys: ["⌘", "B"], desc: "Toggle sidebar" },
  { keys: ["⌘", "/"], desc: "Focus chat input" },
  { keys: ["⌘", "W"], desc: "Close current tab" },
  { keys: ["⌘", "Z"], desc: "Undo AI changes" },
  { keys: ["⌘", "⇧", "Z"], desc: "Redo AI changes" },
  { keys: ["⌘", "1"], desc: "Open first table" },
  { keys: ["⌘", "2"], desc: "Open first document" },
  { keys: ["Enter"], desc: "Send message" },
  { keys: ["Shift", "Enter"], desc: "New line in message" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShow = () => setOpen(true);
    window.addEventListener("drafta:show-shortcuts", handleShow);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "?" ) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("drafta:show-shortcuts", handleShow);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[380px] rounded-2xl border border-[var(--color-border)] p-6 animate-scale-in mx-4"
        style={{
          backgroundColor: design.colors.bg.primary,
          boxShadow: design.shadows.xl,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-heading-lg font-heading"
            style={{ color: design.colors.text.primary }}
          >
            Keyboard Shortcuts
          </h3>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" style={{ color: design.colors.text.muted }} />
          </button>
        </div>

        <div className="space-y-1.5">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.desc}
              className="flex items-center justify-between py-1.5"
            >
              <span
                className="text-body-sm"
                style={{ color: design.colors.text.secondary }}
              >
                {shortcut.desc}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-1.5 py-0.5 rounded-md border text-label font-medium min-w-[24px] text-center"
                    style={{
                      borderColor: design.colors.border.default,
                      backgroundColor: design.colors.bg.secondary,
                      color: design.colors.text.secondary,
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p
          className="text-label mt-5 text-center"
          style={{ color: design.colors.text.muted }}
        >
          Use Ctrl on Windows/Linux instead of ⌘
        </p>
      </div>
    </div>
  );
}
