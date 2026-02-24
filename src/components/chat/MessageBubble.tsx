"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table2,
  FileText,
  Loader2,
  CheckCircle2,
  Brain,
  Search,
  ListChecks,
  PenLine,
  Lightbulb,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { Message } from "@/lib/types";
import { design } from "@/lib/design";
import { MessageAttachments } from "./MessageAttachments";

interface MessageBubbleProps {
  message: Message;
  isLastAssistant?: boolean;
}

export function MessageBubble({ message, isLastAssistant }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToDoc = () => {
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: {
          content: `Put this content into the document:\n\n${message.content}`,
        },
      })
    );
  };

  const handleSendToSheet = () => {
    window.dispatchEvent(
      new CustomEvent("drafta:send-message", {
        detail: {
          content: `Organize this data into a spreadsheet:\n\n${message.content}`,
        },
      })
    );
  };

  return (
    <div className={`animate-fade-in ${isUser ? "flex justify-end" : ""}`}>
      {isUser ? (
        /* ── User message ── */
        <div className="max-w-[85%]">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex justify-end mb-1.5">
              <div
                className="rounded-xl px-3 py-2"
                style={{
                  backgroundColor: design.colors.bg.tertiary,
                }}
              >
                <MessageAttachments attachments={message.attachments} />
              </div>
            </div>
          )}
          {message.content && (
            <div
              className="rounded-2xl rounded-tr-md px-4 py-3 ml-auto w-fit"
              style={{
                backgroundColor: design.colors.bg.tertiary,
                color: design.colors.text.primary,
              }}
            >
              <p className="text-body whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ── Assistant message — ChatGPT-style, just text ── */
        <div className="max-w-full group/msg">
          <div className="text-body markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Action buttons — visible on hover */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-label transition-all duration-200 icon-btn-hover"
              style={{ color: design.colors.text.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.secondary; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 icon-copy-success" style={{ color: design.colors.status.success }} />
              ) : (
                <Copy className="w-3 h-3 transition-transform duration-200" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={handleSendToSheet}
              className="group flex items-center gap-1 px-2 py-1 rounded-md text-label transition-all duration-200 icon-btn-hover"
              style={{ color: design.colors.text.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.secondary; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              title="Send to spreadsheet"
            >
              <Table2 className="w-3 h-3" />
              <ArrowRight className="w-2.5 h-2.5 icon-nudge-right" />
              Sheet
            </button>
            <button
              onClick={handleSendToDoc}
              className="group flex items-center gap-1 px-2 py-1 rounded-md text-label transition-all duration-200 icon-btn-hover"
              style={{ color: design.colors.text.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.secondary; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              title="Send to document"
            >
              <FileText className="w-3 h-3" />
              <ArrowRight className="w-2.5 h-2.5 icon-nudge-right" />
              Doc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Streaming Bubble — Cascade-style step loading
   ══════════════════════════════════════════════ */

interface StreamingBubbleProps {
  content: string;
}

const THINKING_STEPS = [
  { icon: Brain, label: "Thinking", delay: 0 },
  { icon: Search, label: "Analyzing your request", delay: 1200 },
  { icon: Lightbulb, label: "Planning approach", delay: 3000 },
  { icon: ListChecks, label: "Preparing response", delay: 5000 },
];

const SHEET_STEPS = [
  { icon: Brain, label: "Thinking", delay: 0 },
  { icon: Search, label: "Analyzing data needs", delay: 1000 },
  { icon: Table2, label: "Building spreadsheet", delay: 2500 },
  { icon: PenLine, label: "Adding data", delay: 4000 },
];

const DOC_STEPS = [
  { icon: Brain, label: "Thinking", delay: 0 },
  { icon: Lightbulb, label: "Organizing ideas", delay: 1000 },
  { icon: PenLine, label: "Writing content", delay: 2500 },
  { icon: FileText, label: "Formatting document", delay: 4000 },
];

export function StreamingBubble({ content }: StreamingBubbleProps) {
  const hasSheetOps = content.includes("```sheetops");
  const hasDocOps = content.includes("```docops");
  const hasKuOps = content.includes("```kuops");
  const hasTableOps = content.includes("```tableops");

  const displayContent = content
    .replace(/```sheetops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```docops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```kuops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```tableops\n[\s\S]*?(\n```|$)/g, "");

  const hasVisibleContent = displayContent.trim().length > 0;

  return (
    <div className="animate-fade-in">
      {hasVisibleContent ? (
        <div className="space-y-3">
          <div className="text-body markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
          </div>
          {(hasSheetOps || hasDocOps || hasKuOps || hasTableOps) && (
            <OperationIndicator type={hasSheetOps || hasTableOps ? "sheet" : "doc"} />
          )}
        </div>
      ) : (
        <StepLoadingIndicator
          steps={hasSheetOps || hasTableOps ? SHEET_STEPS : hasDocOps || hasKuOps ? DOC_STEPS : THINKING_STEPS}
        />
      )}
    </div>
  );
}

/* ── Cascade-style step loading indicator ── */

function StepLoadingIndicator({
  steps,
}: {
  steps: { icon: typeof Brain; label: string; delay: number }[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((step, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setActiveIndex(i), step.delay));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="flex flex-col gap-0.5 stagger-children">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === activeIndex;
        const isComplete = i < activeIndex;

        return (
          <div
            key={i}
            className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all duration-300 animate-fade-in`}
            style={{
              animationDelay: `${i * 60}ms`,
              backgroundColor: isActive ? design.colors.bg.secondary : "transparent",
            }}
          >
            {/* Step icon */}
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {isComplete ? (
                <CheckCircle2
                  className="w-4 h-4 icon-copy-success"
                  style={{ color: design.colors.step.complete }}
                  strokeWidth={2}
                />
              ) : isActive ? (
                <Icon
                  className="w-4 h-4 icon-draw"
                  style={{ color: design.colors.step.active }}
                  strokeWidth={1.5}
                />
              ) : (
                <Icon
                  className="w-4 h-4"
                  style={{ color: design.colors.step.pending }}
                  strokeWidth={1.5}
                />
              )}
            </div>

            {/* Label */}
            <span
              className={`text-body-sm transition-colors duration-300 ${
                isActive ? "font-medium" : ""
              }`}
              style={{
                color: isComplete
                  ? design.colors.text.secondary
                  : isActive
                  ? design.colors.text.primary
                  : design.colors.text.muted,
              }}
            >
              {step.label}
            </span>

            {/* Active spinner */}
            {isActive && (
              <Loader2
                className="w-3 h-3 animate-spin ml-auto"
                style={{ color: design.colors.accent.gold }}
                strokeWidth={2}
              />
            )}

            {/* Complete checkmark text */}
            {isComplete && (
              <CheckCircle2
                className="w-3 h-3 ml-auto icon-copy-success"
                style={{ color: design.colors.step.complete }}
                strokeWidth={2}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Inline operation indicator ── */

function OperationIndicator({ type }: { type: "sheet" | "doc" }) {
  const Icon = type === "sheet" ? Table2 : FileText;
  const label = type === "sheet" ? "Updating spreadsheet" : "Writing document";
  const accentColor = type === "sheet" ? design.colors.accent.teal : design.colors.accent.purple;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border animate-fade-in"
      style={{
        borderColor: design.colors.border.default,
        backgroundColor: design.colors.bg.secondary,
      }}
    >
      <Icon
        className="w-3.5 h-3.5 icon-draw"
        style={{ color: accentColor }}
        strokeWidth={1.5}
      />
      <span className="text-ui-sm" style={{ color: design.colors.text.secondary }}>
        {label}
      </span>
      <Loader2
        className="w-3 h-3 animate-spin ml-auto"
        style={{ color: design.colors.accent.gold }}
        strokeWidth={2}
      />
    </div>
  );
}
