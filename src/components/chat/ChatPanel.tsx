"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { EntityType, FileAttachment, GroundingSource } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  parseSheetOperations,
  parseDocOperations,
  parseKuOperations,
  parseTableOperations,
  parseDiagramOperations,
  parseDeckOperations,
  parseDeckOutlineItems,
  extractDisplayText,
  parseSuggestions,
} from "@/lib/ai/parseAIResponse";
import { scoreRelevance } from "@/lib/ai/contextRelevance";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ExamplePrompts, ENTITY_PILLS } from "./ExamplePrompts";


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

  // Safety net: if isStreaming gets stuck (e.g. unhandled error), auto-recover after 3 minutes
  useEffect(() => {
    if (!isStreaming) return;
    const safetyTimer = setTimeout(() => {
      if (useAppStore.getState().isStreaming) {
        console.error("[Drafta] Streaming state stuck — auto-recovering after 3 min timeout");
        abortControllerRef.current?.abort();
        abortStreaming();
        toast.error("Response timed out. Please try again.");
      }
    }, 180_000);
    return () => clearTimeout(safetyTimer);
  }, [isStreaming, abortStreaming]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (content: string, attachments?: FileAttachment[], mentionedEntities?: { id: string; type: EntityType; title: string }[]) => {
      // Prevent concurrent streams
      if (useAppStore.getState().isStreaming) return;

      // Auto-create a project if none exists
      if (!useAppStore.getState().currentProjectId) {
        useAppStore.getState().createProject("New Project");
        useAppStore.setState({ workspaceOpen: false });
      }

      // Prepend entity type intent if user selected one from the empty-state pills
      const entityIntent = selectedEntityTypeRef.current;
      if (entityIntent) {
        const intentLabels: Record<EntityType, string> = {
          ku: "Create a document:",
          table: "Create a spreadsheet:",
          diagram: "Create a diagram:",
          deck: "Create a presentation:",
        };
        content = `${intentLabels[entityIntent]} ${content}`;
        setSelectedEntityType(null);
      }

      // Snapshot messages BEFORE addUserMessage to avoid sending the new message twice
      const priorMessages = useAppStore.getState().messages;

      addUserMessage(content, attachments, mentionedEntities);
      clearPendingAttachments();
      startStreaming();

      try {
        const state = useAppStore.getState();

        // Prepend mention references to content for AI context
        let enrichedContent = content;
        if (mentionedEntities && mentionedEntities.length > 0) {
          const typeLabels: Record<EntityType, string> = { ku: "document", table: "spreadsheet", diagram: "diagram", deck: "deck" };
          const refs = mentionedEntities.map((e) => `[User referenced: "${e.title}" (${typeLabels[e.type]})]`).join("\n");
          enrichedContent = refs + "\n\n" + enrichedContent;
        }

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
            content: enrichedContent,
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
                // Silently fail -- keyword matching will be used as fallback
              }
            }

            const relevanceResult = scoreRelevance(
              content,
              project.knowledgeUnits,
              project.tables,
              state.currentEntityId,
              { maxKUs: 4, maxTables: 3, charBudget: 50000, minScore: 1.0, queryEmbedding }
            );

            // Force-include mentioned entities in relevance results
            let mentionedDiagramContext = "";
            let mentionedDeckContext = "";
            if (mentionedEntities && mentionedEntities.length > 0) {
              for (const mention of mentionedEntities) {
                if (mention.type === "ku") {
                  const ku = project.knowledgeUnits.find((k) => k.id === mention.id);
                  if (ku && !relevanceResult.relevantKUs.some((r) => r.id === ku.id)) {
                    relevanceResult.relevantKUs.push({ id: ku.id, title: ku.title, content: ku.content, score: 100 });
                  }
                } else if (mention.type === "table") {
                  const table = project.tables.find((t) => t.id === mention.id);
                  if (table && !relevanceResult.relevantTables.some((r) => r.id === table.id)) {
                    // Build CSV content for the table
                    const sheet = table.sheets[0];
                    let csv = "";
                    if (sheet?.celldata?.length) {
                      let maxR = 0, maxC = 0;
                      for (const c of sheet.celldata) { if (c.r > maxR) maxR = c.r; if (c.c > maxC) maxC = c.c; }
                      const rows: string[] = [];
                      for (let r = 0; r <= Math.min(maxR, 100); r++) {
                        const cells: string[] = [];
                        for (let c = 0; c <= maxC; c++) {
                          const cell = sheet.celldata.find((cd) => cd.r === r && cd.c === c);
                          cells.push(String(cell?.v?.v ?? ""));
                        }
                        rows.push(cells.join(","));
                      }
                      csv = rows.join("\n");
                    }
                    relevanceResult.relevantTables.push({ id: table.id, title: table.title, csvContent: csv, score: 100 });
                  }
                } else if (mention.type === "diagram") {
                  const diagram = (project.diagrams || []).find((d) => d.id === mention.id);
                  if (diagram) {
                    mentionedDiagramContext += `\n<mentioned_diagram id="${diagram.id}" title="${diagram.title}">\n${diagram.source}\n</mentioned_diagram>`;
                  }
                } else if (mention.type === "deck") {
                  const deck = (project.decks || []).find((d) => d.id === mention.id);
                  if (deck) {
                    const slideSummary = deck.slides.map((s, i) => {
                      if ("html" in s && !("layout" in s)) {
                        return `Slide ${i + 1}: [HTML slide]`;
                      }
                      const legacy = s as { title?: string; layout?: string };
                      return `Slide ${i + 1}: ${legacy.title || ""} (${legacy.layout || "unknown"})`;
                    }).join("\n");
                    mentionedDeckContext += `\n<mentioned_deck id="${deck.id}" title="${deck.title}">\n${slideSummary}\n</mentioned_deck>`;
                  }
                }
              }
            }

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
              knowledgeUnits: project.knowledgeUnits.map((k) => ({
                id: k.id,
                title: k.title,
                summary: k.id === state.currentEntityId ? k.content : k.content.slice(0, 200),
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
              diagrams: (project.diagrams || []).map((d) => ({
                id: d.id,
                title: d.title,
                diagramType: d.diagramType,
              })),
              mentionedDiagramContext,
              mentionedDeckContext,
            };
          }
        }

        // Resolve active entity metadata for context injection
        const activeEntityId = state.currentEntityId ?? undefined;
        const activeEntityType = state.currentEntityType ?? undefined;
        let activeEntityTitle: string | undefined;
        let activeEntityContent: string | undefined;
        if (activeEntityId && activeEntityType && state.currentProjectId) {
          const proj = state.projects.find((p) => p.id === state.currentProjectId);
          if (proj) {
            if (activeEntityType === "ku") {
              const ku = proj.knowledgeUnits.find((k) => k.id === activeEntityId);
              activeEntityTitle = ku?.title;
            } else if (activeEntityType === "table") {
              const tbl = proj.tables.find((t) => t.id === activeEntityId);
              activeEntityTitle = tbl?.title;
            } else if (activeEntityType === "diagram") {
              const diag = (proj.diagrams || []).find((d) => d.id === activeEntityId);
              activeEntityTitle = diag?.title;
              activeEntityContent = diag?.source;
            } else if (activeEntityType === "deck") {
              const dk = (proj.decks || []).find((d) => d.id === activeEntityId);
              activeEntityTitle = dk?.title;
              activeEntityContent = dk ? JSON.stringify(dk.slides) : undefined;
            }
          }
        }

        const chatPayload = {
          messages: allMessages,
          sheetData: state.sheets,
          docContent: state.docContent,
          projectMemory: state.projectMemory,
          projectContext,
          activeEntityId,
          activeEntityType,
          activeEntityTitle,
          activeEntityContent,
          deckPhase: state.deckPhase,
        };

        abortControllerRef.current = new AbortController();
        let response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatPayload),
          signal: abortControllerRef.current.signal,
        });

        // Retry once on 5xx errors
        if (response.status >= 500 && response.status < 600) {
          await new Promise((r) => setTimeout(r, 1000));
          if (abortControllerRef.current?.signal.aborted) {
            abortStreaming();
            return;
          }
          abortControllerRef.current = new AbortController();
          const retryResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(chatPayload),
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

        if (!response.body) {
          throw new Error("Empty response from AI service. Please try again.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        let streamError = "";
        let groundingSources: GroundingSource[] = [];

        let chunkCount = 0;
        let lastChunkAt = Date.now();
        const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) return;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          chunkCount++;
          lastChunkAt = Date.now();
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
            // Malformed chunk — log first few for debugging
            if (chunkCount <= 3) console.warn("[Drafta] Malformed SSE chunk:", data.slice(0, 200));
          }
        };

        // Client-side stall detection: if no chunks arrive for 60s, abort
        const STALL_TIMEOUT_MS = 60_000;
        const stallCheck = setInterval(() => {
          if (Date.now() - lastChunkAt > STALL_TIMEOUT_MS) {
            clearInterval(stallCheck);
            console.error("[Drafta] Stream stalled — no data for 60s. Aborting.");
            abortControllerRef.current?.abort();
          }
        }, 5000);

        try {
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
        } finally {
          clearInterval(stallCheck);
        }

        if (buffer.trim()) {
          const remaining = buffer.split("\n");
          for (const line of remaining) {
            processLine(line);
          }
        }

        if (streamError && !fullText.trim()) {
          console.error("[Drafta] Stream completed with error, no text. Error:", streamError, "Chunks received:", chunkCount);
          abortStreaming();
          toast.error(streamError.includes("Rate limit") ? streamError : "AI couldn't generate a response. Please try again.");
          return;
        }

        if (!fullText.trim()) {
          console.warn("[Drafta] Stream completed with empty text. Chunks received:", chunkCount, "Buffer remainder:", buffer.slice(0, 200));
          abortStreaming();
          toast.error("No response received from AI. Please try again.");
          return;
        }

        // Parse operations and apply to store — wrapped in try/catch so a parse/apply
        // failure never loses the AI's text response
        try {
          useAppStore.getState().setAIPhase('updating');

          const sheetOps = parseSheetOperations(fullText);
          // Resolve attachment:N references in INSERT_IMAGE ops to base64 data URLs
          const imageAttachments = attachments?.filter((a) => a.base64 && a.mimeType?.startsWith("image/")) || [];
          for (const op of sheetOps) {
            if (op.type === "INSERT_IMAGE" && op.url.startsWith("attachment:")) {
              const idx = parseInt(op.url.split(":")[1], 10);
              if (idx >= 0 && idx < imageAttachments.length) {
                const att = imageAttachments[idx];
                op.url = `data:${att.mimeType};base64,${att.base64}`;
              }
            }
          }
          const docOps = parseDocOperations(fullText);
          const kuOps = parseKuOperations(fullText);
          const tableOps = parseTableOperations(fullText);
          const diagramOps = parseDiagramOperations(fullText);
          const deckOps = parseDeckOperations(fullText);
          const suggestions = parseSuggestions(fullText);
          const outlineItems = parseDeckOutlineItems(fullText);
          const hasAnyOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || diagramOps.length > 0 || deckOps.length > 0;
          if (!hasAnyOps && outlineItems.length === 0) {
            const hasFences = fullText.includes("```tableops") || fullText.includes("```sheetops") || fullText.includes("```kuops") || fullText.includes("```docops") || fullText.includes("```diagramops") || fullText.includes("```deckops") || fullText.includes("```deckoutline");
            if (hasFences) {
              console.warn("[Drafta] Operation blocks found but none parsed. Raw tail:", fullText.slice(-600));
              toast.error("AI response had formatting issues — some changes may not have been applied. Try again.");
            }
          }

          finishStreaming(fullText, sheetOps, docOps, kuOps, tableOps, diagramOps, deckOps, suggestions);
        } catch (applyError) {
          // Operation parsing or store mutation failed — still save the AI text response
          console.error("[Drafta] Failed to apply AI operations:", applyError);
          finishStreaming(extractDisplayText(fullText) || fullText);
          toast.error("AI responded but some changes couldn't be applied. Try again or check the response.");
        }

        // Attach grounding sources to the assistant message
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
          // Stream was aborted (user stop, stall detection, or safety timeout)
          // Try to parse and apply any operations from partial content
          const partial = useAppStore.getState().streamingContent;
          if (partial.trim()) {
            try {
              const sheetOps = parseSheetOperations(partial);
              const docOps = parseDocOperations(partial);
              const kuOps = parseKuOperations(partial);
              const tableOps = parseTableOperations(partial);
              const diagramOps = parseDiagramOperations(partial);
              const deckOps = parseDeckOperations(partial);
              const hasPartialOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || diagramOps.length > 0 || deckOps.length > 0;
              if (hasPartialOps) {
                finishStreaming(extractDisplayText(partial) || partial, sheetOps, docOps, kuOps, tableOps, diagramOps, deckOps);
              } else {
                finishStreaming(extractDisplayText(partial) || partial);
              }
            } catch {
              finishStreaming(extractDisplayText(partial) || partial);
            }
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
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | null>(null);
  const selectedEntityTypeRef = useRef<EntityType | null>(null);
  // Keep ref in sync so sendMessage callback always sees latest value
  selectedEntityTypeRef.current = selectedEntityType;

  // Compute placeholder based on selected entity type
  const activePlaceholder = selectedEntityType
    ? ENTITY_PILLS.find((p) => p.type === selectedEntityType)?.placeholder
    : undefined;

  // Handle entity pill click on fullscreen hero: create project + open blank entity
  const handleEntityPillClick = useCallback((type: EntityType | null) => {
    if (!type) return;
    const store = useAppStore.getState();
    // Create a new project
    store.createProject("New Project");
    const projectId = useAppStore.getState().currentProjectId;
    if (!projectId) return;
    // Create a blank entity of the chosen type and open workspace
    if (type === "ku") {
      store.createKnowledgeUnit(projectId, "Untitled Document");
    } else if (type === "table") {
      store.createTable(projectId, "Untitled Spreadsheet");
    } else if (type === "diagram") {
      store.createDiagram(projectId, "Untitled Diagram");
    } else if (type === "deck") {
      store.createDeck(projectId, "Untitled Presentation");
    }
    useAppStore.setState({ workspaceOpen: true });
  }, []);

  // Empty + centered = hero layout with chatbox in the middle
  const showHeroLayout = centered && !hasMessages;

  const goToProjectHome = () => {
    const s = useAppStore.getState();
    if (s.currentProjectId) {
      s.saveCurrentEntity();
      useAppStore.setState({ currentEntityId: null, currentEntityType: null, workspaceOpen: true });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header -- sidebar mode only, inside white card */}
      {!centered && (
        <div className="flex items-center px-3.5 h-[44px] flex-shrink-0 border-b border-[rgba(0,0,0,0.06)] min-w-0">
          <span
            className="text-[13px] text-[#171717] truncate min-w-0 flex-1"
            style={{ fontWeight: 550 }}
          >
            {currentProject?.title || "Drafta AI"}
          </span>
        </div>
      )}
        {showHeroLayout ? (
          /* Centered empty state: title + chatbox + entity pills */
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-[680px]">
              {/* Title */}
              <h1 className="font-heading text-[32px] font-semibold text-foreground text-center mb-7 tracking-[-0.03em] leading-tight">
                What are you working on?
              </h1>

              {/* Chat input */}
              <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                centered={centered}
                onStop={stopStreaming}
                placeholder={activePlaceholder || "Describe what you want to create..."}
              />

              {/* Entity type pills — click to create project + open blank entity */}
              <div className="mt-5">
                <ExamplePrompts
                  centered
                  selectedEntityType={selectedEntityType}
                  onEntityTypeSelect={handleEntityPillClick}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Content area */}
            <div className="flex-1 overflow-y-auto chat-scroll">
              {hasMessages ? (
                <div className={centered ? "max-w-[680px] mx-auto w-full px-6" : ""}>
                  <MessageList />
                </div>
              ) : (
                <ExamplePrompts
                  onSelect={sendMessage}
                  hasProject={!!currentProjectId}
                />
              )}
            </div>

            {/* Input — pinned to bottom */}
            <div className={centered ? "max-w-[680px] mx-auto w-full px-6" : ""}>
              <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                centered={centered}
                onStop={stopStreaming}
              />
            </div>
          </>
        )}
    </div>
  );
}

