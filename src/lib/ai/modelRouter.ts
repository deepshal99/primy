import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Task-keyed model registry.
 *
 * Phase 1 cleanup: Drafta uses OpenAI for all chat-related tasks and Google
 * (Gemini 3.1 Pro) for deck generation/editing where it performs better.
 * Provider is selected per-task, not via a global env var.
 */

export type AITask =
  | "chat"          // small context (<30KB)
  | "chat-heavy"    // large context (>30KB)
  | "deck-generate" // deck generation
  | "deck-edit"     // deck editing
  | "title"         // auto-generate project title
  | "web-search"    // web search calls
  | "summarize"     // summarization
  | "embedding";    // embeddings

export interface ModelConfig {
  provider: "openai" | "google";
  model: string;
  maxOutputTokens: number;
}

// Context size threshold for routing chat to a heavier model (30KB)
const HEAVY_CONTEXT_THRESHOLD = 30 * 1024;

const MODEL_REGISTRY: Record<AITask, ModelConfig> = {
  "chat":          { provider: "openai", model: "gpt-4.1-mini",          maxOutputTokens: 8192   },
  "chat-heavy":    { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 16384  },
  "deck-generate": { provider: "google", model: "gemini-3.1-pro-preview", maxOutputTokens: 65536 },
  "deck-edit":     { provider: "google", model: "gemini-3.1-pro-preview", maxOutputTokens: 32768 },
  "title":         { provider: "openai", model: "gpt-4.1-mini",          maxOutputTokens: 256    },
  "web-search":    { provider: "openai", model: "gpt-4.1-mini",          maxOutputTokens: 8192   },
  "summarize":     { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 4096   },
  "embedding":     { provider: "openai", model: "text-embedding-3-small", maxOutputTokens: 0     },
};

/**
 * Resolve a task to its concrete ModelConfig.
 *
 * For "chat", an optional `contextSizeBytes` upgrades to "chat-heavy" when
 * the injected context exceeds the heavy-context threshold.
 */
export function getModelConfig(task: AITask, contextSizeBytes?: number): ModelConfig {
  if (task === "chat" && contextSizeBytes && contextSizeBytes > HEAVY_CONTEXT_THRESHOLD) {
    return MODEL_REGISTRY["chat-heavy"];
  }
  return MODEL_REGISTRY[task];
}

/**
 * Backwards-compatible alias used by existing callers.
 * @deprecated Prefer {@link getModelConfig}.
 */
export const getModelForTask = getModelConfig;

// Lazy provider clients — instantiated on first use.
let _openai: ReturnType<typeof createOpenAI> | null = null;
let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function openaiClient() {
  if (!_openai) _openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return _openai;
}

function googleClient() {
  if (!_google) _google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _google;
}

/**
 * Resolve a task directly to a language model instance ready for `streamText`
 * / `generateText`. Use {@link getModelConfig} when you also need maxOutputTokens.
 */
export function getModel(task: AITask, contextSizeBytes?: number) {
  const config = getModelConfig(task, contextSizeBytes);
  if (config.provider === "google") return googleClient()(config.model);
  return openaiClient()(config.model);
}

/** Embedding-model variant — needed for `embed` / `embedMany` calls. */
export function getEmbeddingModel(task: AITask = "embedding") {
  const config = getModelConfig(task);
  if (config.provider === "google") return googleClient().textEmbeddingModel(config.model);
  return openaiClient().textEmbeddingModel(config.model);
}

/**
 * Estimate the byte size of injected chat context, used to decide whether to
 * route a chat request to "chat-heavy".
 */
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
