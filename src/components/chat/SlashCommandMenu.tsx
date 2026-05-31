"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/ai/slashCommands";
import type { Plan } from "@/lib/plans";

/**
 * Slash command popover. Mirrors the @-mention popover pattern in
 * ChatInput. Filters as the user types after the leading "/", supports
 * keyboard up/down navigation, and visually mutes pro-only commands
 * for free users (clicking still selects, server-side gates the
 * augmentation if the user lacks plan).
 */

export interface SlashCommandMenuProps {
  /** Filter prefix typed after "/" — empty string shows all */
  query: string;
  /** Index of the currently-highlighted item */
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  onSelect: (command: SlashCommand) => void;
  effectivePlan: Plan;
}

export function SlashCommandMenu({
  query,
  selectedIndex,
  setSelectedIndex,
  onSelect,
  effectivePlan,
}: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) =>
        c.name.toLowerCase().startsWith(q) ||
        c.label.toLowerCase().includes(q)
    );
  }, [query]);

  // Keep selectedIndex within bounds when the list changes.
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex, setSelectedIndex]);

  // Scroll selected into view on change.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-slash-index="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash command suggestions"
      className="absolute bottom-full left-4 right-4 mb-1.5 z-20 bg-card rounded-xl border border-[#e8e7e4] shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden animate-fade-in"
    >
      <div className="max-h-[280px] overflow-y-auto py-1">
        {filtered.map((cmd, i) => {
          const Icon: LucideIcon = cmd.icon;
          const isProGated = cmd.tier === "pro" && effectivePlan === "free";
          return (
            <button
              key={cmd.name}
              type="button"
              role="option"
              aria-selected={i === selectedIndex}
              data-slash-index={i}
              className={cn(
                "w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors cursor-pointer",
                i === selectedIndex ? "bg-[#f5f4f1]" : "hover:bg-[#fafaf8]",
                isProGated && "opacity-60"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(cmd);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <Icon
                className="w-3.5 h-3.5 text-[#525252] shrink-0"
                aria-hidden
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] text-foreground truncate">
                  /{cmd.name}{" "}
                  <span className="text-[#95928E] font-normal">— {cmd.label}</span>
                </span>
                <span className="text-[11.5px] text-[#737373] truncate">
                  {cmd.description}
                </span>
              </div>
              {cmd.tier === "pro" && (
                <span
                  className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{
                    backgroundColor: isProGated ? "rgba(0,0,0,0.04)" : "#1A1815",
                    color: isProGated ? "#737373" : "white",
                  }}
                >
                  Pro
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
