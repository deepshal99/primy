import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * Task-keyed model registry.
 *
 * Phase 1 cleanup: Primy uses OpenAI for all chat-related tasks and Google
 * (Gemini 3.1 Pro) for deck generation/editing where it performs better.
 * Provider is selected per-task, not via a global env var.
 */

export type AITask =
  | "chat"          // small context (<30KB) — fast default
  | "chat-heavy"    // large context (>30KB) — fast default
  | "chat-deep"     // complex reasoning (strategy/analysis) — deeper, slower
  | "deck-generate" // deck generation
  | "deck-edit"     // deck editing
  | "title"         // auto-generate project title
  | "web-search"    // web search calls
  | "summarize"     // summarization
  | "embedding";    // embeddings

/** OpenAI Responses-API reasoning effort. Only valid on gpt-5.x models. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
/** OpenAI text verbosity. Only valid on gpt-5.x models. */
export type Verbosity = "low" | "medium" | "high";

export interface ModelConfig {
  provider: "openai" | "google";
  model: string;
  maxOutputTokens: number;
  /** gpt-5.x only — internal reasoning budget. Omitted ⇒ provider default. */
  reasoningEffort?: ReasoningEffort;
  /** gpt-5.x only — steers response length. Omitted ⇒ provider default. */
  verbosity?: Verbosity;
}

// Context size threshold for routing chat to a heavier model (30KB)
const HEAVY_CONTEXT_THRESHOLD = 30 * 1024;

// OpenAI is the sole configured provider.
//
// SPEED-FIRST routing (measured): GPT-5.5 is ~2× slower than gpt-4.1 and tends
// to over-produce (e.g. a "comprehensive" doc → 98s / 22K chars vs gpt-4.1's
// 22s). For an interactive workspace, latency dominates felt quality — so
// everyday chat runs on the FAST gpt-4.1, and only genuinely complex reasoning
// requests (strategy/analysis/planning — see complexRequest in chat/route.ts)
// escalate to "chat-deep" on GPT-5.5. The chat route keeps gpt-4.1 as a
// candidate fallback either way. Note: gpt-4.1 doesn't support the
// reasoningEffort/textVerbosity params (Responses API rejects them), so its
// configs carry neither — conciseness is enforced via the system prompt.
const MODEL_REGISTRY: Record<AITask, ModelConfig> = {
  "chat":          { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 16384  },
  "chat-heavy":    { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 32768  },
  "chat-deep":     { provider: "openai", model: "gpt-5.5",               maxOutputTokens: 32768, reasoningEffort: "medium", verbosity: "low" },
  "deck-generate": { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 32768  },
  "deck-edit":     { provider: "openai", model: "gpt-4.1",               maxOutputTokens: 32768  },
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

/** True when the API key for a provider is present in the environment. */
function hasProviderKey(provider: "openai" | "google"): boolean {
  return provider === "google"
    ? !!process.env.GEMINI_API_KEY
    : !!process.env.OPENAI_API_KEY;
}

export interface ModelCandidate {
  provider: "openai" | "google";
  modelId: string;
  model: ReturnType<typeof getModel>;
  maxOutputTokens: number;
  isGoogle: boolean;
  label: string;
  /** Present only for gpt-5.x primaries — never on the gpt-4.1 fallback. */
  reasoningEffort?: ReasoningEffort;
  verbosity?: Verbosity;
}

/**
 * Resolve a task to an ORDERED list of model candidates the chat route tries
 * in sequence. If one errors before emitting any text (transient error, quota,
 * outage), it transparently falls back to the next so the user ALWAYS gets a
 * response. OpenAI-only by default — Gemini is excluded entirely unless
 * ENABLE_GEMINI=true AND a key is present.
 */
export function getModelCandidates(task: AITask, contextSizeBytes?: number): ModelCandidate[] {
  const primary = getModelConfig(task, contextSizeBytes);
  const geminiEnabled = process.env.ENABLE_GEMINI === "true";

  const ordered: ModelConfig[] = [primary];

  // Same-provider resilience fallback: gpt-4.1 is the strongest OpenAI model
  // and least likely to truncate. Add it as a second attempt when the primary
  // is a different/weaker model.
  if (primary.provider === "openai" && primary.model !== "gpt-4.1") {
    ordered.push({ provider: "openai", model: "gpt-4.1", maxOutputTokens: Math.max(primary.maxOutputTokens, 16384) });
  }

  // Cross-provider fallback to Gemini only if explicitly enabled.
  if (geminiEnabled) {
    ordered.push(
      primary.provider === "google"
        ? { provider: "openai", model: "gpt-4.1", maxOutputTokens: Math.min(primary.maxOutputTokens, 32768) }
        : { provider: "google", model: "gemini-3.1-pro-preview", maxOutputTokens: primary.maxOutputTokens }
    );
  }

  const seen = new Set<string>();
  const candidates: ModelCandidate[] = [];
  for (const cfg of ordered) {
    const key = `${cfg.provider}:${cfg.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Skip Google unless enabled; skip any provider whose key is missing.
    if (cfg.provider === "google" && !geminiEnabled) continue;
    if (!hasProviderKey(cfg.provider)) continue;
    const client = cfg.provider === "google" ? googleClient() : openaiClient();
    candidates.push({
      provider: cfg.provider,
      modelId: cfg.model,
      model: client(cfg.model),
      maxOutputTokens: cfg.maxOutputTokens,
      isGoogle: cfg.provider === "google",
      label: key,
      reasoningEffort: cfg.reasoningEffort,
      verbosity: cfg.verbosity,
    });
  }

  return candidates;
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
