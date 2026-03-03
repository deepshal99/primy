"use client";

import { Loader2 } from "lucide-react";

export function DeckGeneratingView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-8">
        <Loader2 className="w-8 h-8 text-[#d4582a] animate-spin" strokeWidth={1.5} />
        <div>
          <p className="text-[14px] font-medium text-[#1a1a2e] mb-1">
            Building your presentation
          </p>
          <p className="text-[12px] text-[#95928E]">
            Crafting slides, picking images, polishing content...
          </p>
        </div>
      </div>
    </div>
  );
}
