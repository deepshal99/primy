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
  parseDeckOperations,
  parsePageOperations,
  parseDeckOutlineItems,
  extractDisplayText,
  parseSuggestions,
} from "@/lib/ai/parseAIResponse";
import { scoreRelevance } from "@/lib/ai/contextRelevance";
import { emptyToolOps, applyToolCall, hasToolOps, toolIndicatorKind, summarizeOps } from "@/lib/ai/toolMapping";
import { Maximize2, Minimize2, PanelRightClose } from "lucide-react";
import { ENTITY_META } from "@/lib/entityMeta";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ExamplePrompts, ENTITY_PILLS } from "./ExamplePrompts";


interface ChatPanelProps {
  centered?: boolean;
  /** V2 shell: branded header + hero landscape + warmer empty state. */
  branded?: boolean;
  /** V2 shell: header controls. */
  onCollapse?: () => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
}

export function ChatPanel({ centered, branded, onCollapse, onToggleExpand, expanded }: ChatPanelProps) {
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

  // Safety net: if isStreaming ever gets stuck (unhandled error, lost stream),
  // auto-recover. 45s is comfortably longer than the server stall timeout (45s
  // chat / 120s deck) plus continuation headroom, yet fast enough that the UI
  // never feels permanently frozen. The `finally` in sendMessage is the primary
  // guarantee; this timer is the backstop for paths it can't reach.
  useEffect(() => {
    if (!isStreaming) return;
    const safetyTimer = setTimeout(() => {
      if (useAppStore.getState().isStreaming) {
        console.error("[Drafta] Streaming state stuck — auto-recovering after 150s timeout");
        abortControllerRef.current?.abort();
        abortStreaming();
        toast.error("Response timed out. Please try again.");
      }
    }, 150_000);
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
          deck: "Create a presentation:",
          page: "Create an HTML page:",
        };
        content = `${intentLabels[entityIntent]} ${content}`;
        setSelectedEntityType(null);
      }

      // Snapshot messages BEFORE addUserMessage to avoid sending the new message twice
      const priorMessages = useAppStore.getState().messages;

      addUserMessage(content, attachments, mentionedEntities);
      clearPendingAttachments();
      startStreaming();

      // Layer B: collected tool-call ops, declared OUTSIDE the try so both the
      // success and abort paths can apply whatever the model called before the
      // stream ended.
      const toolOps = emptyToolOps();

      try {
        const state = useAppStore.getState();

        // Prepend mention references to content for AI context
        let enrichedContent = content;
        if (mentionedEntities && mentionedEntities.length > 0) {
          const typeLabels: Record<EntityType, string> = { ku: "document", table: "spreadsheet", deck: "deck", page: "HTML page" };
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
        let streamTruncated = false;
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
            if (parsed.meta?.truncated) {
              // Server exhausted its auto-continuations and the response is still
              // cut off. Surface it — never let a half-finished answer look whole.
              streamTruncated = true;
            }
            if (parsed.toolStart?.name) {
              // Model began a tool call — show the live action pill right away.
              const kind = toolIndicatorKind(parsed.toolStart.name);
              if (kind) useAppStore.getState().setStreamingAction(kind);
            }
            if (parsed.toolCall?.name) {
              // Schema-validated action — collect it for apply at stream end.
              applyToolCall(parsed.toolCall.name, parsed.toolCall.input, toolOps);
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

        if (!fullText.trim() && !hasToolOps(toolOps)) {
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
          // Dual-accept: prefer schema-validated tool-call ops; fall back to
          // fenced-block parsing per family so legacy output, deck flows, and
          // sheet-cell edits still work. sheetOps (cell edits) stay fenced.
          const docOps = toolOps.doc.length ? toolOps.doc : parseDocOperations(fullText);
          const kuOps = toolOps.ku.length ? toolOps.ku : parseKuOperations(fullText);
          const tableOps = toolOps.table.length ? toolOps.table : parseTableOperations(fullText);
          const deckOps = parseDeckOperations(fullText);
          const pageOps = toolOps.page.length ? toolOps.page : parsePageOperations(fullText);
          const suggestions = parseSuggestions(fullText);
          const outlineItems = parseDeckOutlineItems(fullText);
          const hasAnyOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || deckOps.length > 0 || pageOps.length > 0;
          if (!hasAnyOps && outlineItems.length === 0) {
            const hasFences = fullText.includes("```tableops") || fullText.includes("```sheetops") || fullText.includes("```kuops") || fullText.includes("```docops") || fullText.includes("```deckops") || fullText.includes("```pageops") || fullText.includes("```deckoutline");
            if (hasFences) {
              console.warn("[Drafta] Operation blocks found but none parsed. Raw tail:", fullText.slice(-600));
              toast.error("AI response had formatting issues — some changes may not have been applied. Try again.");
            } else {
              // Claim/action reconciliation: catch the rare case where the model
              // SAYS it created/updated a Drafta artifact but emitted no tool call
              // or operation block. This must be VERY conservative — ANSWER mode
              // legitimately produces summaries full of words like "built" or
              // "pages", which must NOT trigger a false alarm. So we require a
              // first-person completion claim tied to an artifact noun, and only
              // in the lead (a real confirmation leads, e.g. "I've created the X
              // document."), not buried in body prose.
              const displayText = extractDisplayText(fullText) || fullText;
              const lead = displayText.slice(0, 240);
              const claimsArtifactAction =
                /\bi(?:'ve| have| just)?\s+(?:created|added|made|built|generated|drafted|put together|set up|updated)\b[^.!?\n]{0,60}\b(document|doc|spreadsheet|sheet|table|deck|presentation|slides?|page|one-?pager|tracker)\b/i.test(lead) ||
                /\bhere(?:'s| is)\s+(?:your|the)\s+(?:new\s+)?[^.!?\n]{0,40}\b(document|doc|spreadsheet|sheet|table|deck|presentation|page|one-?pager)\b/i.test(lead);
              if (claimsArtifactAction) {
                console.warn("[Drafta] Model claimed an artifact action but emitted no operation. Lead:", lead);
                toast.error("The AI described a change but didn't actually apply it. Please ask again.");
              }
            }
          }

          // With verbosity:low the model often returns ONLY a tool call and no
          // prose — which would render an empty assistant bubble. Synthesize a
          // one-line confirmation from the applied ops so the chat always reads
          // cleanly. (Normal prose replies keep fullText untouched.)
          const hasDisplayText = (extractDisplayText(fullText) || "").trim().length > 0;
          const contentForFinish =
            hasDisplayText
              ? fullText
              : summarizeOps({ sheetOps, docOps, kuOps, tableOps, deckOps, pageOps }) || fullText;

          finishStreaming(contentForFinish, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps, suggestions);

          // Non-silent truncation notice: server ran out of auto-continuations
          // and the answer is still cut off. Don't let a half-answer look whole.
          if (streamTruncated) {
            toast.warning("The response was long and may be cut off — ask the AI to continue if something's missing.");
          }
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
          if (partial.trim() || hasToolOps(toolOps)) {
            try {
              const sheetOps = parseSheetOperations(partial);
              const docOps = toolOps.doc.length ? toolOps.doc : parseDocOperations(partial);
              const kuOps = toolOps.ku.length ? toolOps.ku : parseKuOperations(partial);
              const tableOps = toolOps.table.length ? toolOps.table : parseTableOperations(partial);
              const deckOps = parseDeckOperations(partial);
              const pageOps = toolOps.page.length ? toolOps.page : parsePageOperations(partial);
              const hasPartialOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || deckOps.length > 0 || pageOps.length > 0;
              if (hasPartialOps) {
                finishStreaming(extractDisplayText(partial) || partial, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps);
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
      } finally {
        // Absolute guarantee: no code path leaves the UI stuck "streaming".
        // finishStreaming/abortStreaming clear isStreaming on every normal path;
        // this catches any unexpected escape (early return, throw in cleanup).
        if (useAppStore.getState().isStreaming) {
          console.warn("[Drafta] Stream ended without a clean finish — forcing recovery.");
          abortStreaming();
        }
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
  const isLoadingProject = useAppStore((s) => s.isLoadingProject);
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

  // Branded chat (V2):
  //  - docked (in a project): branded header + hero + greeting (brandedDocked)
  //  - full-screen (no project, `centered`): ChatGPT-style centered hero, with
  //    the landscape illustration when `branded`.
  const brandedDocked = !!branded && !centered;
  const showLanding = brandedDocked && !hasMessages && !(isLoadingProject && !!currentProjectId);

  return (
    <div className="flex flex-col h-full" style={{ background: brandedDocked ? "var(--card, #fff)" : undefined }}>
      {/* Header */}
      {brandedDocked ? (
        <div className="flex items-center gap-2 px-5 h-[54px] flex-shrink-0">
          <ChatLogoMark />
          <span className="font-semibold text-[15px] tracking-[-0.02em]" style={{ color: "var(--ink, #171716)" }}>Drafta AI</span>
          <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft, #F1F0ED)", color: "var(--ink-3, #706E68)" }}>Beta</span>
          <div className="flex-1" />
          {onToggleExpand && (
            <button onClick={onToggleExpand} title={expanded ? "Restore" : "Expand chat"}
              className="flex items-center justify-center w-7 h-7 rounded-[7px] press" style={{ color: "var(--icon, #585753)" }}>
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} title="Hide chat"
              className="flex items-center justify-center w-7 h-7 rounded-[7px] press" style={{ color: "var(--icon, #585753)" }}>
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      ) : !centered ? (
        <div className="flex items-center gap-2 px-4 h-[42px] flex-shrink-0 border-b border-[rgba(0,0,0,0.05)]">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FFB43F" }} />
          <span className="text-[12.5px] font-medium text-[#525252]">Assistant</span>
        </div>
      ) : null}
        {showLanding ? (
          /* Branded landing: hero illustration + warm greeting + input */
          <>
            <div className="flex-1 overflow-y-auto chat-scroll flex flex-col">
              <HeroLandscape />
              {/* greeting anchored toward the bottom — generous breathing room under the hero */}
              <div className="mt-auto px-7 pt-7 pb-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: "var(--accent-amber, #FFB43F)" }} />
                  <span className="font-semibold text-[18px] tracking-[-0.02em]" style={{ color: "var(--ink, #171716)" }}>Drafta</span>
                </div>
                <div className="text-[14.5px] leading-[1.6] space-y-4 [text-wrap:pretty]" style={{ color: "var(--ink, #171716)" }}>
                  <p>Hi there!</p>
                  <p>You can use the left workspace to start creating and organizing your work. Anything you create, we can chat about here.</p>
                  <p style={{ color: "var(--ink-2, #3B3A37)" }}>
                    Or, ask me to draft, summarize, or turn one file into another
                    {currentProject ? <> — I&apos;ve got the full context for <span className="font-medium" style={{ color: "var(--ink, #171716)" }}>{currentProject.title}</span></> : null}. Drag in any file.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <ChatInput onSend={sendMessage} disabled={isStreaming} centered={centered} onStop={stopStreaming} pill />
            </div>
          </>
        ) : showHeroLayout && branded ? (
          /* V2 full-screen landing: full-bleed illustration across the top, then
             the title + input centered, with a minimal on-theme create row. */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="relative w-full flex-shrink-0 overflow-hidden" style={{ height: 240 }} aria-hidden>
              <img src="/chat-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "center 46%" }} draggable={false} />
              <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(to bottom, transparent, var(--canvas, #FCFBF7))" }} />
            </div>
            <div className="flex-shrink-0 flex flex-col items-center px-6 pt-10 pb-16">
              <div className="w-full max-w-[640px]">
                <h1 className="font-heading text-[30px] font-semibold text-foreground text-center mb-6 tracking-[-0.03em] leading-tight">
                  What are you working on?
                </h1>
                <ChatInput
                  onSend={sendMessage}
                  disabled={isStreaming}
                  centered={centered}
                  onStop={stopStreaming}
                  placeholder={activePlaceholder || "Describe what you want to create..."}
                />
                <div className="flex items-center justify-center gap-2 mt-5">
                  {(["ku", "table", "deck"] as const).map((t) => {
                    const m = ENTITY_META[t];
                    return (
                      <button key={t} onClick={() => handleEntityPillClick(t)}
                        className="inline-flex items-center gap-1.5 h-[30px] pl-2.5 pr-3 rounded-full text-[12.5px] font-medium press"
                        style={{ background: m.bg, color: m.color }}>
                        <m.Icon size={13} /> {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : showHeroLayout ? (
          /* Legacy (non-branded) centered empty state: title + chatbox + pills */
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-[660px]">
              <h1 className="font-heading text-[32px] font-semibold text-foreground text-center mb-7 tracking-[-0.03em] leading-tight">
                What are you working on?
              </h1>
              <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                centered={centered}
                onStop={stopStreaming}
                placeholder={activePlaceholder || "Describe what you want to create..."}
              />
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
              {hasMessages || (isLoadingProject && !!currentProjectId) ? (
                <div className={centered ? "max-w-[680px] mx-auto w-full px-6" : ""}>
                  <MessageList />
                </div>
              ) : (
                <ExamplePrompts
                  onSelect={sendMessage}
                  hasProject={!!currentProjectId}
                  onEntityTypeSelect={handleEntityPillClick}
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
                pill={brandedDocked}
              />
            </div>
          </>
        )}
    </div>
  );
}

/* Branded Drafta mark — ink bars (matches the shell logo). */
function ChatLogoMark() {
  return (
    <div className="relative w-[20px] h-[20px] flex-shrink-0" aria-hidden>
      <span className="absolute left-0 top-[4px] w-[5px] h-[12px] rounded-r-full" style={{ background: "var(--ink, #171716)" }} />
      <span className="absolute left-[6px] top-[1px] w-[5px] h-[18px] rounded-full rotate-[-28deg]" style={{ background: "var(--ink, #171716)" }} />
      <span className="absolute left-[11px] top-[2px] w-[5px] h-[16px] rounded-full rotate-[28deg]" style={{ background: "var(--ink, #171716)" }} />
      <span className="absolute right-0 top-[5px] w-[4px] h-[10px] rounded-full" style={{ background: "var(--ink, #171716)" }} />
    </div>
  );
}

/* Lively hero illustration for the chat empty state (pastel-hills landscape). */
function HeroLandscape() {
  return (
    <div className="relative h-[188px] overflow-hidden flex-shrink-0" aria-hidden>
      <img
        src="/chat-hero.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 38%" }}
        draggable={false}
      />
      {/* soft fade into the chat surface */}
      <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to bottom, transparent, var(--card, #FFFDF8))" }} />
    </div>
  );
}

