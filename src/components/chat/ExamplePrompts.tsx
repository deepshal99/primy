"use client";

import { FileText, Table2, Presentation } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

// -- Entity pill definitions (for centered hero screen) --

interface EntityPill {
  type: EntityType;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  placeholder: string;
}

const ENTITY_PILLS: EntityPill[] = [
  {
    type: "ku",
    label: "Document",
    icon: FileText,
    color: "#2a6dfb",
    bg: "#f0f4fd",
    border: "#2a6dfb",
    placeholder: "Describe your document...",
  },
  {
    type: "table",
    label: "Spreadsheet",
    icon: Table2,
    color: "#42c366",
    bg: "#e8f7ea",
    border: "#42c366",
    placeholder: "Describe your spreadsheet...",
  },
  {
    type: "deck",
    label: "Presentation",
    icon: Presentation,
    color: "#fa5d19",
    bg: "#fef0e8",
    border: "#fa5d19",
    placeholder: "Describe your presentation...",
  },
];

// -- Sidebar suggestions --
// Context-aware: different for empty vs populated entities.
// These are real, useful things you'd actually want to do.

const ENTITY_CONFIG: Record<
  EntityType,
  { emptySuggestions: string[]; populatedSuggestions: string[] }
> = {
  ku: {
    emptySuggestions: [
      "Draft a project brief for...",
      "Write meeting notes from...",
    ],
    populatedSuggestions: [
      "Summarize the key points",
      "Improve clarity and tone",
    ],
  },
  table: {
    emptySuggestions: [
      "Create a budget tracker for...",
      "Build a task list with...",
    ],
    populatedSuggestions: [
      "Visualize this as a chart",
      "Find patterns in the data",
    ],
  },
  deck: {
    emptySuggestions: [
      "Create a pitch deck about...",
      "Build a quarterly update for...",
    ],
    populatedSuggestions: [
      "Add a new slide about...",
      "Generate speaker notes",
    ],
  },
  page: {
    emptySuggestions: [
      "Turn a document into a visual page...",
      "Design an interactive one-pager for...",
    ],
    populatedSuggestions: [
      "Make it more visual and scannable",
      "Add a stats section and callouts",
    ],
  },
};

// -- Component --

interface ExamplePromptsProps {
  onSelect?: (prompt: string) => void;
  centered?: boolean;
  hasProject?: boolean;
  selectedEntityType?: EntityType | null;
  onEntityTypeSelect?: (type: EntityType | null) => void;
}

export function ExamplePrompts({
  onSelect,
  centered,
  hasProject,
  selectedEntityType,
  onEntityTypeSelect,
}: ExamplePromptsProps) {
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const docContent = useAppStore((s) => s.docContent);
  const sheets = useAppStore((s) => s.sheets);
  const deckSlides = useAppStore((s) => s.deckSlides);
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  // Sidebar mode with project context
  if (hasProject && !centered) {
    // Determine if the current entity has content
    const isEntityEmpty = currentEntityType
      ? {
          ku: !docContent || docContent.trim().length === 0,
          table: !sheets?.[0]?.celldata || sheets[0].celldata.length === 0,
          deck: !deckSlides || deckSlides.length === 0,
          page: !useAppStore.getState().pageHtml || useAppStore.getState().pageHtml.trim().length === 0,
        }[currentEntityType]
      : null;

    // Determine if the project has any meaningful content
    const project = projects.find((p) => p.id === currentProjectId);
    const projectEntityCount = project
      ? project.knowledgeUnits.length +
        project.tables.length +
        (project.decks || []).length
      : 0;

    // Pick suggestions based on context
    let suggestions: string[];

    if (currentEntityType && ENTITY_CONFIG[currentEntityType]) {
      const config = ENTITY_CONFIG[currentEntityType];
      suggestions = isEntityEmpty ? config.emptySuggestions : config.populatedSuggestions;
    } else if (projectEntityCount <= 1) {
      suggestions = [
        "Help me plan a project about...",
        "I need to organize data for...",
      ];
    } else {
      suggestions = [
        "Summarize everything so far",
        "What should I work on next?",
      ];
    }

    // Layout: push pills to bottom, just above the chatbox
    return (
      <div className="flex flex-col justify-end h-full px-4 pb-3">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSelect?.(s)}
              className="px-3 py-[7px] rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] t-fast text-left group active:scale-[0.98]"
            >
              <span className="text-[12px] leading-snug text-[#95928E] group-hover:text-foreground t-colors">
                {s}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Sidebar mode, no project yet: balanced, vertically-centered empty state.
  // Full-width stacked entity cards read better in the narrow chat column than
  // wrapping horizontal pills, and they sit centered instead of pinned to the top.
  if (!centered) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-5 text-center">
        <div className="flex flex-col items-center gap-1 mb-5 animate-fade-in-up">
          <h2 className="font-heading text-[16px] font-semibold text-foreground tracking-[-0.02em]">
            Start something new
          </h2>
          <p className="text-[12.5px] text-[#95928E] leading-relaxed max-w-[240px]">
            Describe what you want below, or pick a format to begin.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 w-full max-w-[230px]">
          {ENTITY_PILLS.map((pill, i) => (
            <button
              key={pill.type}
              onClick={() => onEntityTypeSelect?.(pill.type)}
              style={{ animationDelay: `${60 + i * 45}ms` }}
              className="group animate-fade-in-up flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#ebeae7] bg-white text-[13px] font-medium text-[#525252] hover:text-[#1a1a1a] t-fast active:scale-[0.98] cursor-pointer hover:shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${pill.color}55`)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#ebeae7")}
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 t-fast"
                style={{ backgroundColor: pill.bg }}
              >
                <pill.icon className="w-4 h-4" strokeWidth={1.7} style={{ color: pill.color }} />
              </span>
              {pill.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Centered mode: entity type selector pills (full-screen hero)
  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="text-[12px] text-[#b0ada6] tracking-wide">or start from scratch</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
      {ENTITY_PILLS.map((pill) => {
        const isSelected = selectedEntityType === pill.type;
        return (
          <button
            key={pill.type}
            onClick={() =>
              onEntityTypeSelect?.(isSelected ? null : pill.type)
            }
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[14px] border text-[13px] font-medium t-fast active:scale-[0.98] cursor-pointer",
              isSelected
                ? "shadow-sm"
                : "border-[#e8e8ed] text-[#737373] hover:border-[#dddfe3] hover:text-[#1a1a1a] hover:bg-[#f5f5f3]"
            )}
            style={
              isSelected
                ? {
                    borderColor: pill.border,
                    backgroundColor: pill.bg,
                    color: pill.color,
                  }
                : undefined
            }
          >
            <pill.icon
              className="w-4 h-4"
              strokeWidth={1.6}
              style={isSelected ? { color: pill.color } : undefined}
            />
            {pill.label}
          </button>
        );
      })}
      </div>
    </div>
  );
}

export { ENTITY_PILLS };
export type { EntityPill };
