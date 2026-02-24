"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";

export function MessageList() {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const streamingContent = useAppStore((s) => s.streamingContent);
  const suggestions = useAppStore((s) => s.suggestions);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, suggestions]);

  const lastMessage = messages[messages.length - 1];
  const showSuggestions =
    !isStreaming &&
    suggestions.length > 0 &&
    lastMessage?.role === "assistant";

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLastAssistant={msg.role === "assistant" && i === messages.length - 1}
        />
      ))}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      {showSuggestions && <SuggestionChips suggestions={suggestions} />}
      <div ref={bottomRef} />
    </div>
  );
}
