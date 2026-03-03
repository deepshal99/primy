"use client";

import {
  PenLine,
  Lightbulb,
  FileText,
  Wand2,
  BarChart3,
  TableProperties,
  TrendingUp,
  Filter,
  GitBranch,
  Minimize2,
  MessageSquare,
  Repeat,
  PlusCircle,
  Palette,
  StickyNote,
  LayoutList,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

// -- Prompt definitions per entity type --

interface PromptItem {
  icon: LucideIcon;
  title: string;
  prompt: string;
}

const GENERIC_PROMPTS: PromptItem[] = [
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
      "Help me improve my writing \u2014 tighten the tone, sharpen clarity, and polish the language",
  },
];

const ENTITY_PROMPTS: Record<EntityType, PromptItem[]> = {
  ku: [
    {
      icon: Wand2,
      title: "Polish writing",
      prompt: "Fix grammar, tighten the tone, and improve clarity throughout this document",
    },
    {
      icon: FileText,
      title: "Summarize",
      prompt: "Summarize this document into a concise executive overview with key takeaways",
    },
    {
      icon: PenLine,
      title: "Expand content",
      prompt: "Add more detail and depth to the existing sections of this document",
    },
    {
      icon: Lightbulb,
      title: "Add a conclusion",
      prompt: "Write a strong conclusion that ties together the main points and ends with a clear call to action",
    },
  ],
  table: [
    {
      icon: BarChart3,
      title: "Visualize data",
      prompt: "Create a chart that best represents the trends and patterns in this spreadsheet",
    },
    {
      icon: TableProperties,
      title: "Add summary row",
      prompt: "Add a summary row with totals, averages, or other aggregate values for each column",
    },
    {
      icon: TrendingUp,
      title: "Analyze trends",
      prompt: "Analyze the data in this spreadsheet and highlight the most significant trends and outliers",
    },
    {
      icon: Filter,
      title: "Clean and organize",
      prompt: "Sort the data, remove duplicates, and organize the spreadsheet for easier reading",
    },
  ],
  diagram: [
    {
      icon: GitBranch,
      title: "Add detail",
      prompt: "Add more nodes, branches, and detail to make this diagram more comprehensive",
    },
    {
      icon: Minimize2,
      title: "Simplify",
      prompt: "Simplify this diagram by removing unnecessary complexity while keeping the core structure",
    },
    {
      icon: MessageSquare,
      title: "Explain it",
      prompt: "Explain what this diagram represents in plain language with a step-by-step walkthrough",
    },
    {
      icon: Repeat,
      title: "Convert format",
      prompt: "Convert this diagram into a different format \u2014 try a flowchart, sequence diagram, or mind map",
    },
  ],
  deck: [
    {
      icon: PlusCircle,
      title: "Add a slide",
      prompt: "Add a new slide that continues the narrative and fits the existing deck structure",
    },
    {
      icon: Palette,
      title: "Improve design",
      prompt: "Improve the visual design of the slides \u2014 better layout, typography, and visual hierarchy",
    },
    {
      icon: StickyNote,
      title: "Speaker notes",
      prompt: "Generate detailed speaker notes for each slide with key talking points and transitions",
    },
    {
      icon: LayoutList,
      title: "Summary slide",
      prompt: "Add a summary slide at the end that recaps the key points from the entire presentation",
    },
  ],
};

// -- Compact pills for sidebar with project context --

const GENERIC_PROJECT_PILLS = [
  "Summarize this document into an exec overview",
  "Find key insights and action items",
  "Write speaker notes for the presentation",
  "Simplify the content for non-technical readers",
];

const ENTITY_PROJECT_PILLS: Record<EntityType, string[]> = {
  ku: [
    "Summarize this document",
    "Fix grammar and improve clarity",
    "Add more detail to each section",
    "Rewrite for a different audience",
  ],
  table: [
    "Chart the most important data",
    "Add totals and averages",
    "Find patterns and outliers",
    "Format and clean up the data",
  ],
  diagram: [
    "Explain this diagram step by step",
    "Add more nodes and connections",
    "Simplify the structure",
    "Convert to a different format",
  ],
  deck: [
    "Add a new slide to the deck",
    "Generate speaker notes",
    "Improve the slide design",
    "Create a summary slide",
  ],
};

// -- Component --

interface ExamplePromptsProps {
  onSelect: (prompt: string) => void;
  centered?: boolean;
  hasProject?: boolean;
}

export function ExamplePrompts({ onSelect, centered, hasProject }: ExamplePromptsProps) {
  const currentEntityType = useAppStore((s) => s.currentEntityType);

  // Sidebar mode with project context: show compact suggestion pills
  if (hasProject && !centered) {
    const pills = currentEntityType
      ? ENTITY_PROJECT_PILLS[currentEntityType]
      : GENERIC_PROJECT_PILLS;

    const contextLabel = currentEntityType
      ? {
          ku: "Ask about this document",
          table: "Ask about this spreadsheet",
          diagram: "Ask about this diagram",
          deck: "Ask about this deck",
        }[currentEntityType]
      : "Ask anything about your project";

    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pb-4">
        <div className="text-center mb-6">
          <p className="text-[13px] text-muted-foreground">
            {contextLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 w-full">
          {pills.map((s) => (
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
  const prompts = currentEntityType
    ? ENTITY_PROMPTS[currentEntityType]
    : GENERIC_PROMPTS;

  const heroText = currentEntityType
    ? {
        ku: "What would you like to do with this document?",
        table: "What would you like to do with this spreadsheet?",
        diagram: "What would you like to do with this diagram?",
        deck: "What would you like to do with this deck?",
      }[currentEntityType]
    : "What would you like to write?";

  const heroSubtext = currentEntityType
    ? {
        ku: "I can help you write, edit, summarize, or restructure your document.",
        table: "I can help you analyze, visualize, and organize your data.",
        diagram: "I can help you refine, explain, or transform your diagram.",
        deck: "I can help you design slides, add content, and polish your presentation.",
      }[currentEntityType]
    : "Start a conversation and I\u2019ll help you draft, edit, or brainstorm.";

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
          {heroText}
        </h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          {heroSubtext}
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-2 w-full max-w-[520px]">
        {prompts.map((s) => (
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
