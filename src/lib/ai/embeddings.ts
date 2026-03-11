import { embed, embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getModelForTask, getProvider } from "./modelRouter";

const MAX_TEXT_LENGTH = 2048;

function getEmbeddingModel() {
  const { model: modelId } = getModelForTask("embedding");
  if (getProvider() === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    return openai.textEmbeddingModel(modelId);
  }
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
  return google.textEmbeddingModel(modelId);
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

/** Generate embedding for a single text */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: truncate(text),
  });
  return embedding;
}

/** Generate embeddings for multiple texts (batch) */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts.map(truncate),
  });
  return embeddings;
}

/** Compute cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must have same length");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Find top K matches by cosine similarity */
export function findTopMatches<T>(
  queryEmbedding: number[],
  items: { embedding: number[]; data: T }[],
  topK: number = 5
): { data: T; score: number }[] {
  return items
    .map((item) => ({
      data: item.data,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
