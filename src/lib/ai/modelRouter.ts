export type AITask = "chat" | "chat-heavy" | "deck-generate" | "deck-edit" | "title" | "web-search" | "embedding" | "summarize";

export interface ModelConfig {
  model: string;
  maxOutputTokens: number;
}

const provider = process.env.AI_PROVIDER || "google";

// Context size threshold for routing to Pro model (30KB)
const HEAVY_CONTEXT_THRESHOLD = 30 * 1024;

function getGoogleModel(task: AITask, contextSizeBytes?: number): ModelConfig {
  switch (task) {
    case "chat":
      if (contextSizeBytes && contextSizeBytes > HEAVY_CONTEXT_THRESHOLD) {
        return { model: "gemini-2.5-pro", maxOutputTokens: 16384 };
      }
      return { model: "gemini-2.5-flash", maxOutputTokens: 8192 };
    case "chat-heavy":
      return { model: "gemini-2.5-pro", maxOutputTokens: 16384 };
    case "deck-generate":
      return { model: "gemini-2.5-pro", maxOutputTokens: 65536 };
    case "deck-edit":
      return { model: "gemini-2.5-pro", maxOutputTokens: 32768 };
    case "title":
      return { model: "gemini-2.5-flash", maxOutputTokens: 256 };
    case "web-search":
      return { model: "gemini-2.5-flash", maxOutputTokens: 8192 };
    case "embedding":
      return { model: "text-embedding-004", maxOutputTokens: 0 };
    case "summarize":
      return { model: "gemini-2.5-pro", maxOutputTokens: 4096 };
  }
}

function getOpenAIModel(task: AITask, contextSizeBytes?: number): ModelConfig {
  switch (task) {
    case "chat":
      if (contextSizeBytes && contextSizeBytes > HEAVY_CONTEXT_THRESHOLD) {
        return { model: "gpt-4.1", maxOutputTokens: 16384 };
      }
      return { model: "gpt-4.1-mini", maxOutputTokens: 8192 };
    case "chat-heavy":
      return { model: "gpt-4.1", maxOutputTokens: 16384 };
    case "deck-generate":
      return { model: "gpt-4.1", maxOutputTokens: 65536 };
    case "deck-edit":
      return { model: "gpt-4.1", maxOutputTokens: 32768 };
    case "title":
      return { model: "gpt-4.1-mini", maxOutputTokens: 256 };
    case "web-search":
      return { model: "gpt-4.1-mini", maxOutputTokens: 8192 };
    case "embedding":
      return { model: "text-embedding-3-small", maxOutputTokens: 0 };
    case "summarize":
      return { model: "gpt-4.1", maxOutputTokens: 4096 };
  }
}

export function getModelForTask(task: AITask, contextSizeBytes?: number): ModelConfig {
  if (provider === "openai") {
    return getOpenAIModel(task, contextSizeBytes);
  }
  return getGoogleModel(task, contextSizeBytes);
}

export function getProvider(): string {
  return provider;
}

// Helper to estimate context size in bytes from request body
export function estimateContextSize(body: {
  sheetData?: any[];
  docContent?: string;
  projectContext?: any;
  messages?: any[];
}): number {
  let size = 0;
  if (body.docContent) size += body.docContent.length;
  if (body.sheetData) size += JSON.stringify(body.sheetData).length;
  if (body.projectContext) size += JSON.stringify(body.projectContext).length;
  // Rough estimate for message history
  if (body.messages) {
    for (const m of body.messages) {
      size += (m.content?.length || 0);
      if (m.attachmentTexts) {
        for (const a of m.attachmentTexts) size += (a.text?.length || 0);
      }
    }
  }
  return size;
}
