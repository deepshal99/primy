"use client";

import { Presentation } from "lucide-react";

/** @deprecated No longer used — kept for backward compatibility */
export function DeckGatheringView() {
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
            Answer a few questions in the chat and we&apos;ll draft an outline for you
          </p>
        </div>
      </div>
    </div>
  );
}
