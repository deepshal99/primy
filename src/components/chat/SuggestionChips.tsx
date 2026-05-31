"use client";

import { useMemo } from "react";
import {
  FileText,
  Table2,
  Presentation,
  Sparkles,
  PenLine,
  BarChart3,
  ListChecks,
  Wand2,
  MessageSquareText,
  Layers,
  ArrowRight,
  LayoutGrid,
  Search,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";

// -- Icon detection based on suggestion content keywords --

const ICON_RULES: { keywords: string[]; icon: LucideIcon }[] = [
  // Entity-specific (check first — most distinctive)
  { keywords: ["slide", "deck", "presentation"], icon: Presentation },
  { keywords: ["table", "spreadsheet", "row", "column", "sort"], icon: Table2 },
  { keywords: ["document", "doc", "page", "section"], icon: FileText },
  // Content actions
  { keywords: ["summarize", "summary", "overview", "recap", "key points"], icon: ListChecks },
  { keywords: ["chart", "graph", "visualize", "plot"], icon: BarChart3 },
  { keywords: ["write", "draft", "compose", "rewrite", "speaker notes", "notes"], icon: PenLine },
  { keywords: ["explain", "describe", "break down", "step by step"], icon: MessageSquareText },
  { keywords: ["improve", "enhance", "polish", "fix", "refine", "clean", "clarity"], icon: Wand2 },
  { keywords: ["simplify", "reduce", "shorten", "concise"], icon: Layers },
  { keywords: ["convert", "transform", "export", "format"], icon: ArrowRight },
  { keywords: ["analyze", "find", "search", "pattern", "trend", "insight", "data"], icon: Search },
  { keywords: ["layout", "arrange", "organize", "grid"], icon: LayoutGrid },
  { keywords: ["idea", "suggest", "brainstorm", "think"], icon: Lightbulb },
  // Generic creation (last — catches "create", "build", "generate", "add", "new")
  { keywords: ["add", "insert", "create", "new", "build", "generate"], icon: Sparkles },
];

function getIconForSuggestion(text: string): LucideIcon {
  const lower = text.toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.icon;
    }
  }
  return Sparkles;
}

// -- Default suggestions: sensible, variable count --

const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  ku: [
    "Summarize the key points",
    "Improve clarity and tone",
  ],
  table: [
    "Visualize this data as a chart",
    "Find patterns and outliers",
  ],
  deck: [
    "Add a new slide",
    "Generate speaker notes",
  ],
  default: [
    "Create a document",
    "Build a spreadsheet",
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
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Suggested follow-ups">
      {chips.map((suggestion, i) => {
        const Icon = getIconForSuggestion(suggestion);
        return (
          <button
            key={i}
            onClick={() => handleClick(suggestion)}
            className="group flex items-center gap-1.5 px-3 py-[7px] rounded-xl border border-[#e8e7e4] text-[12px] leading-snug text-[#737373] font-medium t-fast hover:border-[#FFB43F]/40 hover:text-[#B87426] hover:bg-[rgba(255,180,63,0.08)] text-left w-fit animate-fade-in active:scale-[0.98]"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            role="listitem"
          >
            <Icon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-90 transition-opacity flex-shrink-0" strokeWidth={1.8} />
            {suggestion}
          </button>
        );
      })}
    </div>
  );
}
