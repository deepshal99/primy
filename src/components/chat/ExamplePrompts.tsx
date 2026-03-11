"use client";

import { FileText, Table2, GitBranch, Presentation } from "lucide-react";
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
    color: "#4a7aed",
    bg: "#f0f4fd",
    border: "#4a7aed",
    placeholder: "Describe your document...",
  },
  {
    type: "table",
    label: "Spreadsheet",
    icon: Table2,
    color: "#2e9e47",
    bg: "#e8f7ea",
    border: "#2e9e47",
    placeholder: "Describe your spreadsheet...",
  },
  {
    type: "diagram",
    label: "Diagram",
    icon: GitBranch,
    color: "#7c5cb8",
    bg: "#f3eefa",
    border: "#7c5cb8",
    placeholder: "Describe your diagram...",
  },
  {
    type: "deck",
    label: "Presentation",
    icon: Presentation,
    color: "#d4582a",
    bg: "#fef0e8",
    border: "#d4582a",
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
  diagram: {
    emptySuggestions: [
      "Draw a user signup flow",
      "Map out an API architecture",
    ],
    populatedSuggestions: [
      "Explain this step by step",
      "Add more detail to the flow",
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
  const diagramSource = useAppStore((s) => s.diagramSource);
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
          diagram: !diagramSource || diagramSource.trim().length === 0,
          deck: !deckSlides || deckSlides.length === 0,
        }[currentEntityType]
      : null;

    // Determine if the project has any meaningful content
    const project = projects.find((p) => p.id === currentProjectId);
    const projectEntityCount = project
      ? project.knowledgeUnits.length +
        project.tables.length +
        (project.diagrams || []).length +
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

  // Centered mode: entity type selector pills (hero screen)
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
