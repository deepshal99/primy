"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table2,
  FileText,
  Loader2,
  PenLine,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { Message } from "@/lib/types";
import { design } from "@/lib/design";
import { useAppStore } from "@/lib/store";
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
        <div className="max-w-[85%]">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex justify-end mb-1.5">
              <div
                className="rounded-xl px-3 py-2"
                style={{ backgroundColor: design.colors.bg.tertiary }}
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
              <p className="text-body whitespace-pre-wrap">{message.content}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-full group/msg">
          <div className="text-body markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Interrupted label */}
          {message.interrupted && (
            <div
              className="flex items-center gap-1 mt-1.5"
              style={{ color: design.colors.text.muted }}
            >
              <span className="text-[11px] italic">Response interrupted</span>
            </div>
          )}

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
   Streaming Bubble — Clean, contextual loading
   ══════════════════════════════════════════════ */

interface StreamingBubbleProps {
  content: string;
}

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
        <ThinkingIndicator />
      )}
    </div>
  );
}

/* ── Clean thinking indicator ── */

function ThinkingIndicator() {
  const readingFiles = useAppStore((s) => s.readingFiles);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (readingFiles.length > 0) return;
    const t1 = setTimeout(() => setPhase(1), 3000);
    const t2 = setTimeout(() => setPhase(2), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [readingFiles]);

  const labels = ["Thinking", "Analyzing", "Composing"];
  const label = readingFiles.length > 0
    ? `Reading ${readingFiles.join(", ")}`
    : labels[phase];

  return (
    <div className="flex items-center gap-2.5 py-1">
      <Loader2
        className="w-4 h-4 animate-spin flex-shrink-0"
        style={{ color: design.colors.text.muted }}
        strokeWidth={2}
      />
      <span
        className="text-[13px] font-medium shimmer-text"
        style={{ color: design.colors.text.secondary }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Inline operation indicator ── */

function OperationIndicator({ type }: { type: "sheet" | "doc" }) {
  const isSheet = type === "sheet";
  const Icon = isSheet ? Table2 : PenLine;
  const label = isSheet ? "Building spreadsheet" : "Writing document";
  const accentColor = isSheet ? design.colors.accent.teal : design.colors.accent.purple;
  const accentBg = isSheet ? design.colors.accent.tealSubtle : design.colors.accent.purpleSubtle;

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl animate-fade-in"
      style={{ backgroundColor: accentBg }}
    >
      <Icon
        className="w-3.5 h-3.5"
        style={{ color: accentColor }}
        strokeWidth={2}
      />
      <span className="text-[12px] font-medium" style={{ color: accentColor }}>
        {label}
      </span>
      <Loader2
        className="w-3 h-3 animate-spin"
        style={{ color: accentColor }}
        strokeWidth={2}
      />
    </div>
  );
}
