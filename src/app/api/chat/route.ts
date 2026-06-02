import { streamText, convertToModelMessages, type UIMessage, type ToolSet } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { NextRequest } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { getModelConfig, getModelCandidates, estimateContextSize, type AITask } from "@/lib/ai/modelRouter";
import { PRIMY_TOOLS, TOOL_ROUTING_PROMPT } from "@/lib/ai/primyTools";
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

    // ── Deck phase resolution ──────────────────────────────────────────
    // `deckPhase` arrives verbatim from the client store, but in the pure
    // chat flow the client has NO affordance to advance "idle" → "generating"
    // (the theme picker that used to set it is now an optional popover). If we
    // trusted the client value we'd stay "idle" forever: the model keeps
    // following the idle-phase instructions (gather & outline) and re-emits the
    // outline on every "generate" instead of producing deckops slides.
    //
    // So we DERIVE the effective phase here and inject THAT into the prompt.
    // We advance idle → generating only once the assistant has already shown an
    // outline AND the user's latest message asks to generate / approves it —
    // generic chatter must not hijack sheet/doc requests.
    let effectiveDeckPhase: string = deckPhase || "idle";
    if (effectiveDeckPhase === "idle") {
      const lastMsg = messages[messages.length - 1];
      const lastContent = typeof lastMsg?.content === "string" ? lastMsg.content.toLowerCase() : "";

      // Only consider advancing when the thread is actually about a deck — this
      // keeps "yes"/"generate" from hijacking a sheet/doc conversation.
      const deckConversation = messages.some(
        (m: any) =>
          typeof m?.content === "string" &&
          /\b(deck|presentation|pitch deck|slideshow|powerpoint|pptx|keynote|slide(s| deck)?)\b/i.test(m.content)
      );

      // Has a prior assistant turn already presented a slide outline? Accept the
      // deckoutline fenced block OR a prose outline (≥3 "[Category]" labels, the
      // shape the model actually emits in chat).
      const outlineShown =
        deckConversation &&
        messages.slice(0, -1).some((m: any) => {
          if (m?.role !== "assistant" || typeof m.content !== "string") return false;
          if (m.content.includes("```deckoutline")) return true;
          return (m.content.match(/\[[A-Z][a-zA-Z]{2,}\]/g)?.length ?? 0) >= 3;
        });

      // Generate / approve intent in the latest user message. This only fires
      // when a deck outline was ALREADY shown in a deck conversation (see
      // `outlineShown` gate above), so generic approvals here can't hijack a
      // sheet/doc thread. Outline-editing verbs ("add", "remove", "move",
      // "swap") are deliberately excluded — those keep the deck in outlining.
      const wantsGeneration =
        /\b(generate|build( it)?|create( it)?|make( it)?|render|produce( it)?|proceed|go ahead|let'?s go|do it|start|draft it|approved?|looks good|looks great|perfect|sounds good|ship it|yes|yep|yeah|sure|okay|ok|go for it|continue)\b/.test(
          lastContent
        );

      if (outlineShown && wantsGeneration) {
        effectiveDeckPhase = "generating";
      }
    }

    // Upgrade to Gemini 3.1 Pro for deck generation/editing
    let taskType: AITask = "chat";
    if (effectiveDeckPhase === "generating") {
      taskType = "deck-generate";
    } else if (effectiveDeckPhase === "viewing" && activeEntityType === "deck") {
      taskType = "deck-edit";
    }
    if (taskType === "chat" && contextSize && contextSize > 30 * 1024) {
      taskType = "chat-heavy";
    }
    const modelConfig = getModelConfig(taskType, contextSize);
    // "Pro" here = the higher-capacity model, used to widen sheet/doc context.
    // Any non-"mini" model (gpt-5.5, gpt-4.1) is pro-tier; only *-mini is not.
    const isProModel = !modelConfig.model.includes("mini");

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

    // Layer B: schema-validated action tools are active ONLY for chat tasks
    // (where docs/sheets/pages are created). Deck tasks keep their dedicated
    // fenced/outline flow untouched. The gpt-4.1 fallback candidate also
    // supports function calling, so tools survive a fallback.
    // Tools are decided here (before the complexRequest escalation below); a
    // complex chat request is still "chat"/"chat-heavy" at this point, so tools
    // stay enabled when it later escalates to "chat-deep".
    const useTools = taskType === "chat" || taskType === "chat-heavy";
    const primyTools = useTools ? PRIMY_TOOLS : undefined;
    if (useTools) {
      composedSystemPrompt = `${composedSystemPrompt}\n\n${TOOL_ROUTING_PROMPT}`;
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

    // Complex-reasoning intent → bump gpt-5.x reasoning effort to "high" for a
    // sharper answer on hard, open-ended tasks (strategy, analysis, planning).
    // Everyday requests stay on the registry default (low) for snappy latency.
    // Never applied to the gpt-4.1 fallback — it carries no reasoningEffort and
    // would reject the param.
    const complexRequest =
      /\b(strateg(?:y|ic)|analy[sz]e|analysis|comprehensive|in-?depth|deep dive|road ?map|business case|financial model|forecast|evaluate|trade-?offs?|pros and cons|framework|competitive|go-to-market|gtm)\b/i.test(userTextLower);
    // Escalate only genuinely complex chat to the deeper (slower) GPT-5.5 model;
    // everyday chat stays on fast gpt-4.1. Deck tasks are unaffected.
    if (complexRequest && (taskType === "chat" || taskType === "chat-heavy")) {
      taskType = "chat-deep";
    }
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

    // Inject the SERVER-DERIVED deck phase (see resolution above) — not the raw
    // client value — so the model actually switches to slide generation.
    if (effectiveDeckPhase) {
      textContent += `\n\n<deck_phase>${effectiveDeckPhase}</deck_phase>`;
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

        // Timeout: abort if no chunks arrive within timeout period.
        // Deck generation with thinking needs longest; gpt-5.x chat reasons
        // before the first token, so chat gets 45s (was 30s) to avoid killing a
        // healthy stream mid-reasoning.
        const chunkTimeoutMs = taskType.startsWith("deck") ? 120000 : 45000;
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
        let emittedToolCall = false;       // Layer B: a tool call was streamed
        let lastError: unknown = null;
        let accumulatedText = "";          // full assistant text across continuations
        let finishReason: string | null = null;

        // Build provider options per candidate. gpt-5.x reasoning/verbosity is
        // applied ONLY when the candidate carries them — the gpt-4.1 fallback
        // has neither, so it never receives params it would reject.
        const providerOptionsFor = (cand: (typeof candidates)[number]) => {
          const opts: Record<string, any> = {};
          if (!cand.isGoogle && (cand.reasoningEffort || cand.verbosity)) {
            // Effort/verbosity come straight from the candidate (gpt-5.x only;
            // the gpt-4.1 fallback carries neither and stays bare). Complexity is
            // now handled by model SELECTION (chat-deep), not an effort bump.
            opts.openai = {
              ...(cand.reasoningEffort ? { reasoningEffort: cand.reasoningEffort } : {}),
              ...(cand.verbosity ? { textVerbosity: cand.verbosity } : {}),
            };
          }
          if (cand.isGoogle && cand.modelId.includes("pro")) {
            opts.google = { thinkingConfig: { thinkingBudget: taskType === "deck-generate" ? 2048 : 8192 } };
          }
          return Object.keys(opts).length > 0 ? opts : undefined;
        };

        // Stream one candidate over the given messages. Returns the finishReason
        // ("stop" | "length" | …) or throws so the caller can fall back to the
        // next candidate (only safe before any text). Resets the stall clock so
        // a fallback/continuation never inherits a stalled candidate's elapsed
        // time and get killed before its first token.
        const runCandidate = async (
          cand: (typeof candidates)[number],
          msgs: typeof modelMessages,
        ): Promise<string | null> => {
          lastChunkTime = Date.now();
          const providerOptions = providerOptionsFor(cand);
          // Unify both tool sources to ToolSet so the conditional spread doesn't
          // produce a union `tools` type that streamText can't infer.
          const activeTools: ToolSet | undefined = cand.isGoogle
            ? ({ googleSearch: google.tools.googleSearch({}) } as ToolSet)
            : (primyTools as ToolSet | undefined);
          const result = streamText({
            model: cand.model,
            system: composedSystemPrompt,
            messages: msgs,
            maxOutputTokens: cand.maxOutputTokens,
            ...(providerOptions ? { providerOptions } : {}),
            ...(activeTools
              ? { tools: activeTools, ...(cand.isGoogle ? {} : { toolChoice: "auto" as const }) }
              : {}),
            abortSignal: req.signal,
          });

          let localFinish: string | null = null;
          for await (const part of result.fullStream) {
            if (clientDisconnected) break;
            lastChunkTime = Date.now();
            if (part.type === "text-delta") {
              emittedText = true;
              accumulatedText += part.text;
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ text: part.text })}\n\n`));
            } else if (part.type === "tool-input-start") {
              // Model began a tool call — fire the live action pill immediately
              // (the input args may stream for several seconds before completing).
              const name = (part as { toolName?: string }).toolName;
              if (name) safeEnqueue(encoder.encode(`data: ${JSON.stringify({ toolStart: { name } })}\n\n`));
            } else if (part.type === "tool-call") {
              // Final, schema-validated tool call. Forward to the client, which
              // applies it to the store (create/edit the entity + auto-open).
              emittedToolCall = true;
              const tc = part as { toolName?: string; input?: unknown };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ toolCall: { name: tc.toolName, input: tc.input } })}\n\n`));
            } else if (part.type === "source") {
              if (part.sourceType === "url" && part.url) {
                groundingSources.push({ title: part.title || new URL(part.url).hostname, uri: part.url });
              }
            } else if (part.type === "finish") {
              // fullStream emits a terminal finish part with the stop reason.
              localFinish = (part as { finishReason?: string }).finishReason ?? null;
            } else if (part.type === "error") {
              // fullStream surfaces provider failures as an error part
              throw part.error instanceof Error ? part.error : new Error(String(part.error));
            }
          }
          return localFinish;
        };

        // A transient provider blip (5xx / overload / network) tends to fail BOTH
        // OpenAI candidates at once, so cross-model fallback alone isn't enough.
        // Give each candidate ONE quick same-model retry on a transient error —
        // but only while nothing has been emitted, so a retry can't duplicate
        // output. Hard errors (4xx, quota, bad request) are not retried.
        const isTransient = (err: unknown) => {
          const m = err instanceof Error ? err.message : String(err);
          if (/quota|invalid|unsupported|\b400\b|\b401\b|\b403\b|\b404\b/i.test(m)) return false;
          return /\b5\d\d\b|overload|temporar|timeout|timed out|ECONNRESET|ETIMEDOUT|network|fetch failed/i.test(m);
        };
        const runCandidateResilient = async (
          cand: (typeof candidates)[number],
          msgs: typeof modelMessages,
        ): Promise<string | null> => {
          try {
            return await runCandidate(cand, msgs);
          } catch (err) {
            if (emittedText || emittedToolCall || clientDisconnected || !isTransient(err)) throw err;
            console.warn(`[Primy Chat] transient error on ${cand.label} — one retry:`, err instanceof Error ? err.message : err);
            await new Promise((r) => setTimeout(r, 700));
            return await runCandidate(cand, msgs);
          }
        };

        try {
          // Primary attempt with provider fallback (only retries before any text).
          let chosen: (typeof candidates)[number] | null = null;
          for (let i = 0; i < candidates.length; i++) {
            try {
              finishReason = await runCandidateResilient(candidates[i], modelMessages);
              chosen = candidates[i];
              lastError = null;
              break; // streamed to completion
            } catch (err) {
              lastError = err;
              console.error(`[Primy Chat] candidate ${candidates[i].label} failed:`, err instanceof Error ? err.message : err);
              // Can only retry a fresh candidate if nothing (text OR a tool call)
              // was sent yet — otherwise a fallback would duplicate output.
              if (emittedText || emittedToolCall || clientDisconnected) break;
            }
          }

          // Auto-continuation: if the model stopped because it hit the output
          // token cap mid-response (finishReason "length"), transparently ask it
          // to resume from exactly where it stopped and keep streaming into the
          // SAME response. This is the fix for "starts, then vanishes" — large
          // sheets/decks/docs that exceed maxOutputTokens now complete instead of
          // truncating into an unparseable half-block. Capped to avoid runaway.
          const MAX_CONTINUATIONS = 2;
          let continuations = 0;
          while (
            finishReason === "length" &&
            chosen &&
            !clientDisconnected &&
            continuations < MAX_CONTINUATIONS
          ) {
            continuations++;
            const continuationMessages = [
              ...modelMessages,
              { role: "assistant" as const, content: accumulatedText },
              {
                role: "user" as const,
                content:
                  "Continue your previous response from exactly where you stopped. Do NOT repeat anything you already wrote. If you stopped mid-way through a ```operation block (tableops/sheetops/kuops/docops/deckops/pageops), resume it and emit the closing ``` so the block is valid and parseable.",
              },
            ];
            try {
              finishReason = await runCandidate(chosen, continuationMessages);
            } catch (err) {
              lastError = err;
              console.error(`[Primy Chat] continuation ${continuations} failed:`, err instanceof Error ? err.message : err);
              break;
            }
          }

          clearInterval(timeoutCheck);

          if (lastError && !emittedText && !emittedToolCall && !clientDisconnected) {
            const errMsg = lastError instanceof Error ? lastError.message : "";
            const isRateLimit = /quota|rate.?limit|429/i.test(errMsg);
            let clientError = isRateLimit
              ? "Rate limit reached. Please wait a moment and try again."
              : "The AI is temporarily unavailable. Please try again in a moment.";
            // In dev, surface the REAL provider error so failures are diagnosable
            // immediately instead of hidden behind the generic message. Never in
            // production (could leak internal detail).
            if (process.env.NODE_ENV !== "production" && errMsg) {
              clientError += ` [dev: ${errMsg.slice(0, 300)}]`;
            }
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: clientError })}\n\n`));
          } else if (!clientDisconnected && groundingSources.length > 0) {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ grounding: { sources: groundingSources, queries: [] } })}\n\n`));
          }

          // Terminal meta frame so the client knows how the stream ended.
          // `truncated` is true only if STILL cut off after auto-continuations —
          // the client surfaces a gentle, non-destructive notice (never silent).
          if (!clientDisconnected) {
            const truncated = finishReason === "length";
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ meta: { finishReason, truncated } })}\n\n`));
          }

          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
        } catch (error) {
          clearInterval(timeoutCheck);
          console.error("[Primy Chat] Stream error:", error instanceof Error ? error.message : error);
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
    console.error("[Primy Chat] Unhandled error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST = withPlanLimit(handler, { resource: "aiMessages" });
