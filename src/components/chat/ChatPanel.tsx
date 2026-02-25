"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { FileAttachment } from "@/lib/types";
import {
  parseSheetOperations,
  parseDocOperations,
  parseKuOperations,
  parseTableOperations,
  parseDiagramOperations,
  extractDisplayText,
  parseSuggestions,
} from "@/lib/ai/parseAIResponse";
import { scoreRelevance } from "@/lib/ai/contextRelevance";
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
  const abortStreaming = useAppStore((s) => s.abortStreaming);
  const clearPendingAttachments = useAppStore((s) => s.clearPendingAttachments);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (content: string, attachments?: FileAttachment[]) => {
      // Prevent concurrent streams — ignore if already streaming
      if (useAppStore.getState().isStreaming) return;

      // Auto-create a project if none exists (everything is project-based)
      if (!useAppStore.getState().currentProjectId) {
        useAppStore.getState().createProject("New Project");
        // Don't open workspace yet — let finishStreaming open it when AI returns content
        useAppStore.setState({ workspaceOpen: false });
      }

      // Snapshot messages BEFORE addUserMessage to avoid sending the new message twice
      const priorMessages = useAppStore.getState().messages;

      addUserMessage(content, attachments);
      clearPendingAttachments();
      startStreaming();

      try {
        const state = useAppStore.getState();
        const allMessages = [
          ...priorMessages.map((m) => ({
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
        let projectContext: any = undefined;
        if (state.currentProjectId) {
          const project = state.projects.find((p) => p.id === state.currentProjectId);
          if (project) {
            // Score relevance of KUs and tables to the user's message
            const relevanceResult = scoreRelevance(
              content,
              project.knowledgeUnits,
              project.tables,
              state.currentEntityId,
              { maxKUs: 4, maxTables: 3, charBudget: 50000, minScore: 1.0 }
            );

            // Store reading files for the UI indicator
            const readingFiles = [
              ...relevanceResult.relevantKUs.map((k) => k.title),
              ...relevanceResult.relevantTables.map((t) => t.title),
            ];
            if (readingFiles.length > 0) {
              useAppStore.getState().setReadingFiles(readingFiles);
            }

            projectContext = {
              id: project.id,
              title: project.title,
              // Summaries for all KUs (reduced to 200 chars since relevant ones get full content)
              knowledgeUnits: project.knowledgeUnits.map((k) => ({
                id: k.id,
                title: k.title,
                summary: k.id === state.currentEntityId ? k.content : k.content.slice(0, 200),
              })),
              // Headers for all tables
              tables: project.tables.map((t) => ({
                id: t.id,
                title: t.title,
                headers: t.sheets[0]?.celldata
                  ?.filter((c) => c.r === 0)
                  .sort((a, b) => a.c - b.c)
                  .map((c) => c.v?.v || "")
                  .slice(0, 20),
              })),
              // Full content for relevant matches
              relevantKUs: relevanceResult.relevantKUs.map((k) => ({
                id: k.id,
                title: k.title,
                content: k.content,
              })),
              relevantTables: relevanceResult.relevantTables.map((t) => ({
                id: t.id,
                title: t.title,
                csvContent: t.csvContent,
              })),
              // Diagram summaries
              diagrams: (project.diagrams || []).map((d) => ({
                id: d.id,
                title: d.title,
                diagramType: d.diagramType,
              })),
            };
          }
        }

        abortControllerRef.current = new AbortController();
        let response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            sheetData: state.sheets,
            docContent: state.docContent,
            projectMemory: state.projectMemory,
            projectContext,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Retry once on 5xx errors
        if (response.status >= 500 && response.status < 600) {
          await new Promise((r) => setTimeout(r, 1000));
          // Check if user aborted during the retry delay
          if (abortControllerRef.current?.signal.aborted) {
            abortStreaming();
            return;
          }
          abortControllerRef.current = new AbortController();
          const retryResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: allMessages,
              sheetData: state.sheets,
              docContent: state.docContent,
              projectMemory: state.projectMemory,
              projectContext,
            }),
            signal: abortControllerRef.current.signal,
          });
          if (!retryResponse.ok) {
            throw new Error(
              retryResponse.status === 401
                ? "Your session has expired. Please sign in again."
                : "Failed to get a response from AI. Please try again."
            );
          }
          response = retryResponse;
        } else if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Your session has expired. Please sign in again."
              : "Failed to get a response from AI. Please try again."
          );
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        let streamError = "";

        // Process a single SSE line
        const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) return;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              appendStreamChunk(parsed.text);
            }
            if (parsed.error) {
              streamError = parsed.error;
              console.error("[Drafta] Stream error:", parsed.error);
            }
          } catch {
            // Malformed chunk — skip silently
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const line of parts) {
            processLine(line);
          }
        }

        // Process any remaining buffer — split in case it contains multiple lines
        if (buffer.trim()) {
          const remaining = buffer.split("\n");
          for (const line of remaining) {
            processLine(line);
          }
        }

        // If the AI produced an error and no content, show error to user
        if (streamError && !fullText.trim()) {
          abortStreaming();
          toast.error("AI couldn't generate a response. Please try again.");
          return;
        }

        // Don't create an empty assistant message
        if (!fullText.trim()) {
          abortStreaming();
          toast.error("No response received from AI. Please try again.");
          return;
        }

        const sheetOps = parseSheetOperations(fullText);
        const docOps = parseDocOperations(fullText);
        const kuOps = parseKuOperations(fullText);
        const tableOps = parseTableOperations(fullText);
        const diagramOps = parseDiagramOperations(fullText);
        const suggestions = parseSuggestions(fullText);
        const displayText = extractDisplayText(fullText);

        // Warn if AI tried to output ops but parsing failed
        if (sheetOps.length === 0 && docOps.length === 0 && kuOps.length === 0 && tableOps.length === 0 && diagramOps.length === 0) {
          if (fullText.includes("```tableops") || fullText.includes("```sheetops") || fullText.includes("```kuops") || fullText.includes("```docops") || fullText.includes("```diagramops")) {
            console.warn("[Drafta] Operation blocks found but none parsed. Raw tail:", fullText.slice(-600));
          }
        }

        finishStreaming(displayText || fullText, sheetOps, docOps, kuOps, tableOps, diagramOps, suggestions);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // User cancelled — keep any partial content that was streamed
          const partial = useAppStore.getState().streamingContent;
          if (partial.trim()) {
            finishStreaming(extractDisplayText(partial) || partial);
            // Mark the saved message as interrupted
            const msgs = useAppStore.getState().messages;
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              if (last.role === "assistant") {
                useAppStore.setState({
                  messages: msgs.map((m, i) => i === msgs.length - 1 ? { ...m, interrupted: true } : m),
                });
              }
            }
          } else {
            abortStreaming();
          }
          return;
        }
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        abortStreaming();
        toast.error(errMsg);
      }
    },
    [addUserMessage, startStreaming, appendStreamChunk, finishStreaming, abortStreaming, clearPendingAttachments]
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
        <ChatInput onSend={sendMessage} disabled={isStreaming} centered={centered} onStop={stopStreaming} />
      </div>
    </div>
  );
}
