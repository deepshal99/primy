"use client";

import { useEffect, useMemo, useRef } from "react";
import { Crown } from "lucide-react";
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
      className="absolute bottom-full left-4 right-4 mb-1.5 z-20 bg-card rounded-[14px] border border-border shadow-[var(--shadow-pane)] overflow-hidden menu-pop"
    >
      <div className="max-h-[300px] overflow-y-auto flex flex-col gap-0.5 p-1.5">
        {filtered.map((cmd, i) => {
          const Icon: LucideIcon = cmd.icon;
          const isProGated = cmd.tier === "pro" && effectivePlan === "free";
          const selected = i === selectedIndex;
          return (
            <button
              key={cmd.name}
              type="button"
              role="option"
              aria-selected={selected}
              data-slash-index={i}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-left t-colors cursor-pointer",
                selected ? "bg-accent" : "hover:bg-accent",
                isProGated && "opacity-55"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(cmd);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {/* Neutral icon tile — calm structure, monochrome per the design
                  system. Lifts to card on the active row so it stays distinct. */}
              <span
                className={cn(
                  "w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 t-colors",
                  selected ? "bg-card" : "bg-muted"
                )}
              >
                <Icon className="w-[17px] h-[17px] text-icon" strokeWidth={1.7} aria-hidden />
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-medium text-foreground truncate leading-tight">
                  /{cmd.name}
                </span>
                <span className="text-[11.5px] text-muted-foreground truncate leading-snug mt-0.5">
                  {cmd.description}
                </span>
              </div>
              {cmd.tier === "pro" && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isProGated
                      ? "var(--muted)"
                      : "rgba(255,180,63,0.16)",
                    color: isProGated
                      ? "var(--muted-foreground)"
                      : "var(--accent-amber-deep)",
                  }}
                >
                  <Crown className="w-2.5 h-2.5" strokeWidth={2} />
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
