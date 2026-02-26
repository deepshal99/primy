"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";

const MESSAGES_PER_PAGE = 50;

export function MessageList() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const streamingContent = useAppStore((s) => s.streamingContent);
  const suggestions = useAppStore((s) => s.suggestions);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PER_PAGE);

  // Reset visible count when switching projects/conversations
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  useEffect(() => {
    setVisibleCount(MESSAGES_PER_PAGE);
  }, [currentProjectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, suggestions]);

  const lastMessage = messages[messages.length - 1];
  const showSuggestions =
    !isStreaming &&
    suggestions.length > 0 &&
    lastMessage?.role === "assistant";

  const hasMoreMessages = messages.length > visibleCount;
  const visibleMessages = hasMoreMessages
    ? messages.slice(messages.length - visibleCount)
    : messages;

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      {/* Load older messages */}
      {hasMoreMessages && (
        <button
          onClick={() => setVisibleCount((c) => c + MESSAGES_PER_PAGE)}
          className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium transition-colors rounded-lg mx-auto"
          style={{ color: design.colors.text.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = design.colors.text.secondary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = design.colors.text.muted; }}
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Show {Math.min(MESSAGES_PER_PAGE, messages.length - visibleCount)} older messages
        </button>
      )}

      {visibleMessages.map((msg, i) => (
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
