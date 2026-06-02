"use client";

import { useAppStore } from "@/lib/store";
import { DeckGeneratingView } from "./DeckGeneratingView";
import { DeckLinearView } from "./DeckLinearView";
import type { DeckPhase } from "@/lib/types";

function DeckIdleView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-8 max-w-[360px] animate-fade-in">
        {/* Stacked-slides illustration */}
        <div className="relative w-[88px] h-[56px]" aria-hidden>
          <div
            className="absolute inset-0 rounded-[10px] -rotate-[6deg] -translate-x-1.5"
            style={{
              background: "#fde8dc",
              border: "1px solid rgba(255, 180, 63, 0.20)",
            }}
          />
          <div
            className="absolute inset-0 rounded-[10px] rotate-[3deg] translate-x-1"
            style={{
              background: "#fef0e8",
              border: "1px solid rgba(255, 180, 63, 0.26)",
            }}
          />
          <div
            className="absolute inset-0 rounded-[10px] bg-white"
            style={{
              border: "1px solid rgba(255, 180, 63, 0.38)",
              boxShadow: "0 4px 12px rgba(255, 180, 63, 0.12)",
            }}
          >
            <div className="absolute inset-x-3 top-3 h-[3px] rounded-full bg-[rgba(255,180,63,0.55)]" />
            <div className="absolute inset-x-3 top-[18px] h-[2px] w-[60%] rounded-full bg-[rgba(255,180,63,0.32)]" />
            <div className="absolute inset-x-3 top-[26px] h-[2px] w-[80%] rounded-full bg-[rgba(255,180,63,0.24)]" />
            <div className="absolute left-3 bottom-3 flex gap-1">
              <div className="w-3 h-2 rounded-[2px] bg-[rgba(255,180,63,0.38)]" />
              <div className="w-3 h-2 rounded-[2px] bg-[rgba(255,180,63,0.24)]" />
              <div className="w-3 h-2 rounded-[2px] bg-[rgba(255,180,63,0.38)]" />
            </div>
          </div>
        </div>
        <div>
          <p className="text-[15px] font-medium text-foreground mb-1.5 font-heading tracking-[-0.01em]">
            Add your first slide
          </p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Describe your deck in chat: topic, audience, style, and AI will design it for you.
          </p>
        </div>
      </div>
    </div>
  );
}

const PHASE_VIEWS: Record<DeckPhase, React.ComponentType> = {
  idle: DeckIdleView,
  generating: DeckGeneratingView,
  viewing: DeckLinearView,
};

export function DeckBuilder() {
  const phase = useAppStore((s) => s.deckPhase);
  const View = PHASE_VIEWS[phase];

  return (
    <div className="h-full">
      <View />
    </div>
  );
}
