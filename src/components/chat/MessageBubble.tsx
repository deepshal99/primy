"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table2,
  FileText,
  Loader2,
  PenLine,
  Globe,
  RotateCcw,
} from "lucide-react";
import { Message, EntityType } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { MessageAttachments } from "./MessageAttachments";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

function renderContentWithMentions(
  content: string,
  mentionedEntities?: { id: string; type: EntityType; title: string }[],
  isUserBubble?: boolean
): React.ReactNode {
  if (!mentionedEntities || mentionedEntities.length === 0) return content;

  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.length > 0) {
    let earliestIdx = Infinity;
    let matchedEntity: (typeof mentionedEntities)[0] | null = null;
    let matchedPattern = "";

    for (const entity of mentionedEntities) {
      const pattern = `@${entity.title}`;
      const idx = remaining.indexOf(pattern);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
        matchedEntity = entity;
        matchedPattern = pattern;
      }
    }

    if (!matchedEntity || earliestIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    if (earliestIdx > 0) {
      parts.push(remaining.slice(0, earliestIdx));
    }

    if (isUserBubble) {
      // On orange background: white pill with slight opacity
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 font-semibold text-white"
        >
          {matchedPattern}
        </span>
      );
    } else {
      // On white background: use entity bg color with entity text color
      const ENTITY_COLORS: Record<EntityType, { text: string; bg: string }> = {
        ku: { text: "#4a7aed", bg: "#f0f4fd" },
        table: { text: "#2e9e47", bg: "#e8f7ea" },
        deck: { text: "#d4582a", bg: "#fde8dc" },
      };
      const colors = ENTITY_COLORS[matchedEntity.type] || ENTITY_COLORS.ku;
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold"
          style={{ color: colors.text, backgroundColor: colors.bg }}
        >
          {matchedPattern}
        </span>
      );
    }

    remaining = remaining.slice(earliestIdx + matchedPattern.length);
  }

  return parts;
}

interface MessageBubbleProps {
  message: Message;
  isLastAssistant?: boolean;
}

