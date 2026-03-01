"use client";

import { Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface SuggestionChipsProps {
  suggestions: string[];
}

export function SuggestionChips({ suggestions }: SuggestionChipsProps) {
  const clearSuggestions = useAppStore((s) => s.clearSuggestions);

  const handleClick = (suggestion: string) => {
    clearSuggestions();
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: { content: suggestion },
      })
    );
  };

  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="Suggested follow-ups">
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => handleClick(suggestion)}
          className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] text-muted-foreground font-medium transition-all duration-150 hover:border-[#ff4a00]/30 hover:text-[#ff4a00] hover:bg-[#fff8f5] text-left w-fit animate-fade-in"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          role="listitem"
        >
          <Zap className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity flex-shrink-0" strokeWidth={2} />
          {suggestion}
        </button>
      ))}
    </div>
  );
}
