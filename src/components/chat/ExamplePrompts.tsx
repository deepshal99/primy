"use client";

import { Table2, FileText, GitBranch, Presentation } from "lucide-react";
import { design } from "@/lib/design";

const examples = [
  {
    icon: Table2,
    label: "Content calendar",
    desc: "Plan a month of posts with topics & dates",
    color: design.colors.entity.sheet,
    prompt:
      "Create a content calendar spreadsheet for the next 4 weeks. Columns: Week, Date, Platform (Blog/Twitter/LinkedIn/Instagram), Topic, Status (Draft/Review/Scheduled/Published), Notes. Add 12 example entries across different platforms with realistic content topics.",
  },
  {
    icon: FileText,
    label: "Blog post draft",
    desc: "Write a structured post you can expand on",
    color: design.colors.entity.doc,
    prompt:
      "Write a blog post outline and first draft about the impact of AI tools on everyday productivity. Include an engaging introduction, 4 main sections with 2-3 paragraphs each, practical examples, and a conclusion with a call to action. Make it conversational and informative.",
  },
  {
    icon: Table2,
    label: "Product comparison",
    desc: "Compare options side-by-side in a table",
    color: design.colors.brand.primary,
    prompt:
      "Create a product comparison spreadsheet. Columns: Product Name, Category, Price, Key Features, Pros, Cons, Rating (1-5), Recommendation. Add 5 example products comparing popular project management tools (Notion, Asana, Trello, Monday, ClickUp).",
  },
  {
    icon: FileText,
    label: "Meeting notes",
    desc: "Organize notes with action items & owners",
    color: design.colors.entity.doc,
    prompt:
      "Create a meeting notes template document with: Meeting title, Date, Attendees, Agenda items (3-4 items), Discussion summary for each item, Key decisions made, Action items table (Task, Owner, Due Date, Status), and Next steps. Fill in example content for a product roadmap planning meeting.",
  },
];

interface ExamplePromptsProps {
  onSelect: (prompt: string) => void;
  centered?: boolean;
}

export function ExamplePrompts({ onSelect, centered }: ExamplePromptsProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-full px-5 pb-8 ${centered ? "max-w-[720px] mx-auto w-full" : ""}`}>
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-in">
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-2xl mb-5"
          style={{ backgroundColor: design.colors.brand.primary }}
        >
          <span className="text-white text-[18px] font-bold" style={{ fontFamily: design.typography.family.heading }}>d</span>
        </div>
        <h2
          style={{
            color: design.colors.text.primary,
            fontFamily: design.typography.family.heading,
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "8px",
          }}
        >
          What are you working on?
        </h2>
        <p
          style={{
            color: design.colors.text.muted,
            fontFamily: design.typography.family.sans,
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          Describe what you need — AI will build it.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 w-full max-w-[400px] stagger-children">
        {examples.map((example) => (
          <button
            key={example.label}
            onClick={() => onSelect(example.prompt)}
            className="flex items-center gap-3.5 transition-all duration-150 text-left group animate-fade-in"
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${design.colors.border.default}`,
              borderRadius: "12px",
              padding: "14px 16px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = design.colors.brand.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${design.colors.brand.subtle}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.default;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: design.colors.bg.secondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <example.icon
                style={{ width: "16px", height: "16px", color: example.color }}
                strokeWidth={1.8}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                  marginBottom: "2px",
                }}
              >
                {example.label}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: design.colors.text.muted,
                  fontFamily: design.typography.family.sans,
                }}
              >
                {example.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
