import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { getModelConfig, getModelCandidates, estimateContextSize, type AITask } from "@/lib/ai/modelRouter";
import { withPlanLimit, type PlanCtx } from "@/lib/billing";
import { getSlashCommand } from "@/lib/ai/slashCommands";
import { checkRateLimit } from "@/lib/rateLimit";
import "@/lib/env";

// Allow longer processing for deck generation and file-heavy requests
export const maxDuration = 300;

// Used for Google Search tool wiring on deck tasks (Gemini-only feature).
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });

/** Strip context-injection tags from user input to prevent prompt injection. */
function sanitizeUserContent(text: string): string {
  return text
    .replace(/<\/?relevant_document[^>]*>/g, "")
    .replace(/<\/?relevant_table[^>]*>/g, "")
    .replace(/<\/?project_context[^>]*>/g, "")
    .replace(/<\/?current_sheet_data[^>]*>/g, "")
    .replace(/<\/?current_doc_content[^>]*>/g, "")
    .replace(/<\/?project_memory[^>]*>/g, "")
    .replace(/<\/?uploaded_file[^>]*>/g, "")
    .replace(/<\/?mentioned_deck[^>]*>/g, "")
    .replace(/<\/?active_entity[^>]*>/g, "")
    .replace(/<\/?deck_phase[^>]*>/g, "");
}

