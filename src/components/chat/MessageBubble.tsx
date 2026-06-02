"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ENTITY_META } from "@/lib/entityMeta";
import {
  Table2,
  FileText,
  Loader2,
  PenLine,
  Globe,
  RotateCcw,
  ListChecks,
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
      const meta = ENTITY_META[matchedEntity.type] || ENTITY_META.ku;
      const colors = { text: meta.color, bg: meta.bg };
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
        new CustomEvent("primy:send-message", {
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
            <div className="rounded-2xl rounded-br-md bg-[var(--accent-soft)] text-[var(--ink)] px-4 py-2.5 ml-auto w-fit">
              <p className="text-[14px] leading-[1.55] whitespace-pre-wrap text-[var(--ink)] [text-wrap:pretty]">
                {renderContentWithMentions(message.content, message.mentionedEntities, false)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-[95%] group/msg">
          {/* AI response with markdown */}
          <div className="markdown-content">
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:opacity-80 truncate max-w-[200px] bg-muted text-[var(--accent-amber-deep)]"
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
  // Layer B: set live while a tool call streams ("doc" | "sheet" | "page").
  const streamingAction = useAppStore((s) => s.streamingAction);

  const hasSheetOps = content.includes("```sheetops");
  const hasDocOps = content.includes("```docops");
  const hasKuOps = content.includes("```kuops");
  const hasTableOps = content.includes("```tableops");
  const hasDeckOps = content.includes("```deckops");
  const hasPageOps = content.includes("```pageops");
  const hasOutline = content.includes("```deckoutline");
  const hasAnyOps = hasSheetOps || hasDocOps || hasKuOps || hasTableOps || hasDeckOps || hasPageOps;

  // Strip EVERY operation/outline block so raw JSON never leaks into the chat
  // while it streams. The `(\n```|$)` tail also catches a block whose closing
  // fence hasn't arrived yet mid-stream (i.e. still being written).
  const displayContent = content
    .replace(/```sheetops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```docops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```kuops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```tableops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```deckops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```pageops\n[\s\S]*?(\n```|$)/g, "")
    .replace(/```deckoutline\n[\s\S]*?(\n```|$)/g, "");

  const hasVisibleContent = displayContent.trim().length > 0;

  // Updating phase — show banner
  if (aiPhase === "updating") {
    return (
      <div className="fade-in-up">
        <UpdateIndicator hasOps={{ hasSheetOps, hasDocOps, hasKuOps, hasTableOps, hasDeckOps, hasPageOps }} />
      </div>
    );
  }

  // An action is streaming ⇒ the AI is actively BUILDING an artifact, via either
  // a Layer B tool call (streamingAction) or a legacy fenced block. Show only
  // the present-tense action indicator — never the prose summary, which the
  // model writes in the past tense ("Created X") and would read as "done" while
  // the work is still in flight. The confirmation prose returns on the final
  // settled message once the artifact actually exists.
  const indicatorType: "sheet" | "doc" | "deck" | "outline" | "page" | null =
    streamingAction === "sheet" || hasSheetOps || hasTableOps
      ? "sheet"
      : streamingAction === "page" || hasPageOps
        ? "page"
        : hasDeckOps
          ? "deck"
          : hasOutline
            ? "outline"
            : streamingAction === "doc" || hasDocOps || hasKuOps
              ? "doc"
              : null;
  if (indicatorType) {
    return (
      <div className="fade-in-up">
        <OperationIndicator type={indicatorType} />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {hasVisibleContent ? (
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayContent}
          </ReactMarkdown>
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
        <div className="h-[1.5px] rounded-full bg-[#FFB43F]/60 content-loader-line" style={{ width: "100%" }} />
        <div className="h-[1.5px] rounded-full bg-[#FFB43F]/40 content-loader-line" style={{ width: "75%" }} />
        <div className="h-[1.5px] rounded-full bg-[#FFB43F]/25 content-loader-line" style={{ width: "90%" }} />
      </div>
      <span className="text-[13px] font-medium shimmer-text text-muted-foreground">
        {label}...
      </span>
    </div>
  );
}

/* -- Inline operation indicator (during streaming) -- */

function OperationIndicator({ type }: { type: "sheet" | "doc" | "deck" | "outline" | "page" }) {
  const config = {
    sheet: { icon: Table2, label: "Building spreadsheet", color: "#2e9e47", bg: "rgba(46,158,71,0.14)" },
    doc: { icon: PenLine, label: "Writing document", color: "#4a7aed", bg: "rgba(74,122,237,0.14)" },
    deck: { icon: FileText, label: "Building presentation", color: "#FFAD45", bg: "rgba(255,173,69,0.16)" },
    outline: { icon: ListChecks, label: "Planning slides", color: "#FFAD45", bg: "rgba(255,173,69,0.16)" },
    page: { icon: FileText, label: "Designing page", color: "#8757D7", bg: "rgba(135,87,215,0.14)" },
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
    entities.push({ label: "Spreadsheet", color: "#2e9e47", bg: "rgba(46,158,71,0.14)" });
  if (hasOps.hasDocOps || hasOps.hasKuOps)
    entities.push({ label: "Document", color: "#4a7aed", bg: "rgba(74,122,237,0.14)" });
  if (hasOps.hasDeckOps)
    entities.push({ label: "Deck", color: "#FFAD45", bg: "rgba(255,173,69,0.16)" });
  if (hasOps.hasPageOps)
    entities.push({ label: "Page", color: "#8757D7", bg: "rgba(135,87,215,0.14)" });

  return (
    <div className="flex flex-col gap-0 px-3.5 py-2.5 rounded-xl bg-muted border border-border">
      <div className="flex items-center gap-2.5">
        <div className="w-3.5 h-3.5 flex flex-col items-start justify-center gap-[2px] flex-shrink-0">
          <div className="h-[1.5px] rounded-full bg-[#FFB43F]/60 content-loader-line" style={{ width: "100%" }} />
          <div className="h-[1.5px] rounded-full bg-[#FFB43F]/40 content-loader-line" style={{ width: "70%" }} />
          <div className="h-[1.5px] rounded-full bg-[#FFB43F]/25 content-loader-line" style={{ width: "85%" }} />
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
