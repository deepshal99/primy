import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { auth } from "@/lib/auth";
import "@/lib/env";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/** Strip context-injection tags from user input to prevent prompt injection. */
function sanitizeUserContent(text: string): string {
  return text
    .replace(/<\/?relevant_document[^>]*>/g, "")
    .replace(/<\/?relevant_table[^>]*>/g, "")
    .replace(/<\/?project_context[^>]*>/g, "")
    .replace(/<\/?current_sheet_data[^>]*>/g, "")
    .replace(/<\/?current_doc_content[^>]*>/g, "")
    .replace(/<\/?project_memory[^>]*>/g, "")
    .replace(/<\/?uploaded_file[^>]*>/g, "");
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

    const { messages, sheetData, docContent, projectMemory, projectContext } = await req.json();

    const modelId = "gemini-3-flash-preview";

    // Build full contents array for Gemini (history + current message)
    const contents: any[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
      const m = messages[i];
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }

    // Build the last user message with context + multimodal parts
    const lastMessage = messages[messages.length - 1];
    const parts: any[] = [];

    // Build text content with context — convert sheet data to CSV for token efficiency
    let sheetContext = "";
    const sheetsWithData = (sheetData || []).filter((s: any) => s.celldata?.length > 0);
    if (sheetsWithData.length > 0) {
      sheetContext = sheetsWithData
        .map((s: any) => {
          // Build a simple CSV from celldata — use reduce instead of Math.max(...) to avoid stack overflow
          let maxRow = 0;
          let maxCol = 0;
          for (const c of s.celldata) {
            if (c.r > maxRow) maxRow = c.r;
            if (c.c > maxCol) maxCol = c.c;
          }
          const rows: string[] = [];
          for (let r = 0; r <= Math.min(maxRow, 100); r++) {
            const cells: string[] = [];
            for (let c = 0; c <= maxCol; c++) {
              const cell = s.celldata.find((cd: any) => cd.r === r && cd.c === c);
              const val = cell?.v?.v ?? "";
              cells.push(String(val).includes(",") ? `"${val}"` : String(val));
            }
            rows.push(cells.join(","));
          }
          return `Sheet: ${s.name}\n${rows.join("\n")}`;
        })
        .join("\n\n");
    }

    const docContext = docContent ? docContent.slice(0, 4000) : "";

    let textContent = sanitizeUserContent(lastMessage.content);

    // Append extracted file text as context
    if (lastMessage.attachmentTexts?.length) {
      for (const att of lastMessage.attachmentTexts) {
        textContent += `\n\n<uploaded_file name="${att.name}">\n${att.text}\n</uploaded_file>`;
      }
    }

    textContent += `\n\n<current_sheet_data>\n${sheetContext}\n</current_sheet_data>`;
    textContent += `\n\n<current_doc_content>\n${docContext}\n</current_doc_content>`;

    // Inject project context if available
    if (projectContext) {
      // 1. Inject full content for relevant KUs (scored by keyword match)
      if (projectContext.relevantKUs?.length > 0) {
        for (const ku of projectContext.relevantKUs) {
          textContent += `\n\n<relevant_document title="${ku.title}" id="${ku.id}">\n${ku.content}\n</relevant_document>`;
        }
      }

      // 2. Inject full CSV for relevant Tables
      if (projectContext.relevantTables?.length > 0) {
        for (const t of projectContext.relevantTables) {
          textContent += `\n\n<relevant_table title="${t.title}" id="${t.id}">\n${t.csvContent}\n</relevant_table>`;
        }
      }

      // 3. Project-level overview (all KUs + tables as summaries)
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

    // Include project memory if set
    if (projectMemory && Object.keys(projectMemory).length > 0) {
      let memoryContext = "\n\n<project_memory>";
      if (projectMemory.tone) memoryContext += `\nTone: ${projectMemory.tone}`;
      if (projectMemory.audience) memoryContext += `\nAudience: ${projectMemory.audience}`;
      if (projectMemory.goals) memoryContext += `\nGoals: ${projectMemory.goals}`;
      if (projectMemory.customInstructions) memoryContext += `\nCustom Instructions: ${projectMemory.customInstructions}`;
      memoryContext += "\n</project_memory>";
      textContent += memoryContext;
    }

    parts.push({ text: textContent });

    // Add image parts for Gemini vision
    if (lastMessage.imageAttachments?.length) {
      for (const img of lastMessage.imageAttachments) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        });
      }
    }

    contents.push({ role: "user", parts });

    const response = await ai.models.generateContentStream({
      model: modelId,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 8192,
      },
      contents,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Timeout: abort if no chunks arrive within 30s
        let lastChunkTime = Date.now();
        const timeoutCheck = setInterval(() => {
          if (Date.now() - lastChunkTime > 30000) {
            clearInterval(timeoutCheck);
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: "Response timed out. Please try again." })}\n\n`)
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch {
              // Controller may already be closed
            }
          }
        }, 5000);

        try {
          for await (const chunk of response) {
            lastChunkTime = Date.now();
            const text = chunk.text;
            if (text) {
              const data = JSON.stringify({ text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          clearInterval(timeoutCheck);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          clearInterval(timeoutCheck);
          const errMsg =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errMsg })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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
    const errMsg =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