// Note: withPlanLimit handles auth (returns 401 if no session) and meters
// the aiMessages counter atomically before invoking this handler. We rely
// on ctx.userId rather than calling auth() again — single source of truth,
// no defense-in-depth duplication.
const handler = async (req: NextRequest, ctx: PlanCtx): Promise<Response> => {
  try {
    const rateLimit = checkRateLimit(`${ctx.userId}:chat`, 30, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      messages,
      sheetData,
      docContent,
      projectMemory,
      projectContext,
      activeEntityId,
      activeEntityType,
      activeEntityTitle,
      activeEntityContent,
      deckPhase,
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Cap messages array to prevent token/memory abuse
    const MAX_MESSAGES = 200;
    if (messages.length > MAX_MESSAGES) {
      // Keep system context from first few + most recent messages
      messages.splice(0, messages.length - MAX_MESSAGES);
    }

    const contextSize = estimateContextSize({ sheetData, docContent, projectContext, messages });
    // Upgrade to Gemini 3.1 Pro for deck generation/editing
    let taskType: AITask = "chat";
    if (deckPhase === "generating") {
      taskType = "deck-generate";
    } else if (deckPhase === "idle") {
      // deckPhase is "idle" by default — including for users who never want a deck.
      // Only escalate to deck-generate when the request is unambiguously about a deck:
      //   1) the user explicitly mentions deck/presentation/slides/pitch deck, OR
      //   2) the user is approving an outline that the assistant just proposed.
      // Generic verbs like "generate" or "yes" must NOT hijack sheet/doc requests.
      const lastMsg = messages[messages.length - 1];
      const lastContent = typeof lastMsg?.content === "string" ? lastMsg.content.toLowerCase() : "";

      const explicitDeckMention = /\b(deck|presentation|pitch deck|slideshow|powerpoint|pptx|keynote|slide(s| deck))\b/.test(lastContent);

      // Approval signals only count when the previous assistant message contained a deckoutline block.
      const prevAssistant = messages.slice(0, -1).reverse().find((m: any) => m?.role === "assistant");
      const prevAssistantContent = typeof prevAssistant?.content === "string" ? prevAssistant.content : "";
      const prevHasOutline = prevAssistantContent.includes("```deckoutline");
      const approvalSignals = ["go ahead", "looks good", "let's go", "approved", "looks great", "do it", "proceed", "generate now", "start generating"];
      const isApproval = approvalSignals.some(s => lastContent.includes(s));

      if (explicitDeckMention || (isApproval && prevHasOutline)) {
        taskType = "deck-generate";
      }
    } else if (deckPhase === "viewing" && activeEntityType === "deck") {
      taskType = "deck-edit";
    }
    if (taskType === "chat" && contextSize && contextSize > 30 * 1024) {
      taskType = "chat-heavy";
    }
    const modelConfig = getModelConfig(taskType, contextSize);
    // "Pro" here = the higher-capacity model, used to widen sheet/doc context.
    const isProModel = modelConfig.model.includes("gpt-4.1") && !modelConfig.model.includes("mini");

    // Build the last user message with context injection
    const lastMessage = messages[messages.length - 1];

    // ── Slash command detection ────────────────────────────────────────
    // Inspect the last user message for a leading "/<name> " token.
    // If it matches a known command and the user's plan permits the
    // command's tier, append the command's prompt augmentation to
    // SYSTEM_PROMPT. Pro-only commands silently fall back to base
    // prompt for free users (UI also visually mutes them).
    let composedSystemPrompt = SYSTEM_PROMPT;
    if (lastMessage && Array.isArray((lastMessage as any).parts)) {
      // UIMessage shape — parts[0] may be { type: "text", text: ... }
      const firstPart = (lastMessage as any).parts.find((p: any) => p?.type === "text");
      const userText: string = typeof firstPart?.text === "string" ? firstPart.text : "";
      const slashMatch = userText.match(/^\/([a-z][a-z0-9_-]*)\b/i);
      if (slashMatch) {
        const cmd = getSlashCommand(slashMatch[1].toLowerCase());
        if (cmd) {
          const planPermits =
            cmd.tier === "starter" || (cmd.tier === "pro" && ctx.plan === "pro");
          if (planPermits) {
            const projectTitle =
              typeof projectContext === "object" && projectContext
                ? (projectContext as any).title
                : undefined;
            const augmentation = cmd.systemPromptFor({ projectTitle });
            composedSystemPrompt = `${SYSTEM_PROMPT}\n\n${augmentation}`;
          }
        }
      }
    }

    // Build sheet context as CSV for token efficiency
    let sheetContext = "";
    const sheetsWithData = (sheetData || []).filter((s: any) => s.celldata?.length > 0);
    if (sheetsWithData.length > 0) {
      sheetContext = sheetsWithData
        .map((s: any) => {
          let maxRow = 0;
          let maxCol = 0;
          for (const c of s.celldata) {
            if (c.r > maxRow) maxRow = c.r;
            if (c.c > maxCol) maxCol = c.c;
          }
          const rows: string[] = [];
          const sheetRowLimit = isProModel ? 500 : 100;
          for (let r = 0; r <= Math.min(maxRow, sheetRowLimit); r++) {
            const cells: string[] = [];
            for (let c = 0; c <= maxCol; c++) {
              const cell = s.celldata.find((cd: any) => cd.r === r && cd.c === c);
              const val = cell?.v?.f ? cell.v.f : (cell?.v?.v ?? "");
              cells.push(String(val).includes(",") ? `"${val}"` : String(val));
            }
            rows.push(cells.join(","));
          }
          return `Sheet: ${s.name}\n${rows.join("\n")}`;
        })
        .join("\n\n");
    }

    const docCharLimit = isProModel ? 100000 : 4000;
    const docContext = docContent ? docContent.slice(0, docCharLimit) : "";

    let textContent = sanitizeUserContent(lastMessage.content);

    // Detect search-intent queries
    const userTextLower = textContent.toLowerCase();
    const hasSearchIntent =
      /\b(search|look up|find out|research|google|check online|latest|current|recent news)\b/i.test(textContent) ||
      /\b(how many followers|engagement rate|follower count|trending|stock price|weather)\b/i.test(textContent) ||
      /\b(instagram|twitter|youtube|tiktok|linkedin|reddit)\b/i.test(userTextLower);
    if (hasSearchIntent) {
      textContent = `[Use Google Search to find real-time information for this query.]\n\n${textContent}`;
    }

    // Append extracted file text as context
    if (lastMessage.attachmentTexts?.length) {
      for (const att of lastMessage.attachmentTexts) {
        textContent += `\n\n<uploaded_file name="${att.name}">\n${att.text}\n</uploaded_file>`;
      }
    }

    // Inject active entity context so the AI knows what the user is currently viewing
    if (activeEntityId && activeEntityType && activeEntityTitle) {
      const ACTIVE_ENTITY_CAP = 10 * 1024; // 10KB
      const entityTypeLabels: Record<string, string> = {
        ku: "document",
        table: "sheet",
        deck: "deck",
      };
      const typeLabel = entityTypeLabels[activeEntityType] || activeEntityType;
      let entityContent = "";

      if (activeEntityType === "ku" && docContent) {
        entityContent = String(docContent).slice(0, ACTIVE_ENTITY_CAP);
      } else if (activeEntityType === "table" && sheetContext) {
        entityContent = sheetContext.slice(0, ACTIVE_ENTITY_CAP);
      } else if (activeEntityContent) {
        entityContent = String(activeEntityContent).slice(0, ACTIVE_ENTITY_CAP);
      }

      textContent += `\n\n<active_entity type="${typeLabel}" title="${activeEntityTitle}" id="${activeEntityId}">\n[Currently viewing: "${activeEntityTitle}" (${typeLabel})]\n${entityContent}\n</active_entity>`;
    }

    // Inject deck phase for conversational presentation flow
    if (deckPhase) {
      textContent += `\n\n<deck_phase>${deckPhase}</deck_phase>`;
    }

    textContent += `\n\n<current_sheet_data>\n${sheetContext}\n</current_sheet_data>`;
    textContent += `\n\n<current_doc_content>\n${docContext}\n</current_doc_content>`;

    // Inject project context if available
    if (projectContext) {
      if (projectContext.relevantKUs?.length > 0) {
        for (const ku of projectContext.relevantKUs) {
          textContent += `\n\n<relevant_document title="${ku.title}" id="${ku.id}">\n${ku.content}\n</relevant_document>`;
        }
      }
      if (projectContext.relevantTables?.length > 0) {
        for (const t of projectContext.relevantTables) {
          textContent += `\n\n<relevant_table title="${t.title}" id="${t.id}">\n${t.csvContent}\n</relevant_table>`;
        }
      }

      // Inject mentioned deck context
      if (projectContext.mentionedDeckContext) {
        textContent += projectContext.mentionedDeckContext;
      }

      let projCtx = `\n\n<project_context>\nProject: "${projectContext.title}" (id: ${projectContext.id})`;
      if (projectContext.knowledgeUnits?.length > 0) {
        projCtx += `\n\nKnowledge Units:`;
        for (const ku of projectContext.knowledgeUnits) {
          const isExpanded = projectContext.relevantKUs?.some((r: any) => r.id === ku.id);
          projCtx += `\n- "${ku.title}" (id: ${ku.id})${isExpanded ? " [full content provided above]" : ` — ${ku.summary}${ku.summary.length >= 200 ? "..." : ""}`}`;
        }
      }
      if (projectContext.tables?.length > 0) {
        projCtx += `\n\nTables:`;
        for (const t of projectContext.tables) {
          const isExpanded = projectContext.relevantTables?.some((r: any) => r.id === t.id);
          projCtx += `\n- "${t.title}" (id: ${t.id})${isExpanded ? " [full CSV provided above]" : ` — columns: [${(t.headers || []).join(", ")}]`}`;
        }
      }
      projCtx += `\n</project_context>`;
      textContent += projCtx;
    }

    // Include project memory
    if (projectMemory && Object.keys(projectMemory).length > 0) {
      let memoryContext = "\n\n<project_memory>";
      if (projectMemory.tone) memoryContext += `\nTone: ${projectMemory.tone}`;
      if (projectMemory.audience) memoryContext += `\nAudience: ${projectMemory.audience}`;
      if (projectMemory.goals) memoryContext += `\nGoals: ${projectMemory.goals}`;
      if (projectMemory.customInstructions) memoryContext += `\nCustom Instructions: ${projectMemory.customInstructions}`;
      memoryContext += "\n</project_memory>";
      textContent += memoryContext;
    }

    // Hard cap on context size to prevent model input overflow.
    // ~400K chars ≈ ~100K tokens, well within limits for both providers.
    // System prompt (~27K chars) + output tokens are separate.
    const MAX_CONTEXT_CHARS = 400_000;
    if (textContent.length > MAX_CONTEXT_CHARS) {
      textContent = textContent.slice(0, MAX_CONTEXT_CHARS);
    }

    // Build AI SDK messages: history + enriched last message
    const aiMessages: UIMessage[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      const m = messages[i];
      aiMessages.push({
        id: `msg-${i}`,
        role: m.role === "assistant" ? "assistant" : "user",
        parts: [{ type: "text", text: m.content }],
      });
    }

    // Build last user message with text + optional images
    const lastParts: UIMessage["parts"] = [{ type: "text", text: textContent }];
    if (lastMessage.imageAttachments?.length) {
      for (const img of lastMessage.imageAttachments) {
        // Vercel AI SDK v6 UIMessage expects file parts with a data URL
        const mimeType = img.mimeType || "image/jpeg";
        lastParts.push({
          type: "file",
          mediaType: mimeType,
          url: `data:${mimeType};base64,${img.base64}`,
        });
      }
    }
    aiMessages.push({
      id: `msg-${messages.length - 1}`,
      role: "user",
      parts: lastParts,
    });

    // Convert UIMessages to model messages for streamText
    const modelMessages = await convertToModelMessages(aiMessages);

    // Ordered model candidates — the route tries each until one streams text,
    // so a transient provider error never dead-ends as "No response".
    const candidates = getModelCandidates(taskType, contextSize);
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI is not configured. Please set OPENAI_API_KEY." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream response as custom SSE format (compatible with existing client)
    let clientDisconnected = false;
    req.signal.addEventListener("abort", () => {
      clientDisconnected = true;
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let closed = false;
        const safeEnqueue = (data: Uint8Array) => {
          if (closed || clientDisconnected) return;
          try {
            controller.enqueue(data);
          } catch {
            closed = true;
          }
        };
        const safeClose = () => {
          if (closed) return;
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        };

        // Timeout: abort if no chunks arrive within timeout period
        // Deck generation with thinking needs longer — model thinks before first token
        const chunkTimeoutMs = taskType.startsWith("deck") ? 120000 : 30000;
        let lastChunkTime = Date.now();
        const timeoutCheck = setInterval(() => {
          if (clientDisconnected) {
            clearInterval(timeoutCheck);
            safeClose();
            return;
          }
          if (Date.now() - lastChunkTime > chunkTimeoutMs) {
            clearInterval(timeoutCheck);
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "Response timed out. Please try again." })}\n\n`)
            );
            safeEnqueue(encoder.encode("data: [DONE]\n\n"));
            safeClose();
          }
        }, 5000);

        const groundingSources: { title: string; uri: string }[] = [];
        let emittedText = false;
        let lastError: unknown = null;

        // Stream one candidate; throws if the provider errors so the caller
        // can fall back to the next candidate (only safe before any text).
        const runCandidate = async (cand: (typeof candidates)[number]) => {
          const result = streamText({
            model: cand.model,
            system: composedSystemPrompt,
            messages: modelMessages,
            maxOutputTokens: cand.maxOutputTokens,
            ...(cand.isGoogle && cand.modelId.includes("pro")
              ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: taskType === "deck-generate" ? 2048 : 8192 } } } }
              : {}),
            ...(cand.isGoogle ? { tools: { googleSearch: google.tools.googleSearch({}) } } : {}),
            abortSignal: req.signal,
          });

          for await (const part of result.fullStream) {
            if (clientDisconnected) break;
            lastChunkTime = Date.now();
            if (part.type === "text-delta") {
              emittedText = true;
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
            } else if (part.type === "source") {
              if (part.sourceType === "url" && part.url) {
                groundingSources.push({ title: part.title || new URL(part.url).hostname, uri: part.url });
              }
            } else if (part.type === "error") {
              // fullStream surfaces provider failures as an error part
              throw part.error instanceof Error ? part.error : new Error(String(part.error));
            }
          }
        };

        try {
          for (let i = 0; i < candidates.length; i++) {
            try {
              await runCandidate(candidates[i]);
              lastError = null;
              break; // streamed to completion
            } catch (err) {
              lastError = err;
              console.error(`[Drafta Chat] candidate ${candidates[i].label} failed:`, err instanceof Error ? err.message : err);
              // Can only retry a fresh candidate if nothing was sent yet.
              if (emittedText || clientDisconnected) break;
            }
          }

          clearInterval(timeoutCheck);

          if (lastError && !emittedText && !clientDisconnected) {
            const errMsg = lastError instanceof Error ? lastError.message : "";
            const isRateLimit = /quota|rate.?limit|429/i.test(errMsg);
            const clientError = isRateLimit
              ? "Rate limit reached. Please wait a moment and try again."
              : "The AI is temporarily unavailable. Please try again in a moment.";
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: clientError })}\n\n`));
          } else if (!clientDisconnected && groundingSources.length > 0) {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ grounding: { sources: groundingSources, queries: [] } })}\n\n`));
          }

          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
        } catch (error) {
          clearInterval(timeoutCheck);
          console.error("[Drafta Chat] Stream error:", error instanceof Error ? error.message : error);
          if (!clientDisconnected) {
            safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "Something went wrong while generating a response. Please try again." })}\n\n`)
            );
            safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          }
          safeClose();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Drafta Chat] Unhandled error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST = withPlanLimit(handler, { resource: "aiMessages" });
