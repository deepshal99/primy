"use client";

import { useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { FileAttachment } from "@/lib/types";
import {
  parseSheetOperations,
  parseDocOperations,
  parseKuOperations,
  parseTableOperations,
  extractDisplayText,
  parseSuggestions,
} from "@/lib/ai/parseAIResponse";
import { design } from "@/lib/design";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ExamplePrompts } from "./ExamplePrompts";

interface ChatPanelProps {
  centered?: boolean;
}

export function ChatPanel({ centered }: ChatPanelProps) {
  const messages = useAppStore((s) => s.messages);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const addUserMessage = useAppStore((s) => s.addUserMessage);
  const startStreaming = useAppStore((s) => s.startStreaming);
  const appendStreamChunk = useAppStore((s) => s.appendStreamChunk);
  const finishStreaming = useAppStore((s) => s.finishStreaming);
  const clearPendingAttachments = useAppStore((s) => s.clearPendingAttachments);

  const sendMessage = useCallback(
    async (content: string, attachments?: FileAttachment[]) => {
      addUserMessage(content, attachments);
      clearPendingAttachments();
      startStreaming();

      try {
        const state = useAppStore.getState();
        const allMessages = [
          ...state.messages.map((m) => ({
            role: m.role,
            content: m.content,
            attachmentTexts: m.attachments
              ?.filter((a) => a.extractedText)
              .map((a) => ({ name: a.name, text: a.extractedText })),
          })),
          {
            role: "user" as const,
            content,
            attachmentTexts: attachments
              ?.filter((a) => a.extractedText)
              .map((a) => ({ name: a.name, text: a.extractedText })),
            imageAttachments: attachments
              ?.filter((a) => a.base64)
              .map((a) => ({ name: a.name, base64: a.base64, mimeType: a.mimeType })),
          },
        ];

        // Build project context if in a project
        let projectContext = undefined;
        if (state.currentProjectId) {
          const project = state.projects.find((p) => p.id === state.currentProjectId);
          if (project) {
            projectContext = {
              id: project.id,
              title: project.title,
              knowledgeUnits: project.knowledgeUnits.map((k) => ({
                id: k.id,
                title: k.title,
                summary: k.content.slice(0, 200),
              })),
              tables: project.tables.map((t) => ({
                id: t.id,
                title: t.title,
                headers: t.sheets[0]?.celldata
                  ?.filter((c) => c.r === 0)
                  .sort((a, b) => a.c - b.c)
                  .map((c) => c.v?.v || "")
                  .slice(0, 20),
              })),
            };
          }
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            sheetData: state.sheets,
            docContent: state.docContent,
            projectMemory: state.projectMemory,
            projectContext,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                appendStreamChunk(parsed.text);
              }
              if (parsed.error) {
                console.error("[Drafta] Stream error:", parsed.error);
              }
            } catch {
              console.warn("[Drafta] Malformed SSE chunk:", data.slice(0, 100));
            }
          }
        }

        if (buffer.trim().startsWith("data: ")) {
          const data = buffer.trim().slice(6);
          if (data !== "[DONE]") {
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                appendStreamChunk(parsed.text);
              }
            } catch {}
          }
        }

        const sheetOps = parseSheetOperations(fullText);
        const docOps = parseDocOperations(fullText);
        const kuOps = parseKuOperations(fullText);
        const tableOps = parseTableOperations(fullText);
        const suggestions = parseSuggestions(fullText);
        const displayText = extractDisplayText(fullText);
        finishStreaming(displayText || fullText, sheetOps, docOps, kuOps, tableOps, suggestions);
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        finishStreaming(
          `Sorry, I encountered an error: ${errMsg}. Please try again.`
        );
      }
    },
    [addUserMessage, startStreaming, appendStreamChunk, finishStreaming, clearPendingAttachments]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content) sendMessage(detail.content);
    };
    window.addEventListener("drafta:send-message", handler);
    return () => window.removeEventListener("drafta:send-message", handler);
  }, [sendMessage]);

  const hasMessages = messages.length > 0;

  return (
    <div
      className={`flex flex-col h-full ${
        centered ? "" : "border-r border-[var(--color-border)]"
      }`}
      style={{ backgroundColor: design.colors.bg.chat }}
    >
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className={centered ? "max-w-[720px] mx-auto w-full" : ""}>
            <MessageList />
          </div>
        ) : (
          <ExamplePrompts onSelect={sendMessage} centered={centered} />
        )}
      </div>

      {/* Input */}
      <div className={centered ? "max-w-[720px] mx-auto w-full" : ""}>
        <ChatInput onSend={sendMessage} disabled={isStreaming} centered={centered} />
      </div>
    </div>
  );
}
