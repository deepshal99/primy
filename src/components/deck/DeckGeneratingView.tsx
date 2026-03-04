"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

const STEPS = [
  "Crafting your storyline",
  "Writing slide content",
  "Selecting images",
  "Polishing the design",
];

export function DeckGeneratingView() {
  const outline = useAppStore((s) => s.deckOutline);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-8 max-w-[320px]">
        {/* animated dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#d4582a] animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: "1s",
              }}
            />
          ))}
        </div>

        <div>
          <p className="text-[15px] font-semibold text-[#1a1a2e] mb-1.5">
            Building your presentation
          </p>
          <p className="text-[13px] text-[#6b6b80]">
            {outline.length} slides &middot; {STEPS[stepIdx]}...
          </p>
        </div>

        {/* progress steps */}
        <div className="w-full space-y-1.5">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2.5 text-left"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-500 ${
                  i <= stepIdx ? "bg-[#d4582a]" : "bg-[#e8e7e4]"
                }`}
              />
              <span
                className={`text-[12px] transition-colors duration-500 ${
                  i <= stepIdx ? "text-[#1a1a2e]" : "text-[#b0ada6]"
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
