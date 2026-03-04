"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { deckThemes, activeThemeKeys, getThemeConfig } from "./deckThemes";
import type { DeckTheme } from "@/lib/types";

/**
 * Preset theme selector — no longer a standalone phase view.
 * Used as an optional toolbar popover for applying a preset style.
 */
export function DeckThemePicker() {
  const updateDeckTheme = useAppStore((s) => s.updateDeckTheme);
  const updateDeckStyle = useAppStore((s) => s.updateDeckStyle);
  const setPhase = useAppStore((s) => s.setDeckPhase);
  const [selected, setSelected] = useState<DeckTheme | null>(null);

  const themes = [...activeThemeKeys];
  const titleSlideTitle = "Your Presentation";

  const handleGenerate = () => {
    if (!selected) return;
    updateDeckTheme(selected);
    // Apply the full ThemeConfig from the preset
    updateDeckStyle(getThemeConfig(selected));
    setPhase("generating");

    // Dispatch a chat message to trigger AI slide generation
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: {
          content: `Generate the full presentation with the "${selected}" theme. Use the approved outline.`,
        },
      })
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h2 className="text-[14px] font-semibold text-[#1a1a2e] mb-1">
          Pick a style
        </h2>
        <p className="text-[12px] text-[#95928E] mb-5">
          Choose a visual theme for your presentation
        </p>

        <div className="grid grid-cols-1 gap-3">
          {themes.map((themeKey) => {
            const theme = deckThemes[themeKey];
            if (!theme) return null;
            const isSelected = selected === themeKey;

            return (
              <button
                key={themeKey}
                onClick={() => setSelected(themeKey)}
                className={cn(
                  "relative rounded-xl border overflow-hidden t-fast text-left cursor-pointer group",
                  isSelected
                    ? "border-[#d4582a] ring-2 ring-[#d4582a]/20"
                    : "border-[#e8e7e4] hover:border-[#dddfe3]"
                )}
              >
                {/* Mini slide preview */}
                <div
                  className="aspect-[16/9] p-6 flex flex-col justify-center"
                  style={{
                    background: theme.bg,
                    color: theme.text,
                    fontFamily: theme.headingFont,
                  }}
                >
                  <div
                    className="text-[16px] font-bold leading-tight"
                    style={{ color: theme.text }}
                  >
                    {titleSlideTitle}
                  </div>
                  <div
                    className="text-[11px] mt-1 opacity-60"
                    style={{ fontFamily: theme.bodyFont, color: theme.text }}
                  >
                    A presentation by you
                  </div>
                  <div
                    className="w-8 h-1 rounded-full mt-3"
                    style={{ backgroundColor: theme.accent }}
                  />
                </div>

                {/* Label bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white border-t border-[#e8e7e4]">
                  <span className="text-[12px] font-medium text-[#1a1a2e] capitalize">
                    {theme.label}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#d4582a] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-[#e8e7e4]">
        <button
          onClick={handleGenerate}
          disabled={!selected}
          className={cn(
            "w-full h-10 rounded-xl text-[13px] font-medium t-fast active:scale-[0.98] cursor-pointer",
            selected
              ? "bg-[#d4582a] text-white hover:bg-[#c04d24]"
              : "bg-[#f0f0ee] text-[#b0ada6] cursor-not-allowed"
          )}
        >
          Generate presentation
        </button>
      </div>
    </div>
  );
}
