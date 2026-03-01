"use client";

import { PenLine, Lightbulb, FileText, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";

const SUGGESTIONS = [
  {
    icon: PenLine,
    title: "Write a document",
    prompt:
      "Write a compelling introduction that hooks readers and sets the stage for the rest of the document",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm ideas",
    prompt:
      "Brainstorm a list of key topics, themes, and fresh angles I should explore in my writing",
  },
  {
    icon: FileText,
    title: "Analyze data",
    prompt:
      "Create a detailed, structured outline with sections, sub-points, and logical flow",
  },
  {
    icon: Wand2,
    title: "Create something",
    prompt:
      "Help me improve my writing — tighten the tone, sharpen clarity, and polish the language",
  },
];

const PROJECT_SUGGESTIONS = [
  "Summarize this document into an exec overview",
  "Find key insights and action items",
  "Write speaker notes for the presentation",
  "Simplify the content for non-technical readers",
];

interface ExamplePromptsProps {
  onSelect: (prompt: string) => void;
  centered?: boolean;
  hasProject?: boolean;
}

export function ExamplePrompts({ onSelect, centered, hasProject }: ExamplePromptsProps) {
  // Sidebar mode with project context: show compact suggestion pills
  if (hasProject && !centered) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pb-4">
        <div className="text-center mb-6">
          <p className="text-[13px] text-muted-foreground">
            Ask anything about your project
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 w-full">
          {PROJECT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className="px-3 py-[7px] rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] transition-all text-left group active:scale-[0.98]"
            >
              <span className="text-[12px] leading-snug text-muted-foreground group-hover:text-foreground transition-colors">
                {s}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Fullscreen / centered mode: show hero + card grid
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full px-5 pb-8",
        centered && "max-w-[720px] mx-auto w-full"
      )}
    >
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <h2 className="text-display-lg text-foreground mb-2">
          What would you like to write?
        </h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          Start a conversation and I&apos;ll help you draft, edit, or brainstorm.
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-2 w-full max-w-[520px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSelect(s.prompt)}
            className="w-full flex items-start gap-3.5 px-4 py-3.5 rounded-xl border border-border hover:border-[#ff4a00]/30 hover:bg-accent transition-all text-left group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-[#fafaf8] border border-[#f0eee9] flex items-center justify-center flex-shrink-0 group-hover:bg-[#fff4ef] group-hover:border-[#ff4a00]/20 transition-colors">
              <s.icon
                className="w-4 h-4 text-muted-foreground group-hover:text-[#ff4a00] transition-colors"
                strokeWidth={1.8}
              />
            </div>
            <span className="flex-1 min-w-0 text-[13px] text-muted-foreground leading-relaxed pt-1 group-hover:text-foreground transition-colors">
              {s.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
