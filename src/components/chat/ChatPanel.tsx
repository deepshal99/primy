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
import { LogoMark } from "@/components/shared/Logo";
import { TextReveal } from "@/components/ui/transitions";
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
        console.error("[Primy] Streaming state stuck — auto-recovering after 150s timeout");
        abortControllerRef.current?.abort();
        abortStreaming(useAppStore.getState().currentProjectId);
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
      // Prevent concurrent streams in the SAME project (different projects may
      // stream at once — streams are per-project now).
      {
        const cur = useAppStore.getState().currentProjectId;
        if (cur && useAppStore.getState().streamingProjectIds.includes(cur)) return;
      }

      // Read-only enforcement: viewers/commenters can't drive AI mutations.
      const role = useAppStore.getState().currentProjectRole;
      if (role === "viewer" || role === "commenter") {
        toast.error("You have view-only access to this project.");
        return;
      }

      // Auto-create a project if none exists
      if (!useAppStore.getState().currentProjectId) {
        useAppStore.getState().createProject("New Project");
        useAppStore.setState({ workspaceOpen: false });
      }

      // Stamp the stream with the project it STARTED in. finishStreaming routes
      // results here even if the user navigates to another project mid-stream.
      const streamProjectId = useAppStore.getState().currentProjectId;

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
      startStreaming(streamProjectId);

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
              useAppStore.getState().setReadingFiles(streamProjectId, readingFiles);
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
            abortStreaming(streamProjectId);
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

        // Smooth streaming: coalesce per-token store writes into one flush per
        // animation frame. The server emits many small text deltas; calling
        // appendStreamChunk on every one re-renders the message list (and
        // re-parses the markdown) dozens of times a second, which reads as
        // jitter. Buffering to a rAF caps that at ~60fps without dropping text.
        let pendingChunk = "";
        let rafId: number | null = null;
        const flushPending = () => {
          rafId = null;
          if (pendingChunk) {
            appendStreamChunk(streamProjectId, pendingChunk);
            pendingChunk = "";
          }
        };
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
              pendingChunk += parsed.text;
              if (rafId === null) rafId = requestAnimationFrame(flushPending);
            }
            if (parsed.grounding) {
              groundingSources = parsed.grounding.sources || [];
            }
            if (parsed.error) {
              streamError = parsed.error;
              console.error("[Primy] Stream error:", parsed.error);
            }
            if (parsed.meta?.truncated) {
              // Server exhausted its auto-continuations and the response is still
              // cut off. Surface it — never let a half-finished answer look whole.
              streamTruncated = true;
            }
            if (parsed.toolStart?.name) {
              // Model began a tool call — show the live action pill right away.
              const kind = toolIndicatorKind(parsed.toolStart.name);
              if (kind) useAppStore.getState().setStreamingAction(streamProjectId, kind);
            }
            if (parsed.toolCall?.name) {
              // Schema-validated action — collect it for apply at stream end.
              applyToolCall(parsed.toolCall.name, parsed.toolCall.input, toolOps);
            }
          } catch {
            // Malformed chunk — log first few for debugging
            if (chunkCount <= 3) console.warn("[Primy] Malformed SSE chunk:", data.slice(0, 200));
          }
        };

        // Client-side stall detection: if no chunks arrive for 60s, abort
        const STALL_TIMEOUT_MS = 60_000;
        const stallCheck = setInterval(() => {
          if (Date.now() - lastChunkAt > STALL_TIMEOUT_MS) {
            clearInterval(stallCheck);
            console.error("[Primy] Stream stalled — no data for 60s. Aborting.");
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
          // Flush any buffered tail synchronously so the abort/partial path and
          // the final render never miss the last frame's worth of text.
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushPending();
        }

        if (buffer.trim()) {
          const remaining = buffer.split("\n");
          for (const line of remaining) {
            processLine(line);
          }
        }

        if (streamError && !fullText.trim()) {
          console.error("[Primy] Stream completed with error, no text. Error:", streamError, "Chunks received:", chunkCount);
          abortStreaming(streamProjectId);
          toast.error(streamError.includes("Rate limit") ? streamError : "AI couldn't generate a response. Please try again.");
          return;
        }

        if (!fullText.trim() && !hasToolOps(toolOps)) {
          console.warn("[Primy] Stream completed with empty text. Chunks received:", chunkCount, "Buffer remainder:", buffer.slice(0, 200));
          abortStreaming(streamProjectId);
          toast.error("No response received from AI. Please try again.");
          return;
        }

        // Parse operations and apply to store — wrapped in try/catch so a parse/apply
        // failure never loses the AI's text response
        try {
          useAppStore.getState().setAIPhase(streamProjectId, 'updating');

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
          let pageOps = toolOps.page.length ? toolOps.page : parsePageOperations(fullText);
          // De-dup: a deck and a page are mutually exclusive deliverables. When
          // the model emits BOTH a deck CREATE and a page CREATE in one response
          // it has rendered the same slides twice — the deck once in the Decks
          // section and again as a Page. Drop the redundant page CREATE so the
          // deck doesn't appear in two places. (UPDATE/RENAME/DELETE page ops
          // target existing pages and are left untouched.)
          if (deckOps.some((o) => o.type === "CREATE") && pageOps.some((o) => o.type === "CREATE")) {
            console.warn("[Primy] Suppressing duplicate page CREATE — deck CREATE present in the same response.");
            pageOps = pageOps.filter((o) => o.type !== "CREATE");
          }
          const suggestions = parseSuggestions(fullText);
          const outlineItems = parseDeckOutlineItems(fullText);
          const hasAnyOps = sheetOps.length > 0 || docOps.length > 0 || kuOps.length > 0 || tableOps.length > 0 || deckOps.length > 0 || pageOps.length > 0;
          if (!hasAnyOps && outlineItems.length === 0) {
            const hasFences = fullText.includes("```tableops") || fullText.includes("```sheetops") || fullText.includes("```kuops") || fullText.includes("```docops") || fullText.includes("```deckops") || fullText.includes("```pageops") || fullText.includes("```deckoutline");
            if (hasFences) {
              console.warn("[Primy] Operation blocks found but none parsed. Raw tail:", fullText.slice(-600));
              toast.error("AI response had formatting issues. Some changes may not have been applied. Try again.");
            } else {
              // Claim/action reconciliation: catch the rare case where the model
              // SAYS it created/updated a Primy artifact but emitted no tool call
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
                console.warn("[Primy] Model claimed an artifact action but emitted no operation. Lead:", lead);
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

          // Mark the turn truncated when the server ran out of auto-continuations
          // and the answer is still cut off. This lands on the assistant message
          // itself (right project), surfacing a persistent "Continue" affordance
          // in the bubble instead of a toast that vanishes.
          finishStreaming(streamProjectId, contentForFinish, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps, suggestions, { truncated: streamTruncated });
        } catch (applyError) {
          // Operation parsing or store mutation failed — still save the AI text response
          console.error("[Primy] Failed to apply AI operations:", applyError);
          finishStreaming(streamProjectId, extractDisplayText(fullText) || fullText);
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
                finishStreaming(streamProjectId, extractDisplayText(partial) || partial, sheetOps, docOps, kuOps, tableOps, deckOps, pageOps);
              } else {
                finishStreaming(streamProjectId, extractDisplayText(partial) || partial);
              }
            } catch {
              finishStreaming(streamProjectId, extractDisplayText(partial) || partial);
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
            abortStreaming(streamProjectId);
          }
          return;
        }
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        abortStreaming(streamProjectId);
        toast.error(errMsg);
      } finally {
        // Absolute guarantee: no code path leaves THIS stream stuck "streaming".
        // finishStreaming/abortStreaming clear it on every normal path; this
        // catches any unexpected escape (early return, throw in cleanup). Check
        // by the stream's own project so a since-switched-away view still clears.
        const stuck = streamProjectId
          ? useAppStore.getState().streamingProjectIds.includes(streamProjectId)
          : useAppStore.getState().isStreaming;
        if (stuck) {
          console.warn("[Primy] Stream ended without a clean finish — forcing recovery.");
          abortStreaming(streamProjectId);
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
    window.addEventListener("primy:send-message", handler);
    return () => window.removeEventListener("primy:send-message", handler);
  }, [sendMessage]);

  const hasMessages = messages.length > 0;
  const isLoadingProject = useAppStore((s) => s.isLoadingProject);
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
          <span className="font-semibold text-[15px] tracking-[-0.02em]" style={{ color: "var(--ink, #171716)" }}>Primy</span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft, #F1F0ED)", color: "var(--ink-3, #706E68)" }}>Beta</span>
          <div className="flex-1" />
          {onToggleExpand && (
            <button onClick={onToggleExpand} title={expanded ? "Restore" : "Expand chat"}
              className="flex items-center justify-center w-7 h-7 rounded-[7px] press icon-hover" style={{ color: "var(--icon, #585753)" }}>
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onCollapse && (
            <button onClick={onCollapse} title="Hide chat"
              className="flex items-center justify-center w-7 h-7 rounded-[7px] press icon-hover" style={{ color: "var(--icon, #585753)" }}>
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      ) : !centered ? (
        <div className="flex items-center gap-2 px-4 h-[42px] flex-shrink-0 border-b border-border">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FFB43F" }} />
          <span className="text-[13px] font-medium text-muted-foreground">Assistant</span>
        </div>
      ) : null}
        {showLanding ? (
          /* Branded landing: hero illustration + warm greeting + input */
          <>
            <div className="flex-1 overflow-y-auto chat-scroll flex flex-col">
              <HeroLandscape />
              {/* greeting anchored toward the bottom — generous breathing room under the hero */}
              <div className="mt-auto px-7 pt-7 pb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0" style={{ background: "var(--accent-amber, #FFB43F)" }}>
                    <LogoMark size={16} style={{ color: "var(--ink, #171716)" }} />
                  </span>
                  <span className="font-semibold text-[18px] tracking-[-0.02em]" style={{ color: "var(--ink, #171716)" }}>Primy</span>
                </div>
                <div className="text-[15px] leading-[1.62] space-y-[18px] [text-wrap:pretty]" style={{ color: "var(--ink, #171716)" }}>
                  <p>Hi there!</p>
                  <p>Create docs, sheets, decks, and pages in the workspace on the left. Anything you make, we can work on here.</p>
                  <p style={{ color: "var(--ink-2, #3B3A37)" }}>
                    Or just ask. I can draft, summarize, or turn one file into another. Drag in any file to start.
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
              <HeroIllustration wide className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(to bottom, transparent, var(--canvas, #FCFBF7))" }} />
            </div>
            <div className="flex-shrink-0 flex flex-col items-center px-6 pt-10 pb-16">
              <div className="w-full max-w-[640px]">
                <TextReveal>
                  <h1 className="font-heading text-[30px] font-semibold text-foreground text-center mb-6 tracking-[-0.03em] leading-tight">
                    What are you working on?
                  </h1>
                </TextReveal>
                <ChatInput
                  onSend={sendMessage}
                  disabled={isStreaming}
                  centered={centered}
                  onStop={stopStreaming}
                  placeholder={activePlaceholder || "Describe what you want to create..."}
                />
                <div className="flex items-center justify-center gap-2 mt-6">
                  {(["ku", "table", "deck"] as const).map((t, i) => {
                    const m = ENTITY_META[t];
                    return (
                      <button
                        key={t}
                        onClick={() => handleEntityPillClick(t)}
                        className="group inline-flex items-center gap-1.5 h-[32px] pl-2.5 pr-3.5 rounded-full text-[13px] font-medium press animate-fade-in-up t-colors"
                        style={{
                          background: "var(--card, #FFFDFB)",
                          color: "var(--ink-2, #3B3A37)",
                          border: "1px solid var(--border, rgba(24,24,22,0.08))",
                          animationDelay: `${120 + i * 50}ms`,
                          animationFillMode: "both",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,180,63,0.45)";
                          e.currentTarget.style.background = "rgba(255,180,63,0.08)";
                          e.currentTarget.style.color = "var(--ink, #171716)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border, rgba(24,24,22,0.08))";
                          e.currentTarget.style.background = "var(--card, #FFFDFB)";
                          e.currentTarget.style.color = "var(--ink-2, #3B3A37)";
                        }}
                      >
                        <m.Icon
                          size={14}
                          strokeWidth={1.8}
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                          style={{ color: "var(--icon, #585753)" }}
                        />
                        {m.label}
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
              <h1 className="font-heading text-[30px] font-semibold text-foreground text-center mb-7 tracking-[-0.03em] leading-tight">
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

/* Branded Primy mark — ink bars (matches the shell logo). */
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
      <HeroIllustration className="absolute inset-0 w-full h-full" />
      {/* soft fade into the chat surface */}
      <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to bottom, transparent, var(--card, #FFFDF8))" }} />
    </div>
  );
}

/**
 * On-brand flat illustration for the chat hero — pale warm sky, a soft sun,
 * line-art arcs and rolling teal/amber hills. Replaces the photographic hero so
 * it recedes into the warm shell instead of fighting it. Vector → crisp at any
 * size, theme-neutral, zero network cost.
 */
function HeroIllustration({ className, style, wide }: { className?: string; style?: React.CSSProperties; wide?: boolean }) {
  // Shared gradient palette — vivid blue dome, warm orange ridge, cream lake.
  const defs = (
    <defs>
      <linearGradient id="dh-dome" x1="0.2" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#3C6CE0" />
        <stop offset="58%" stopColor="#5C8CEF" />
        <stop offset="100%" stopColor="#EBF1FD" />
      </linearGradient>
      <linearGradient id="dh-ridge" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#F0896A" />
        <stop offset="52%" stopColor="#F4A24C" />
        <stop offset="100%" stopColor="#F8BE45" />
      </linearGradient>
      <linearGradient id="dh-water" x1="0" y1="0" x2="0.1" y2="1">
        <stop offset="0%" stopColor="#4E92DB" />
        <stop offset="100%" stopColor="#DEEAF8" />
      </linearGradient>
      <linearGradient id="dh-lake" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#FCF6E0" />
        <stop offset="100%" stopColor="#F6E9C2" />
      </linearGradient>
    </defs>
  );

  // Wide panorama for the full-screen banner (≈5:1) — the same motif spread
  // across so nothing gets vertically cropped by the slice.
  if (wide) {
    return (
      <svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden role="img">
        {defs}
        <path d="M540 240 C 780 150 1000 152 1200 58 L1200 240 Z" fill="url(#dh-ridge)" />
        <path d="M780 240 C 930 196 1070 202 1200 190 L1200 240 Z" fill="url(#dh-water)" />
        <circle cx="232" cy="372" r="244" fill="url(#dh-dome)" />
        <ellipse cx="540" cy="200" rx="118" ry="22" fill="#69CEC8" opacity="0.85" />
        <ellipse cx="650" cy="184" rx="186" ry="34" fill="url(#dh-lake)" transform="rotate(-7 650 184)" />
        <g fill="#1A1815">
          <circle cx="958" cy="150" r="4" />
          <circle cx="1004" cy="143" r="4" />
          <circle cx="1050" cy="135" r="4" />
        </g>
        <g fill="none" stroke="#1A1815" strokeWidth="2" strokeLinecap="round">
          <path d="M236 206 L236 116" />
          <circle cx="222" cy="96" r="32" strokeOpacity="0.92" />
          <circle cx="258" cy="120" r="22" strokeOpacity="0.92" />
        </g>
      </svg>
    );
  }

  // Portrait-ish panel for the docked chat hero (≈2.3:1) — matches the reference.
  return (
    <svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden role="img">
      {defs}
      <path d="M88 230 C 210 158 322 150 405 64 L405 230 Z" fill="url(#dh-ridge)" />
      <path d="M206 230 C 296 190 360 198 405 184 L405 230 Z" fill="url(#dh-water)" />
      <circle cx="104" cy="296" r="158" fill="url(#dh-dome)" />
      <ellipse cx="206" cy="196" rx="46" ry="15" fill="#69CEC8" opacity="0.85" />
      <ellipse cx="250" cy="180" rx="92" ry="25" fill="url(#dh-lake)" transform="rotate(-9 250 180)" />
      <g fill="#1A1815">
        <circle cx="322" cy="142" r="3.1" />
        <circle cx="344" cy="138" r="3.1" />
        <circle cx="366" cy="133" r="3.1" />
      </g>
      <g fill="none" stroke="#1A1815" strokeWidth="1.5" strokeLinecap="round">
        <path d="M92 196 L92 132" />
        <circle cx="84" cy="118" r="22" strokeOpacity="0.92" />
        <circle cx="107" cy="133" r="15" strokeOpacity="0.92" />
      </g>
    </svg>
  );
}

