"use client";

import { useAppStore } from "@/lib/store";
import { DeckGeneratingView } from "./DeckGeneratingView";
import { DeckLinearView } from "./DeckLinearView";
import type { DeckPhase } from "@/lib/types";
import { Presentation } from "lucide-react";

function DeckIdleView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-8 max-w-[320px]">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#fef0e8]">
          <Presentation className="w-6 h-6 text-[#d4582a]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[#1a1a2e] mb-1">
            Ready to create
          </p>
          <p className="text-[12px] text-[#95928E] leading-relaxed">
            Describe your presentation in the chat — topic, audience, style — and we&apos;ll design it for you
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
