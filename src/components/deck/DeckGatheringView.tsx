"use client";

import { Presentation } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function DeckGatheringView() {
  const progress = useAppStore((s) => s.deckGatheringProgress);
  const total = 4;

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-8 max-w-[320px]">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#fef0e8]">
          <Presentation className="w-6 h-6 text-[#d4582a]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[#1a1a2e] mb-1">
            Your presentation is taking shape
          </p>
          <p className="text-[12px] text-[#95928E] leading-relaxed">
            Answer a few questions in the chat and we'll draft an outline for you
          </p>
        </div>
        {progress > 0 && (
          <div className="w-full max-w-[200px]">
            <div className="h-1 rounded-full bg-[#f0f0ee] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#d4582a] t-normal"
                style={{ width: `${Math.min((progress / total) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#b0ada6] mt-1.5">
              Question {progress} of ~{total}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
