/**
 * Smart context relevance scoring for Q&A over project files.
 *
 * Extracts keywords from the user's message, scores each KU/Table
 * by title + content match, and returns top matches with full content
 * to inject into the Gemini prompt.
 */

import type { KnowledgeUnit, ProjectTable } from "@/lib/types";

// ── Types ──

export interface ScoredKU {
  id: string;
  title: string;
  content: string;
  score: number;
}

export interface ScoredTable {
  id: string;
  title: string;
  csvContent: string;
  score: number;
}

export interface RelevanceResult {
  relevantKUs: ScoredKU[];
  relevantTables: ScoredTable[];
  contextBudgetUsed: number;
}

interface RelevanceOptions {
  maxKUs?: number;
  maxTables?: number;
  charBudget?: number;
  minScore?: number;
}

// ── Stop words (common words that don't carry meaning for matching) ──

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "shall", "may", "might", "must", "this", "that", "these",
  "those", "with", "from", "into", "for", "and", "but", "not", "nor",
  "or", "so", "yet", "both", "either", "neither", "each", "every",
  "what", "how", "who", "when", "where", "why", "which",
  "can", "tell", "me", "about", "show", "give", "list", "get",
  "make", "create", "write", "add", "update", "edit", "change",
  "help", "please", "want", "need", "like", "know", "think",
  "some", "any", "all", "more", "most", "other", "new", "old",
  "its", "it", "they", "them", "their", "our", "your", "my",
  "also", "just", "very", "really", "much", "many", "few",
  "here", "there", "then", "now", "still", "already", "too",
]);

// ── Keyword Extraction ──

export function extractKeywords(message: string): string[] {
  const tokens = message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  return [...new Set(tokens)];
}

// ── Scoring ──

export function scoreKU(
  ku: KnowledgeUnit,
  keywords: string[],
  currentEntityId: string | null
): number {
  if (keywords.length === 0) return 0;

  let score = 0;
  const titleLower = ku.title.toLowerCase();
  const contentLower = ku.content.toLowerCase();

  for (const kw of keywords) {
    // Title exact match (whole word)
    if (titleLower === kw || titleLower.split(/\s+/).includes(kw)) {
      score += 10;
    }
    // Title partial match (contains keyword)
    else if (titleLower.includes(kw)) {
      score += 5;
    }

    // Content keyword frequency (capped at 4 per keyword)
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = contentLower.match(regex);
    if (matches) {
      score += Math.min(matches.length * 0.5, 4);
    }
  }

  // Currently open entity bonus
  if (ku.id === currentEntityId) {
    score += 3;
  }

  // Recency bonus (updated in last 7 days)
  if (ku.updatedAt > Date.now() - 7 * 24 * 60 * 60 * 1000) {
    score += 1;
  }

  return score;
}

export function scoreTable(
  table: ProjectTable,
  keywords: string[],
  currentEntityId: string | null
): number {
  if (keywords.length === 0) return 0;

  let score = 0;
  const titleLower = table.title.toLowerCase();

  // Build searchable text from headers + first 10 rows
  const searchText = buildTableSearchText(table).toLowerCase();

  for (const kw of keywords) {
    // Title exact match
    if (titleLower === kw || titleLower.split(/\s+/).includes(kw)) {
      score += 10;
    }
    // Title partial match
    else if (titleLower.includes(kw)) {
      score += 5;
    }

    // Content keyword frequency
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = searchText.match(regex);
    if (matches) {
      score += Math.min(matches.length * 0.5, 4);
    }
  }

  // Currently open entity bonus
  if (table.id === currentEntityId) {
    score += 3;
  }

  // Recency bonus
  if (table.updatedAt > Date.now() - 7 * 24 * 60 * 60 * 1000) {
    score += 1;
  }

  return score;
}

// ── Table Helpers ──

function buildTableSearchText(table: ProjectTable): string {
  const sheet = table.sheets[0];
  if (!sheet?.celldata?.length) return "";

  // Only use first 10 rows for scoring (perf)
  return sheet.celldata
    .filter((c) => c.r <= 10)
    .map((c) => String(c.v?.v ?? ""))
    .filter(Boolean)
    .join(" ");
}

export function tableToCsv(table: ProjectTable, maxRows = 200): string {
  const sheet = table.sheets[0];
  if (!sheet?.celldata?.length) return "";

  const celldata = sheet.celldata;
  let rawMaxRow = 0;
  let maxCol = 0;
  for (const c of celldata) {
    if (c.r > rawMaxRow) rawMaxRow = c.r;
    if (c.c > maxCol) maxCol = c.c;
  }
  const maxRow = Math.min(rawMaxRow, maxRows);

  const rows: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = celldata.find((cd) => cd.r === r && cd.c === c);
      const val = cell?.v?.v ?? "";
      const str = String(val);
      cells.push(str.includes(",") ? `"${str}"` : str);
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

// ── Main Scoring Function ──

export function scoreRelevance(
  userMessage: string,
  knowledgeUnits: KnowledgeUnit[],
  tables: ProjectTable[],
  currentEntityId: string | null,
  options?: RelevanceOptions
): RelevanceResult {
  const {
    maxKUs = 4,
    maxTables = 3,
    charBudget = 50000,
    minScore = 1.0,
  } = options ?? {};

  const keywords = extractKeywords(userMessage);

  // If no meaningful keywords extracted, return empty (existing summaries suffice)
  if (keywords.length === 0) {
    return { relevantKUs: [], relevantTables: [], contextBudgetUsed: 0 };
  }

  // Score all KUs
  const scoredKUs: ScoredKU[] = knowledgeUnits
    .map((ku) => ({
      id: ku.id,
      title: ku.title,
      content: ku.content,
      score: scoreKU(ku, keywords, currentEntityId),
    }))
    .filter((k) => k.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKUs);

  // Score all tables
  const scoredTables: ScoredTable[] = tables
    .map((t) => ({
      id: t.id,
      title: t.title,
      csvContent: tableToCsv(t),
      score: scoreTable(t, keywords, currentEntityId),
    }))
    .filter((t) => t.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTables);

  // Apply budget
  let budgetUsed = 0;
  const budgetedKUs: ScoredKU[] = [];
  const budgetedTables: ScoredTable[] = [];

  for (const ku of scoredKUs) {
    const cost = ku.content.length;
    if (budgetUsed + cost <= charBudget) {
      budgetedKUs.push(ku);
      budgetUsed += cost;
    }
  }

  for (const t of scoredTables) {
    const cost = t.csvContent.length;
    if (budgetUsed + cost <= charBudget) {
      budgetedTables.push(t);
      budgetUsed += cost;
    }
  }

  return {
    relevantKUs: budgetedKUs,
    relevantTables: budgetedTables,
    contextBudgetUsed: budgetUsed,
  };
}
