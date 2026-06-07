"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ENTITY_META } from "@/lib/entityMeta";
import {
  Globe,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { Message, EntityType } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { MessageAttachments } from "./MessageAttachments";
import { ArtifactWidgetList } from "./ArtifactWidget";
import { StreamPhases } from "./StreamPhases";
import { inferStreamTask, taskFromOp } from "@/lib/streamPhases";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

function renderContentWithMentions(
  content: string,
  mentionedEntities?: { id: string; type: EntityType; title: string }[]
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

    // Card fill + a thin entity-colored hairline so the chip stays crisp on the
    // grey user bubble (the pale entity tint washed out against it). Ink text +
    // colored icon keeps it legible and type-identifiable.
    const meta = ENTITY_META[matchedEntity.type] || ENTITY_META.ku;
    const MentionIcon = meta.Icon;
    parts.push(
      <span
        key={key++}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium text-foreground align-baseline border"
        style={{ backgroundColor: "var(--card)", borderColor: `${meta.color}45` }}
      >
        <MentionIcon className="w-3 h-3 shrink-0" strokeWidth={1.8} style={{ color: meta.color }} aria-hidden />
        {matchedEntity.title}
      </span>
    );

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

  const handleContinue = () => {
    // Pick up an interrupted/truncated turn. The model gets the prior turns as
    // context, so a plain continuation request resumes cleanly.
    window.dispatchEvent(
      new CustomEvent("primy:send-message", {
        detail: { content: "Continue from where you left off." },
      })
    );
  };

  return (
    <div className={`fade-in-up ${isUser ? "flex justify-end" : ""}`}>
      {isUser ? (
        <div className="flex flex-col items-end max-w-[82%]">
          {/* Attachments above user bubble — self-contained card pills,
              right-aligned to hug the bubble's trailing edge. */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-1.5 flex flex-wrap justify-end">
              <MessageAttachments attachments={message.attachments} />
            </div>
          )}
          {/* User message bubble */}
          {message.content && (
            <div className="rounded-2xl rounded-br-md bg-[var(--accent-soft)] text-[var(--ink)] px-4 py-2.5 w-fit">
              <p className="text-[14.5px] leading-[1.55] whitespace-pre-wrap text-[var(--ink)] [text-wrap:pretty]">
                {renderContentWithMentions(message.content, message.mentionedEntities)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-[90%] group/msg">
          {/* AI response with markdown */}
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Artifact widgets — entities this turn created/updated */}
          {message.producedEntities && message.producedEntities.length > 0 && (
            <ArtifactWidgetList
              entities={message.producedEntities}
              pulse={isLastAssistant}
            />
          )}

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

          {/* Incomplete-response acknowledgment + one-click continue. Never just
              stop midway silently: if the turn was cut off (truncated) or stopped
              (interrupted), say so and offer to pick up where it left off. */}
          {(message.interrupted || message.truncated) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                {message.truncated ? "This response was cut off." : "Response stopped."}
              </span>
              {isLastAssistant && (
                <button
                  onClick={handleContinue}
                  className="inline-flex items-center gap-1 h-7 pl-2.5 pr-2 rounded-full text-[12px] font-medium press hover-row"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-amber-deep, #B87426)" }}
                >
                  Continue
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                </button>
              )}
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
  // The active project's last user prompt — used to GUESS the task for the
  // phased loader until a real operation block confirms it.
  const lastUserText = useAppStore((s) => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      if (s.messages[i].role === "user") return s.messages[i].content;
    }
    return "";
  });

  const hasSheetOps = content.includes("```sheetops");
  const hasDocOps = content.includes("```docops");
  const hasKuOps = content.includes("```kuops");
  const hasTableOps = content.includes("```tableops");
  const hasDeckOps = content.includes("```deckops");
  const hasPageOps = content.includes("```pageops");
  const hasOutline = content.includes("```deckoutline");

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
    .replace(/```deckoutline\n[\s\S]*?(\n```|$)/g, "")
    // The suggestions block (an HTML-looking <suggestions>…</suggestions> tag)
    // streams in near the end. Strip it live — including a not-yet-closed one
    // and a half-typed opening tag — so it never flashes at the bottom.
    .replace(/<suggestions>[\s\S]*?(<\/suggestions>|$)/g, "")
    .replace(/<\/?sugg[a-z]*$/i, "");

  const hasVisibleContent = displayContent.trim().length > 0;

  // Updating phase — show banner
  if (aiPhase === "updating") {
    return (
      <div className="fade-in-up">
        <UpdateIndicator hasOps={{ hasSheetOps, hasDocOps, hasKuOps, hasTableOps, hasDeckOps, hasPageOps }} />
      </div>
    );
  }

  // The real "building an artifact" signal: a Layer B tool call is streaming, or
  // an operation/outline block has appeared in the text.
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

  // Task guess from the prompt, used until a real op block confirms the type.
  const guessed = inferStreamTask(lastUserText);

  // Reveal streaming prose ONLY for plain-answer turns — there, the text IS the
  // final answer being typed live. For turns that will produce an artifact
  // (deck/doc/sheet/page), the model streams a short prose preamble *before* the
  // op block; showing it would flash text and then snap back to the loader once
  // the fence arrives (loading -> typing -> loading). So we hold the phased
  // loader the whole way through and let the artifact's prose reply render from
  // the final message once the turn completes.
  if (hasVisibleContent && !indicatorType && guessed === "answer") {
    return (
      <div className="fade-in-up">
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Otherwise: the task-aware phased loader. Task is the real op type when known,
  // else the guess from the prompt. The final "building" step only activates
  // once a real op is detected (outputStarted), so we never claim it early.
  const task = taskFromOp(indicatorType) ?? guessed;
  const outputStarted = !!indicatorType;

  return (
    <div className="fade-in-up">
      <StreamPhases task={task} readingFiles={readingFiles} outputStarted={outputStarted} />
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
