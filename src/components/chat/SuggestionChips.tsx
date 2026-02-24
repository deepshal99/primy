"use client";

import { Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

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
    <div className="flex items-start gap-2 pl-[34px] animate-fade-in">
      <div className="flex flex-col gap-2 max-w-[400px]">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handleClick(suggestion)}
            className="group flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[12px] font-medium transition-all duration-200 hover:shadow-sm icon-btn-hover text-left"
            style={{
              borderColor: design.colors.border.default,
              color: design.colors.text.secondary,
              backgroundColor: design.colors.bg.elevated,
              animationDelay: `${i * 80}ms`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = design.colors.brand.primary;
              e.currentTarget.style.color = design.colors.brand.primary;
              e.currentTarget.style.backgroundColor = design.colors.brand.subtle;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.default;
              e.currentTarget.style.color = design.colors.text.secondary;
              e.currentTarget.style.backgroundColor = design.colors.bg.elevated;
            }}
          >
            <Zap className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity icon-zap-wiggle" strokeWidth={2} />
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
