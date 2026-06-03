"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { LogoMark } from "@/components/shared/Logo";
import { useAppStore } from "@/lib/store";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";
import { Skeleton } from "@/components/ui/skeleton";

const MESSAGES_PER_PAGE = 50;

const STARTER_SUGGESTIONS = [
  "/proposal: draft a one-pager for…",
  "/brief: outline a project brief…",
  "/deck: pitch deck for…",
  "/sheet: tracker for…",
];

function MessageListLoading() {
  // Skeleton bubbles — alternates assistant (left) / user (right)
  const rows: Array<{ side: "left" | "right"; widths: number[] }> = [
    { side: "right", widths: [60] },
    { side: "left", widths: [88, 72, 50] },
    { side: "right", widths: [55, 40] },
    { side: "left", widths: [80, 90, 65] },
  ];
  return (
    <div
      className="flex flex-col gap-5 px-4 py-4"
      aria-label="Loading messages"
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className={
            row.side === "right"
              ? "flex flex-col items-end gap-1.5"
              : "flex flex-col items-start gap-1.5"
          }
        >
          <div
            className={
              row.side === "right"
                ? "max-w-[82%] bg-accent-soft rounded-2xl rounded-br-md px-4 py-2.5"
                : "max-w-[90%] px-1 py-1"
            }
            style={{
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div className="flex flex-col gap-2">
              {row.widths.map((w, j) => (
                <Skeleton
                  key={j}
                  className="h-[10px] rounded-[3px]"
                  style={{
                    width: `${w * 2.4}px`,
                    backgroundColor:
                      row.side === "right"
                        ? "var(--accent-soft)"
                        : "var(--muted)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageListEmpty({
  onSelect,
}: {
  onSelect?: (prompt: string) => void;
}) {
  // Trigger send via global event handled by ChatPanel
  const handleClick = (text: string) => {
    if (onSelect) {
      onSelect(text);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("primy:send-message", { detail: { content: text } })
    );
  };

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      {/* Spark / chat illustration */}
      <div
        className="relative w-12 h-12 mb-4 flex items-center justify-center rounded-2xl bg-[rgba(255,180,63,0.06)] border border-[rgba(255,180,63,0.10)]"
        aria-hidden
      >
        <LogoMark size={22} style={{ color: "var(--ink, #171716)" }} />
        {/* Pulse ring */}
        <span
          className="absolute inset-0 rounded-2xl border border-[rgba(255,180,63,0.18)] animate-ping"
          style={{ animationDuration: "2.4s" }}
        />
      </div>

      <h3 className="text-[15px] font-medium text-foreground mb-1 font-heading tracking-[-0.01em]">
        Start a conversation
      </h3>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-[280px] mb-5">
        Ask anything, paste a brief, or use one of the slash commands below.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[320px] stagger-children">
        {STARTER_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleClick(s.replace(/:.*$/, "").trim())}
            className="px-3 py-1.5 rounded-full border border-border hover:border-[var(--accent-amber)]/40 hover:bg-[var(--accent-amber)]/8 active:scale-[0.97] transition-all duration-150 animate-fade-in"
          >
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const isLoadingProject = useAppStore((s) => s.isLoadingProject);
  const streamingContent = useAppStore((s) => s.streamingContent);
  const suggestions = useAppStore((s) => s.suggestions);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PER_PAGE);

  // Reset visible count and scroll to bottom instantly on project switch
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  useEffect(() => {
    setVisibleCount(MESSAGES_PER_PAGE);
    // Instant scroll after DOM updates with new messages
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    });
  }, [currentProjectId]);

  // Track whether the user is parked at the bottom. When they scroll up to read
  // earlier messages we must NOT yank them back down on every new token.
  const atBottomRef = useRef(true);
  useEffect(() => {
    const el = bottomRef.current;
    const scroller = el?.closest(".chat-scroll");
    if (!el || !scroller) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        atBottomRef.current = entry.isIntersecting;
      },
      { root: scroller, threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // New completed turn → ease down to it, but only if the user is already at the
  // bottom. If they've scrolled up to read history, don't yank them down (their
  // own send leaves them at the bottom, so that case still scrolls).
  useEffect(() => {
    if (!atBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While streaming, keep the tail in view ONLY if the user is already at the
  // bottom — and jump instantly. A *smooth* scroll re-triggered every frame as
  // the bubble grows fights itself and is the visible "jitter"; an instant pin
  // settles within the frame and tracks the growing text cleanly.
  useEffect(() => {
    if (!isStreaming || !atBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [streamingContent, isStreaming]);

  // Suggestion chips render just above bottomRef. A *smooth* scroll here would
  // animate the chips up over ~300ms — if the user clicks during that window the
  // mousedown/mouseup land on different targets and the click is dropped. Scroll
  // them into view instantly (settles within a frame) so the chip stays put.
  useEffect(() => {
    if (suggestions.length === 0) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    });
  }, [suggestions]);

  // Loading state — server fetch in progress, no messages yet
  if (isLoadingProject && messages.length === 0 && !isStreaming) {
    return <MessageListLoading />;
  }

  // Empty state — chat opened but no messages yet
  if (messages.length === 0 && !isStreaming) {
    return <MessageListEmpty />;
  }

  const lastMessage = messages[messages.length - 1];
  const showSuggestions =
    !isStreaming &&
    lastMessage?.role === "assistant";

  const hasMoreMessages = messages.length > visibleCount;
  const visibleMessages = hasMoreMessages
    ? messages.slice(messages.length - visibleCount)
    : messages;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Load older messages */}
      {hasMoreMessages && (
        <button
          onClick={() => setVisibleCount((c) => c + MESSAGES_PER_PAGE)}
          className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium transition-colors rounded-lg mx-auto text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Show {Math.min(MESSAGES_PER_PAGE, messages.length - visibleCount)} older messages
        </button>
      )}

      {visibleMessages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLastAssistant={msg.role === "assistant" && msg.id === messages[messages.length - 1]?.id}
        />
      ))}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      {showSuggestions && <SuggestionChips suggestions={suggestions} />}
      <div ref={bottomRef} />
    </div>
  );
}
