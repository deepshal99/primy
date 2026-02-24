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
  const readingFiles = useAppStore((s) => s.readingFiles);
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
      {isStreaming && readingFiles.length > 0 && !streamingContent && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Reading {readingFiles.join(", ")}</span>
        </div>
      )}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      {showSuggestions && <SuggestionChips suggestions={suggestions} />}
      <div ref={bottomRef} />
    </div>
  );
}
