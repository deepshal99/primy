"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { nanoid } from "nanoid";
import { MoreHorizontal, PanelLeft } from "lucide-react";
import { DeckSlide, FileAttachment, GroundingSource } from "@/lib/types";
import {
  parseSheetOperations,
  parseDocOperations,
  parseKuOperations,
  parseTableOperations,
  parseDiagramOperations,
  parseDeckOperations,
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
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
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
            // Generate query embedding for semantic search (fire-and-forget, non-blocking)
            let queryEmbedding: number[] | undefined;
            const hasEmbeddings = project.knowledgeUnits.some((k) => k.embedding) ||
              project.tables.some((t) => t.embedding);
            if (hasEmbeddings) {
              try {
                const embRes = await fetch("/api/embeddings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ texts: [content] }),
                });
                if (embRes.ok) {
                  const embData = await embRes.json();
                  queryEmbedding = embData.embeddings?.[0];
                }
              } catch {
                // Silently fail — keyword matching will be used as fallback
              }
            }

            // Score relevance of KUs and tables to the user's message
            const relevanceResult = scoreRelevance(
              content,
              project.knowledgeUnits,
              project.tables,
              state.currentEntityId,
              { maxKUs: 4, maxTables: 3, charBudget: 50000, minScore: 1.0, queryEmbedding }
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
        let groundingSources: GroundingSource[] = [];

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
            if (parsed.grounding) {
              groundingSources = parsed.grounding.sources || [];
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
        const deckOps = parseDeckOperations(fullText);
        const suggestions = parseSuggestions(fullText);
        const displayText = extractDisplayText(fullText);

        // Warn if AI tried to output ops but parsing failed
        const hasAnyOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || diagramOps.length > 0 || deckOps.length > 0;
        if (!hasAnyOps) {
          const hasFences = fullText.includes("```tableops") || fullText.includes("```sheetops") || fullText.includes("```kuops") || fullText.includes("```docops") || fullText.includes("```diagramops") || fullText.includes("```deckops");
          if (hasFences) {
            console.warn("[Drafta] Operation blocks found but none parsed. Raw tail:", fullText.slice(-600));
            toast.error("AI response had formatting issues — some changes may not have been applied. Try again.");
          }
        }

        finishStreaming(displayText || fullText, sheetOps, docOps, kuOps, tableOps, diagramOps, deckOps, suggestions);

        // After deck creation, auto-enhance with Kimi K2.5 HTML slides
        if (deckOps.length > 0) {
          const createOp = deckOps.find((op) => op.type === "CREATE");
          if (createOp && createOp.type === "CREATE" && createOp.slides?.length > 0) {
            enhanceDeckWithKimi(createOp.title, createOp.slides);
          }
        }

        // Attach grounding sources to the assistant message if web search was used
        if (groundingSources.length > 0) {
          const msgs = useAppStore.getState().messages;
          if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
            useAppStore.setState({
              messages: msgs.map((m, i) =>
                i === msgs.length - 1 ? { ...m, groundingSources } : m
              ),
            });
          }
        }
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
  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;

  return (
    <div
      className={`flex flex-col h-full ${
        centered ? "" : "border-r border-[var(--color-border)]"
      }`}
      style={{ backgroundColor: design.colors.bg.chat }}
    >
      {/* Chat header — clean app bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0 border-b"
        style={{
          height: design.layout.headerHeight,
          borderColor: design.colors.border.default,
          backgroundColor: design.colors.bg.primary,
        }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.dispatchEvent(new Event("drafta:toggle-sidebar"))}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; e.currentTarget.style.color = design.colors.text.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = design.colors.text.muted; }}
            title="Toggle sidebar (⌘B)"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <span
            className="text-[15px] font-semibold"
            style={{ color: design.colors.text.primary, fontFamily: design.typography.family.heading, letterSpacing: "-0.01em" }}
          >
            Drafta AI
          </span>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("drafta:toggle-sidebar"))}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
          style={{ color: design.colors.text.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

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

/**
 * After Gemini creates a deck with JSON slides, call Kimi K2.5 to generate
 * rich HTML versions. The JSON slides display instantly; HTML slides replace
 * them in the background once Kimi finishes.
 */
async function enhanceDeckWithKimi(title: string, originalSlides: DeckSlide[]) {
  // Build a prompt from the slide content
  const slideOutline = originalSlides.map((s, i) => {
    let desc = `Slide ${i + 1} (${s.layout}): ${s.title || ""}`;
    if (s.subtitle) desc += ` — ${s.subtitle}`;
    if (s.bullets?.length) desc += `\n  • ${s.bullets.join("\n  • ")}`;
    if (s.content) desc += `\n  ${s.content.slice(0, 200)}`;
    if (s.stats?.length) desc += `\n  Stats: ${s.stats.map((st) => `${st.value} ${st.label}`).join(", ")}`;
    return desc;
  }).join("\n");

  const prompt = `Create a professional presentation titled "${title}" with the following content:\n\n${slideOutline}`;

  try {
    toast.info("Enhancing deck with AI visuals...", { duration: 3000 });

    const res = await fetch("/api/deck-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        slideCount: originalSlides.length,
        style: "professional",
      }),
    });

    if (!res.ok) return; // Silently fail — user still has the JSON deck

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let htmlSlides: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "complete" && parsed.slides) {
            htmlSlides = parsed.slides;
          }
        } catch { /* skip */ }
      }
    }

    if (htmlSlides.length === 0) return;

    // Replace deck slides with HTML versions
    const newSlides: DeckSlide[] = htmlSlides.map((html, i) => ({
      id: nanoid(),
      layout: "html" as const,
      title: originalSlides[i]?.title || `Slide ${i + 1}`,
      html,
      htmlPrompt: prompt,
      generatedBy: "kimi" as const,
      notes: originalSlides[i]?.notes || "",
    }));

    useAppStore.getState().updateDeckSlides(newSlides);
    toast.success(`Deck enhanced with ${newSlides.length} AI-designed slides`);
  } catch {
    // Silently fail — user still has the original JSON deck
  }
}
