import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { getModelConfig, getModel, estimateContextSize, type AITask } from "@/lib/ai/modelRouter";
import { auth } from "@/lib/auth";
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

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rateLimit = checkRateLimit(`${session.user.id}:chat`, 30, 60_000);
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
      // Detect deck generation intent from last message — user approving outline or requesting generation
      const lastMsg = messages[messages.length - 1];
      const lastContent = typeof lastMsg?.content === "string" ? lastMsg.content.toLowerCase() : "";
      const deckGenerationSignals = ["generate", "create the deck", "create the pitch", "create the presentation",
        "build the deck", "build the pitch", "build the presentation", "make the deck", "make the pitch",
        "make the presentation", "go ahead", "looks good", "let's go", "start generating", "generate now",
        "generate the slides", "generate the pitch", "create slides", "create it", "build it", "make it",
        "approved", "looks great", "perfect", "yes", "do it", "proceed"];
      if (deckGenerationSignals.some(s => lastContent.includes(s))) {
        taskType = "deck-generate";
      }
    } else if (deckPhase === "viewing" && activeEntityType === "deck") {
      taskType = "deck-edit";
    }
    if (taskType === "chat" && contextSize && contextSize > 30 * 1024) {
      taskType = "chat-heavy";
    }
    const modelConfig = getModelConfig(taskType, contextSize);
    const { model: modelId, maxOutputTokens, provider: modelProvider } = modelConfig;
    const isProModel = modelId.includes("pro");

    // Build the last user message with context injection
    const lastMessage = messages[messages.length - 1];

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

    let result;
    try {
      if (modelProvider === "google") {
        result = streamText({
          model: getModel(taskType, contextSize),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          maxOutputTokens,
          providerOptions: modelId.includes("pro") ? {
            google: { thinkingConfig: { thinkingBudget: taskType === "deck-generate" ? 2048 : 8192 } },
          } : undefined,
          tools: {
            googleSearch: google.tools.googleSearch({}),
          },
          abortSignal: req.signal,
        });
      } else {
        result = streamText({
          model: getModel(taskType, contextSize),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          maxOutputTokens,
          abortSignal: req.signal,
        });
      }
    } catch (error: any) {
      const msg = error?.message ?? "";
      console.error("[Drafta Chat] AI init error:", msg);
      const isRateLimit = msg.includes("quota") || msg.includes("rate") || msg.includes("429");
      return new Response(
        JSON.stringify({
          error: isRateLimit
            ? "Rate limit reached. Please wait a moment and try again."
            : "AI service is temporarily unavailable. Please try again.",
        }),
        {
          status: isRateLimit ? 429 : 502,
          headers: { "Content-Type": "application/json" },
        }
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

        try {
          const groundingSources: { title: string; uri: string }[] = [];

          // Use fullStream to get both text deltas and source events
          for await (const part of (await result).fullStream) {
            if (clientDisconnected) break;
            lastChunkTime = Date.now();

            if (part.type === "text-delta") {
              const data = JSON.stringify({ text: part.text });
              safeEnqueue(encoder.encode(`data: ${data}\n\n`));
            } else if (part.type === "source") {
              // AI SDK v6 emits source events from Google Search grounding
              if (part.sourceType === "url" && part.url) {
                groundingSources.push({
                  title: part.title || new URL(part.url).hostname,
                  uri: part.url,
                });
              }
            }
            // Ignore tool-call, tool-result, etc. — they're internal to Google Search
          }

          // Send grounding sources if web search was used
          if (!clientDisconnected && groundingSources.length > 0) {
            const groundingData = JSON.stringify({ grounding: { sources: groundingSources, queries: [] } });
            safeEnqueue(encoder.encode(`data: ${groundingData}\n\n`));
          }

          clearInterval(timeoutCheck);
          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
        } catch (error) {
          clearInterval(timeoutCheck);
          const errMsg = error instanceof Error ? error.message : "Stream error";
          console.error("[Drafta Chat] Stream error:", errMsg);
          if (!clientDisconnected) {
            // Handle rate limits — never leak raw error details to client
            const isRateLimit = errMsg.includes("quota") || errMsg.includes("rate") || errMsg.includes("429");
            const clientError = isRateLimit
              ? "Rate limit reached. Please wait a moment and try again."
              : "Something went wrong while generating a response. Please try again.";
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: clientError })}\n\n`
              )
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
}