export function MessageBubble({ message, isLastAssistant }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const handleRetry = () => {
    // Find the user message right before this assistant message and re-send it
    const messages = useAppStore.getState().messages;
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx > 0 && messages[idx - 1].role === "user") {
      const userMsg = messages[idx - 1];
      // Remove this assistant message and re-send
      useAppStore.setState({
        messages: messages.slice(0, idx),
      });
      window.dispatchEvent(
        new CustomEvent("drafta:send-message", {
          detail: { content: userMsg.content },
        })
      );
    }
  };

  return (
    <div className={`fade-in-up ${isUser ? "flex justify-end" : ""}`}>
      {isUser ? (
        <div className="max-w-[85%]">
          {/* Attachments above user bubble */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex justify-end mb-1.5">
              <div className="rounded-xl px-3 py-2 bg-muted">
                <MessageAttachments attachments={message.attachments} />
              </div>
            </div>
          )}
          {/* User message bubble */}
          {message.content && (
            <div className="rounded-2xl rounded-br-md bg-[#ff4a00] text-white px-4 py-3 ml-auto w-fit">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-white">
                {renderContentWithMentions(message.content, message.mentionedEntities, true)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-[95%] group/msg">
          {/* AI response with markdown */}
          <div className="text-[13px] leading-[1.7] text-foreground markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Web search sources */}
          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border">
              <Globe className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                Sources
              </span>
              {message.groundingSources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:opacity-80 truncate max-w-[200px] bg-muted text-[#ff4a00]"
                  title={src.uri}
                >
                  {src.title}
                </a>
              ))}
            </div>
          )}

          {/* Interrupted label */}
          {message.interrupted && (
            <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
              <span className="text-[11px] italic">Response interrupted</span>
            </div>
          )}

          {/* Retry — only on the last assistant message */}
          {isLastAssistant && (
            <div className="flex items-center gap-1 mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRetry}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted active:scale-[0.95] t-fast"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Retry
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Streaming Bubble — Thinking / streaming / updating states
   ══════════════════════════════════════════════ */

interface StreamingBubbleProps {
  content: string;
}

export function StreamingBubble({ content }: StreamingBubbleProps) {
  const aiPhase = useAppStore((s) => s.aiPhase);
  const readingFiles = useAppStore((s) => s.readingFiles);

  const hasSheetOps = content.includes("```sheetops");
  const hasDocOps = content.includes("```docops");
  const hasKuOps = content.includes("```kuops");
  const hasTableOps = content.includes("```tableops");
  const hasDeckOps = content.includes("```deckops");
  const hasAnyOps = hasSheetOps || hasDocOps || hasKuOps || hasTableOps || hasDeckOps;

  const displayContent = content
    .replace(/```sheetops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```docops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```kuops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```tableops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```deckops\n[\s\S]*?(\n```|$)/g, "");

  const hasVisibleContent = displayContent.trim().length > 0;

  // Updating phase — show banner
  if (aiPhase === "updating") {
    return (
      <div className="fade-in-up">
        <UpdateIndicator hasOps={{ hasSheetOps, hasDocOps, hasKuOps, hasTableOps, hasDeckOps }} />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {hasVisibleContent ? (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.7] text-foreground markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
          </div>
          {hasAnyOps && (
            <OperationIndicator
              type={hasSheetOps || hasTableOps ? "sheet" : hasDeckOps ? "deck" : "doc"}
            />
          )}
        </div>
      ) : (
        <ThinkingIndicator readingFiles={readingFiles} />
      )}
    </div>
  );
}

/* -- Thinking indicator with shimmer -- */

function ThinkingIndicator({ readingFiles }: { readingFiles: string[] }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (readingFiles.length > 0) return;
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [readingFiles]);

  const labels = ["Thinking", "Analyzing", "Composing"];
  const label =
    readingFiles.length > 0
      ? `Reading ${readingFiles.join(", ")}`
      : labels[phase];

  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="w-4 h-4 flex flex-col items-start justify-center gap-[2.5px] flex-shrink-0">
        <div className="h-[1.5px] rounded-full bg-[#ff4a00]/60 content-loader-line" style={{ width: "100%" }} />
        <div className="h-[1.5px] rounded-full bg-[#ff4a00]/40 content-loader-line" style={{ width: "75%" }} />
        <div className="h-[1.5px] rounded-full bg-[#ff4a00]/25 content-loader-line" style={{ width: "90%" }} />
      </div>
      <span className="text-[13px] font-medium shimmer-text text-muted-foreground">
        {label}...
      </span>
    </div>
  );
}

/* -- Inline operation indicator (during streaming) -- */

function OperationIndicator({ type }: { type: "sheet" | "doc" | "deck" }) {
  const config = {
    sheet: { icon: Table2, label: "Building spreadsheet", color: "#2e9e47", bg: "#e8f7ea" },
    doc: { icon: PenLine, label: "Writing document", color: "#4a7aed", bg: "#f0f4fd" },
    deck: { icon: FileText, label: "Building presentation", color: "#d4582a", bg: "#fde8dc" },
  }[type];
  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ backgroundColor: config.bg }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: config.color }} strokeWidth={2} />
      <span className="text-[12px] font-medium" style={{ color: config.color }}>
        {config.label}
      </span>
      <Loader2 className="w-3 h-3 animate-spin" style={{ color: config.color }} strokeWidth={2} />
    </div>
  );
}

/* -- Update indicator (after streaming finishes, applying ops) -- */

function UpdateIndicator({
  hasOps,
}: {
  hasOps: Record<string, boolean>;
}) {
  const entities: { label: string; color: string; bg: string }[] = [];
  if (hasOps.hasSheetOps || hasOps.hasTableOps)
    entities.push({ label: "Spreadsheet", color: "#2e9e47", bg: "#e8f7ea" });
  if (hasOps.hasDocOps || hasOps.hasKuOps)
    entities.push({ label: "Document", color: "#4a7aed", bg: "#f0f4fd" });
  if (hasOps.hasDeckOps)
    entities.push({ label: "Deck", color: "#d4582a", bg: "#fde8dc" });

  return (
    <div className="flex flex-col gap-0 px-3.5 py-2.5 rounded-xl bg-muted border border-border">
      <div className="flex items-center gap-2.5">
        <div className="w-3.5 h-3.5 flex flex-col items-start justify-center gap-[2px] flex-shrink-0">
          <div className="h-[1.5px] rounded-full bg-[#ff4a00]/60 content-loader-line" style={{ width: "100%" }} />
          <div className="h-[1.5px] rounded-full bg-[#ff4a00]/40 content-loader-line" style={{ width: "70%" }} />
          <div className="h-[1.5px] rounded-full bg-[#ff4a00]/25 content-loader-line" style={{ width: "85%" }} />
        </div>
        <span className="text-[12px] text-muted-foreground font-medium">
          Applying changes...
        </span>
      </div>
      {entities.length > 0 && (
        <div className="flex items-center gap-1.5 ml-[24px] mt-1.5">
          {entities.map((e) => (
            <div
              key={e.label}
              className="flex items-center gap-1 px-2 py-[2px] rounded-md border border-border bg-card"
            >
              <span className="text-[10px] font-medium" style={{ color: e.color }}>
                {e.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
