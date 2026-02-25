"use client";

import { Table2, FileText, Pen } from "lucide-react";
import { design } from "@/lib/design";

const examples = [
  {
    icon: Table2,
    label: "Content calendar",
    desc: "Plan a month of posts with topics & dates",
    accentColor: design.colors.accent.teal,
    accentBg: design.colors.accent.tealSubtle,
    prompt:
      "Create a content calendar spreadsheet for the next 4 weeks. Columns: Week, Date, Platform (Blog/Twitter/LinkedIn/Instagram), Topic, Status (Draft/Review/Scheduled/Published), Notes. Add 12 example entries across different platforms with realistic content topics.",
  },
  {
    icon: FileText,
    label: "Blog post draft",
    desc: "Write a structured post you can expand on",
    accentColor: design.colors.accent.purple,
    accentBg: design.colors.accent.purpleSubtle,
    prompt:
      "Write a blog post outline and first draft about the impact of AI tools on everyday productivity. Include an engaging introduction, 4 main sections with 2-3 paragraphs each, practical examples, and a conclusion with a call to action. Make it conversational and informative.",
  },
  {
    icon: Table2,
    label: "Product comparison",
    desc: "Compare options side-by-side in a table",
    accentColor: design.colors.accent.gold,
    accentBg: design.colors.accent.goldSubtle,
    prompt:
      "Create a product comparison spreadsheet. Columns: Product Name, Category, Price, Key Features, Pros, Cons, Rating (1-5), Recommendation. Add 5 example products comparing popular project management tools (Notion, Asana, Trello, Monday, ClickUp).",
  },
  {
    icon: FileText,
    label: "Meeting notes",
    desc: "Organize notes with action items & owners",
    accentColor: design.colors.brand.primary,
    accentBg: design.colors.brand.subtle,
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
    <div className={`flex flex-col items-center justify-center h-full px-6 pb-8 ${centered ? "max-w-[720px] mx-auto w-full" : ""}`}>
      {/* Hero */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Pen className="w-5 h-5" style={{ color: design.colors.accent.gold }} strokeWidth={1.5} />
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
            color: design.colors.text.secondary,
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          Describe your content and AI will build it in a sheet or doc.
        </p>
      </div>

      {/* Example Cards — Conversion.ai row card style */}
      <div className="flex flex-col gap-2.5 w-full max-w-[480px] stagger-children">
        {examples.map((example) => (
          <button
            key={example.label}
            onClick={() => onSelect(example.prompt)}
            className="flex items-center gap-4 transition-all duration-200 text-left group animate-fade-in"
            style={{
              backgroundColor: design.colors.bg.elevated,
              border: `1.5px solid ${design.colors.border.default}`,
              borderRadius: "14px",
              padding: "14px 18px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.focus;
              e.currentTarget.style.boxShadow = design.shadows.md;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.default;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Icon badge — square with rounded corners */}
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: example.accentBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "transform 200ms ease",
              }}
              className="group-hover:scale-105"
            >
              <example.icon
                style={{ width: "20px", height: "20px", color: example.accentColor }}
                strokeWidth={1.8}
              />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "15px",
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
                  fontSize: "13px",
                  fontWeight: 400,
                  color: design.colors.text.muted,
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
