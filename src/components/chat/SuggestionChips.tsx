"use client";

import { useMemo } from "react";
import { Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";

const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  ku: [
    "Summarize this document",
    "Fix grammar and style",
    "Add a conclusion",
    "Make it more concise",
  ],
  table: [
    "Create a chart from this data",
    "Add a summary row",
    "Analyze trends",
    "Sort by first column",
  ],
  diagram: [
    "Add more detail",
    "Simplify the structure",
    "Explain this diagram",
    "Convert to flowchart",
  ],
  deck: [
    "Add a new slide",
    "Improve slide design",
    "Generate speaker notes",
    "Add a summary slide",
  ],
  default: [
    "Create a new document",
    "Build a spreadsheet",
    "Generate a diagram",
    "Make a presentation",
  ],
};

function getDefaultSuggestions(entityType: EntityType | null): string[] {
  if (entityType && entityType in DEFAULT_SUGGESTIONS) {
    return DEFAULT_SUGGESTIONS[entityType];
  }
  return DEFAULT_SUGGESTIONS.default;
}

interface SuggestionChipsProps {
  suggestions: string[];
}

export function SuggestionChips({ suggestions }: SuggestionChipsProps) {
  const clearSuggestions = useAppStore((s) => s.clearSuggestions);
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  const chips = useMemo(() => {
    if (suggestions.length > 0) return suggestions;
    return getDefaultSuggestions(currentEntityType);
  }, [suggestions, currentEntityType]);

  const handleClick = (suggestion: string) => {
    clearSuggestions();
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: { content: suggestion },
      })
    );
  };

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="Suggested follow-ups">
      {chips.map((suggestion, i) => (
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
