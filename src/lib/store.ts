import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  AppState,
  SheetOperation,
  DocOperation,
  KuOperation,
  TableOperation,
  DeckOperation,
  DeckSlide,
  DeckTheme,
  DeckPhase,
  HtmlDeckSlide,
  isHtmlSlide,
  FileAttachment,
  Conversation,
  UndoSnapshot,
  Project,
  Folder,
  KnowledgeUnit,
  ProjectTable,
  ProjectDeck,
  ProjectPage,
  PageOperation,
  PageEditableField,
  EntityType,
  ThemeConfig,
} from "@/lib/types";
import { applyPageOps } from "@/lib/ai/pageOperations";
import { promoteOrphanOps } from "@/lib/ai/opPromotion";
import { createEmptySheet } from "@/lib/sheet/defaultData";
import { applyOperations, normalizeCells } from "@/lib/ai/sheetOperations";
import { applyDocOps } from "@/lib/ai/docOperations";
import { scheduleSnapshot } from "@/lib/snapshots/scheduler";
import { extractDisplayText, validateThemeConfig } from "@/lib/ai/parseAIResponse";
import {
  fetchProjects,
  fetchFullProject,
  fetchOlderMessages,
  createProjectOnServer,
  updateProjectOnServer,
  deleteProjectOnServer,
} from "@/lib/api";

// ── Debounced save manager ──

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 2000;

function scheduleDebouncedSave() {
  // Capture the project + entity IDs at schedule time, not when the timer fires.
  // This prevents saving the wrong entity when the user switches tabs during the debounce window.
  const snapshot = useAppStore.getState();
  const projectId = snapshot.currentProjectId;
  const entityId = snapshot.currentEntityId;

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    const state = useAppStore.getState();
    // Only save if we're still on the same project (entity may have changed, but the project-level save captures all entities)
    if (state.currentProjectId && state.currentProjectId === projectId) {
      state.saveCurrentEntity();
    } else if (projectId) {
      // The user switched projects — still try to save the original project's data
      // by finding it in the store and syncing it
      state.saveCurrentEntity();
    }
  }, SAVE_DEBOUNCE_MS);
}

// Flush any pending save on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      const state = useAppStore.getState();
      if (state.currentProjectId) {
        state.saveCurrentEntity();
      }
    }
  });
}

// ── LocalStorage helpers ──

const PROJECTS_KEY = "drafta_projects";

// TODO: Remove in next release — only needed for migrateConversations()
const LEGACY_CONVERSATIONS_KEY = "drafta_conversations";
function loadConversationsFromStorage(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadProjectsFromStorage(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjectsToStorage(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    // Strip embedding vectors before serializing to save localStorage space
    // (~6KB per entity). Embeddings are regenerated lazily on demand.
    const stripped = projects.map((p) => ({
      ...p,
      knowledgeUnits: p.knowledgeUnits.map(({ embedding, ...rest }) => rest),
      tables: p.tables.map(({ embedding, ...rest }) => rest),
      decks: (p.decks || []).map(({ embedding, ...rest }) => rest),
    }));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(stripped));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      toast.error("Storage full — some changes may not be saved");
    }
  }
}

// ── Background embedding generation ──

function generateEntityEmbedding(entityId: string, projectId: string, text: string) {
  if (typeof window === "undefined" || !text.trim()) return;
  fetch("/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text.slice(0, 2048)] }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const embedding = data?.embeddings?.[0];
      if (!embedding) return;
      const state = useAppStore.getState();
      const updated = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          knowledgeUnits: p.knowledgeUnits.map((k) =>
            k.id === entityId ? { ...k, embedding } : k
          ),
          tables: p.tables.map((t) =>
            t.id === entityId ? { ...t, embedding } : t
          ),
          decks: (p.decks || []).map((d) =>
            d.id === entityId ? { ...d, embedding } : d
          ),
        };
      });
      useAppStore.setState({ projects: updated });
      saveProjectsToStorage(updated);
    })
    .catch(() => {});
}

// ── Helper: find entity across all projects ──

function findKnowledgeUnit(projects: Project[], kuId: string): { project: Project; ku: KnowledgeUnit } | null {
  for (const project of projects) {
    const ku = project.knowledgeUnits.find((k) => k.id === kuId);
    if (ku) return { project, ku };
  }
  return null;
}

function findTable(projects: Project[], tableId: string): { project: Project; table: ProjectTable } | null {
  for (const project of projects) {
    const table = project.tables.find((t) => t.id === tableId);
    if (table) return { project, table };
  }
  return null;
}

function findDeck(projects: Project[], deckId: string): { project: Project; deck: ProjectDeck } | null {
  for (const project of projects) {
    const deck = (project.decks || []).find((d) => d.id === deckId);
    if (deck) return { project, deck };
  }
  return null;
}

function findPage(projects: Project[], pageId: string): { project: Project; page: ProjectPage } | null {
  for (const project of projects) {
    const page = (project.pages || []).find((p) => p.id === pageId);
    if (page) return { project, page };
  }
  return null;
}

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
  // Active view (flat fields synced to current entity)
  messages: [],
  isStreaming: false,
  streamingContent: "",
  sheets: createEmptySheet(),
  sheetVersion: 0,
  docContent: "",
  docVersion: 0,
  deckSlides: [] as (DeckSlide | HtmlDeckSlide)[],
  deckTheme: "light" as const,
  deckVersion: 0,
  deckPhase: "idle" as DeckPhase,
  deckStyle: null as ThemeConfig | null,
  pageHtml: "",
  pageEditableFields: [] as PageEditableField[],
  pageVersion: 0,
  activeTab: "sheet",
  workspaceOpen: false,
  pendingAttachments: [],
  pendingSheetImages: [],
  suggestions: [],
  projectMemory: {},
  readingFiles: [],
  aiPhase: 'idle' as const,
  undoStack: [],
  canUndo: false,
  redoStack: [],
  canRedo: false,
  isSaving: false,
  lastSavedAt: 0,
  saveError: null,

  // AI-modified entity highlights
  aiModifiedEntityIds: [],

  // Legacy conversations (TODO: Remove in next release)
  conversations: [],
  currentConversationId: null,

  // Project system
  projects: loadProjectsFromStorage(),
  currentProjectId: null,
  currentEntityId: null,
  currentEntityType: null,
  projectsFullyLoaded: {},
  isLoadingProject: false,
  openTabs: [],

  // ── Chat Actions ──

  addUserMessage: (content: string, attachments?: FileAttachment[], mentionedEntities?: { id: string; type: EntityType; title: string }[]) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nanoid(),
          role: "user",
          content,
          timestamp: Date.now(),
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          mentionedEntities: mentionedEntities && mentionedEntities.length > 0 ? mentionedEntities : undefined,
        },
      ],
    })),

  startStreaming: () =>
    set({ isStreaming: true, streamingContent: "", aiPhase: 'thinking' }),

  abortStreaming: () =>
    set({ isStreaming: false, streamingContent: "", readingFiles: [], aiPhase: 'idle' }),

  appendStreamChunk: (chunk: string) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
      aiPhase: state.aiPhase === 'thinking' ? 'streaming' as const : state.aiPhase,
    })),

  finishStreaming: (
    fullContent: string,
    sheetOperationsArg?: SheetOperation[],
    docOperationsArg?: DocOperation[],
    kuOperationsArg?: KuOperation[],
    tableOperationsArg?: TableOperation[],
    deckOperations?: DeckOperation[],
    pageOperations?: PageOperation[],
    suggestions?: string[]
  ) => {
    const state = get();
    const displayContent = extractDisplayText(fullContent) || fullContent;
    const newMessage = {
      id: nanoid(),
      role: "assistant" as const,
      content: displayContent,
      timestamp: Date.now(),
    };

    // Guarantee creation actually happens: if the model used edit-ops to
    // "create" with no matching entity open, promote them to CREATE ops so a
    // real, visible entity is made (root-cause fix for "the AI did nothing").
    const _hasOpenTable = state.currentEntityType === "table" && !!state.currentEntityId;
    const _hasOpenDoc = state.currentEntityType === "ku" && !!state.currentEntityId;
    const _promoted = promoteOrphanOps(
      { sheetOps: sheetOperationsArg, docOps: docOperationsArg, kuOps: kuOperationsArg, tableOps: tableOperationsArg },
      { hasOpenTable: _hasOpenTable, hasOpenDoc: _hasOpenDoc }
    );
    const sheetOperations = _promoted.sheetOps;
    const docOperations = _promoted.docOps;
    const kuOperations = _promoted.kuOps;
    const tableOperations = _promoted.tableOps;

    const hasSheetOps = sheetOperations && sheetOperations.length > 0;
    const hasDocOps = docOperations && docOperations.length > 0;
    const hasKuOps = kuOperations && kuOperations.length > 0;
    const hasTableOps = tableOperations && tableOperations.length > 0;
    const hasDeckOps = deckOperations && deckOperations.length > 0;
    const hasPageOps = pageOperations && pageOperations.length > 0;

    // Snapshot current state before applying AI operations (for undo)
    // New AI operations clear the redo stack (standard editor behavior)
    const hasAnyOps = hasSheetOps || hasDocOps || hasDeckOps || hasKuOps || hasTableOps || hasPageOps;
    let newUndoStack = state.undoStack;
    if (hasAnyOps) {
      const labelParts: string[] = [];
      if (hasSheetOps) labelParts.push("sheet");
      if (hasDocOps) labelParts.push("doc");
      if (hasKuOps) labelParts.push("doc");
      if (hasTableOps) labelParts.push("sheet");
      if (hasDeckOps) labelParts.push("deck");
      if (hasPageOps) labelParts.push("page");
      const entityType: UndoSnapshot["entityType"] = labelParts.length > 1 ? "mixed"
        : hasDeckOps ? "deck" : hasPageOps ? "page" : (hasSheetOps || hasTableOps) ? "table" : "ku";
      try {
        const snapshot: UndoSnapshot = {
          entityType,
          sheets: JSON.parse(JSON.stringify(state.sheets)),
          docContent: state.docContent,
          deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
          deckTheme: state.deckTheme,
          pageHtml: state.pageHtml,
          pageEditableFields: JSON.parse(JSON.stringify(state.pageEditableFields)),
          label: `AI ${[...new Set(labelParts)].join(" & ")} changes`,
          timestamp: Date.now(),
        };
        newUndoStack = [...state.undoStack, snapshot].slice(-20);
      } catch (e) {
        // JSON.stringify can fail on very large decks — skip undo snapshot but don't block the pipeline
        console.warn("[Drafta] Undo snapshot failed (data too large), skipping:", e);
      }
    }

    let newSheets = state.sheets;
    let newSheetVersion = state.sheetVersion;
    let newPendingImages = state.pendingSheetImages;
    if (hasSheetOps) {
      // Separate INSERT_IMAGE ops (need Univer API) from data ops (apply via Immer)
      const imageOps = sheetOperations.filter((op): op is Extract<SheetOperation, { type: "INSERT_IMAGE" }> => op.type === "INSERT_IMAGE");
      const dataOps = sheetOperations.filter((op) => op.type !== "INSERT_IMAGE");
      if (dataOps.length > 0) {
        newSheets = applyOperations(state.sheets, dataOps);
      }
      if (imageOps.length > 0) {
        newPendingImages = [...state.pendingSheetImages, ...imageOps.map((op) => ({
          sheetIndex: op.sheetIndex,
          url: op.url,
          row: op.row,
          column: op.column,
          width: op.width,
          height: op.height,
        }))];
      }
      newSheetVersion = state.sheetVersion + 1;
    }

    let newDocContent = state.docContent;
    let newDocVersion = state.docVersion;
    if (hasDocOps) {
      newDocContent = applyDocOps(state.docContent, docOperations);
      newDocVersion = state.docVersion + 1;
    }

    let newActiveTab = state.activeTab;
    if (hasDocOps) newActiveTab = "doc";
    if (hasSheetOps) newActiveTab = "sheet";

    const shouldOpen = hasSheetOps || hasDocOps || hasKuOps || hasTableOps || hasDeckOps || hasPageOps;

    // Deck flat fields
    let newDeckSlides = state.deckSlides;
    let newDeckTheme = state.deckTheme;
    let newDeckVersion = state.deckVersion;
    let newDeckPhase = state.deckPhase;
    let newDeckStyle = state.deckStyle;

    // Page flat fields
    let newPageHtml = state.pageHtml;
    let newPageEditableFields = state.pageEditableFields;
    let newPageVersion = state.pageVersion;

    // Apply project-level KU and Table operations
    let newProjects = state.projects;
    let newCurrentEntityId = state.currentEntityId;
    let newCurrentEntityType = state.currentEntityType;
    let newOpenTabs = state.openTabs;
    const aiModifiedIds: string[] = [];

    let entityOpsApplied = false;
    if (hasKuOps || hasTableOps || hasDeckOps || hasPageOps) {
      if (!state.currentProjectId) {
        console.error("[Drafta] Entity operations received but no currentProjectId");
        toast.error("No active project — AI changes could not be applied. Please try again.");
      }
      newProjects = [...state.projects];
      const projIdx = newProjects.findIndex((p) => p.id === state.currentProjectId);
      if (projIdx >= 0) {
        const project = { ...newProjects[projIdx] };

        // Apply KU operations
        if (hasKuOps) {
          project.knowledgeUnits = [...project.knowledgeUnits];
          for (const op of kuOperations) {
            switch (op.type) {
              case "CREATE": {
                const newKu: KnowledgeUnit = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  content: op.content,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.knowledgeUnits.push(newKu);
                // Auto-open the newly created KU
                newCurrentEntityId = newKu.id;
                newCurrentEntityType = "ku";
                newDocContent = newKu.content;
                newDocVersion = state.docVersion + 1;
                newActiveTab = "doc";
                // Add to open tabs
                if (!newOpenTabs.some((t) => t.id === newKu.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newKu.id, type: "ku" as const, title: newKu.title }];
                }
                break;
              }
              case "UPDATE": {
                const idx = project.knowledgeUnits.findIndex((k) => k.id === op.kuId);
                if (idx >= 0) {
                  project.knowledgeUnits[idx] = {
                    ...project.knowledgeUnits[idx],
                    content: op.content,
                    updatedAt: Date.now(),
                  };
                  // If this is the active entity, update flat fields
                  if (state.currentEntityId === op.kuId) {
                    newDocContent = op.content;
                    newDocVersion = state.docVersion + 1;
                  }
                  // Auto-open tab for updated KU
                  if (!newOpenTabs.some((t) => t.id === op.kuId)) {
                    const entity = project.knowledgeUnits[idx];
                    newOpenTabs = [...newOpenTabs, { id: entity.id, type: "ku" as const, title: entity.title }];
                  }
                  aiModifiedIds.push(op.kuId);
                }
                break;
              }
              case "APPEND": {
                const idx = project.knowledgeUnits.findIndex((k) => k.id === op.kuId);
                if (idx >= 0) {
                  const existing = project.knowledgeUnits[idx];
                  project.knowledgeUnits[idx] = {
                    ...existing,
                    content: existing.content + "\n\n" + op.content,
                    updatedAt: Date.now(),
                  };
                  if (state.currentEntityId === op.kuId) {
                    newDocContent = project.knowledgeUnits[idx].content;
                    newDocVersion = state.docVersion + 1;
                  }
                  // Auto-open tab for appended KU
                  if (!newOpenTabs.some((t) => t.id === op.kuId)) {
                    const entity = project.knowledgeUnits[idx];
                    newOpenTabs = [...newOpenTabs, { id: entity.id, type: "ku" as const, title: entity.title }];
                  }
                  aiModifiedIds.push(op.kuId);
                }
                break;
              }
              case "RENAME": {
                const idx = project.knowledgeUnits.findIndex((k) => k.id === op.kuId);
                if (idx >= 0) {
                  project.knowledgeUnits[idx] = {
                    ...project.knowledgeUnits[idx],
                    title: op.title,
                    updatedAt: Date.now(),
                  };
                  // Sync tab title
                  newOpenTabs = newOpenTabs.map((t) => t.id === op.kuId ? { ...t, title: op.title } : t);
                }
                break;
              }
              case "DELETE": {
                project.knowledgeUnits = project.knowledgeUnits.filter((k) => k.id !== op.kuId);
                newOpenTabs = newOpenTabs.filter((t) => t.id !== op.kuId);
                if (newCurrentEntityId === op.kuId) {
                  newCurrentEntityId = null;
                  newCurrentEntityType = null;
                  newDocContent = "";
                  newDocVersion = state.docVersion + 1;
                }
                break;
              }
            }
          }
        }

        // Apply Table operations
        if (hasTableOps) {
          project.tables = [...project.tables];
          for (const op of tableOperations) {
            switch (op.type) {
              case "CREATE": {
                const newTable: ProjectTable = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  sheets: [{
                    name: "Sheet1",
                    order: 0,
                    status: 1,
                    celldata: normalizeCells(op.celldata || []),
                    config: op.config || {},
                    row: 50,
                    column: 26,
                  }],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.tables.push(newTable);
                // Auto-open the newly created table
                newCurrentEntityId = newTable.id;
                newCurrentEntityType = "table";
                newSheets = newTable.sheets;
                newSheetVersion = state.sheetVersion + 1;
                newActiveTab = "sheet";
                // Add to open tabs
                if (!newOpenTabs.some((t) => t.id === newTable.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newTable.id, type: "table" as const, title: newTable.title }];
                }
                break;
              }
              case "UPDATE_CELLS": {
                const idx = project.tables.findIndex((t) => t.id === op.tableId);
                if (idx >= 0) {
                  const table = { ...project.tables[idx] };
                  table.sheets = [...table.sheets];
                  const si = op.sheetIndex || 0;
                  if (table.sheets[si]) {
                    const sheet = { ...table.sheets[si] };
                    // Merge cells
                    const cellMap = new Map((sheet.celldata || []).map((c) => [`${c.r},${c.c}`, c]));
                    for (const cell of normalizeCells(op.cells || [])) {
                      cellMap.set(`${cell.r},${cell.c}`, cell);
                    }
                    sheet.celldata = Array.from(cellMap.values());
                    table.sheets[si] = sheet;
                  }
                  table.updatedAt = Date.now();
                  project.tables[idx] = table;
                  if (state.currentEntityId === op.tableId) {
                    newSheets = table.sheets;
                    newSheetVersion = state.sheetVersion + 1;
                  }
                  // Auto-open tab for updated table
                  if (!newOpenTabs.some((t) => t.id === op.tableId)) {
                    newOpenTabs = [...newOpenTabs, { id: table.id, type: "table" as const, title: table.title }];
                  }
                  aiModifiedIds.push(op.tableId);
                }
                break;
              }
              case "SET_TABLE_DATA": {
                const idx = project.tables.findIndex((t) => t.id === op.tableId);
                if (idx >= 0) {
                  const table = { ...project.tables[idx] };
                  table.sheets = [...table.sheets];
                  const si = op.sheetIndex || 0;
                  if (table.sheets[si]) {
                    table.sheets[si] = {
                      ...table.sheets[si],
                      ...op.data,
                    };
                  }
                  table.updatedAt = Date.now();
                  project.tables[idx] = table;
                  if (state.currentEntityId === op.tableId) {
                    newSheets = table.sheets;
                    newSheetVersion = state.sheetVersion + 1;
                  }
                  // Auto-open tab for updated table
                  if (!newOpenTabs.some((t) => t.id === op.tableId)) {
                    newOpenTabs = [...newOpenTabs, { id: table.id, type: "table" as const, title: table.title }];
                  }
                  aiModifiedIds.push(op.tableId);
                }
                break;
              }
              case "DELETE": {
                project.tables = project.tables.filter((t) => t.id !== op.tableId);
                newOpenTabs = newOpenTabs.filter((t) => t.id !== op.tableId);
                if (newCurrentEntityId === op.tableId) {
                  newCurrentEntityId = null;
                  newCurrentEntityType = null;
                  newSheets = [{
                    name: "Sheet1", order: 0, status: 1, celldata: [], row: 50, column: 26,
                  }];
                  newSheetVersion = state.sheetVersion + 1;
                }
                break;
              }
            }
          }
        }

        // Handle deck operations
        if (hasDeckOps) {
          if (!project.decks) project.decks = [];
          for (const op of deckOperations) {
            switch (op.type) {
              case "CREATE": {
                const validatedStyle = op.style ? validateThemeConfig(op.style) : null;
                const newDeck: ProjectDeck = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  theme: op.theme || "pitch",
                  style: validatedStyle,
                  slides: op.slides || [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.decks.push(newDeck);
                newCurrentEntityId = newDeck.id;
                newCurrentEntityType = "deck";
                newDeckSlides = newDeck.slides;
                newDeckTheme = newDeck.theme;
                newDeckStyle = validatedStyle;
                newDeckVersion = state.deckVersion + 1;
                // Transition to viewing phase after generation
                newDeckPhase = "viewing";
                if (!newOpenTabs.some((t) => t.id === newDeck.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newDeck.id, type: "deck" as const, title: newDeck.title }];
                }
                // Auto-fetch background images for slides with imageQuery
                const slidesWithQuery = newDeck.slides.filter((s) => !isHtmlSlide(s) && s.imageQuery && !s.backgroundImage);
                if (slidesWithQuery.length > 0) {
                  const deckId = newDeck.id;
                  Promise.allSettled(
                    slidesWithQuery.map(async (s) => {
                      try {
                        const res = await fetch(`/api/unsplash?q=${encodeURIComponent(s.imageQuery!)}`);
                        const data = await res.json();
                        const firstResult = data.results?.[0];
                        if (firstResult?.urls?.regular) {
                          const store = useAppStore.getState();
                          const updatedSlides = store.deckSlides.map((slide) =>
                            slide.id === s.id ? { ...slide, backgroundImage: firstResult.urls.regular } : slide
                          );
                          store.updateDeckSlides(updatedSlides);
                          // Also update the deck in projects
                          const projects = [...store.projects];
                          const pIdx = projects.findIndex((p) => p.id === store.currentProjectId);
                          if (pIdx >= 0) {
                            const proj = { ...projects[pIdx] };
                            const dIdx = (proj.decks || []).findIndex((d) => d.id === deckId);
                            if (dIdx >= 0) {
                              proj.decks = [...proj.decks];
                              proj.decks[dIdx] = { ...proj.decks[dIdx], slides: updatedSlides };
                              projects[pIdx] = proj;
                              useAppStore.setState({ projects });
                            }
                          }
                        }
                      } catch { /* ignore failed image fetches */ }
                    })
                  );
                }
                break;
              }
              case "UPDATE": {
                const idx = (project.decks || []).findIndex((d) => d.id === op.deckId);
                if (idx >= 0) {
                  const updatedStyle = op.style ? validateThemeConfig(op.style) : undefined;
                  project.decks[idx] = {
                    ...project.decks[idx],
                    slides: op.slides,
                    ...(op.theme ? { theme: op.theme } : {}),
                    ...(updatedStyle ? { style: updatedStyle } : {}),
                    updatedAt: Date.now(),
                  };
                  if (state.currentEntityId === op.deckId) {
                    newDeckSlides = op.slides;
                    if (op.theme) newDeckTheme = op.theme;
                    if (updatedStyle) newDeckStyle = updatedStyle;
                    newDeckVersion = state.deckVersion + 1;
                  }
                  // Auto-open tab for updated deck
                  if (!newOpenTabs.some((t) => t.id === op.deckId)) {
                    const entity = project.decks[idx];
                    newOpenTabs = [...newOpenTabs, { id: entity.id, type: "deck" as const, title: entity.title }];
                  }
                  aiModifiedIds.push(op.deckId);
                }
                break;
              }
              case "DELETE": {
                project.decks = (project.decks || []).filter((d) => d.id !== op.deckId);
                newOpenTabs = newOpenTabs.filter((t) => t.id !== op.deckId);
                if (newCurrentEntityId === op.deckId) {
                  newCurrentEntityId = null;
                  newCurrentEntityType = null;
                  newDeckSlides = [];
                  newDeckVersion = state.deckVersion + 1;
                }
                break;
              }
              case "RENAME": {
                const idx = (project.decks || []).findIndex((d) => d.id === op.deckId);
                if (idx >= 0) {
                  project.decks[idx] = {
                    ...project.decks[idx],
                    title: op.title,
                    updatedAt: Date.now(),
                  };
                  newOpenTabs = newOpenTabs.map((t) => t.id === op.deckId ? { ...t, title: op.title } : t);
                }
                break;
              }
            }
          }
        }

        // Handle HTML page operations
        if (hasPageOps) {
          if (!project.pages) project.pages = [];
          for (const op of pageOperations) {
            switch (op.type) {
              case "CREATE": {
                const newPage: ProjectPage = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  html: op.html,
                  editableFields: op.editableFields || [],
                  sourceKuId: op.sourceKuId || null,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.pages.push(newPage);
                newCurrentEntityId = newPage.id;
                newCurrentEntityType = "page";
                newPageHtml = newPage.html;
                newPageEditableFields = newPage.editableFields || [];
                newPageVersion = state.pageVersion + 1;
                if (!newOpenTabs.some((t) => t.id === newPage.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newPage.id, type: "page" as const, title: newPage.title }];
                }
                break;
              }
              case "UPDATE": {
                const idx = (project.pages || []).findIndex((pg) => pg.id === op.pageId);
                if (idx >= 0) {
                  project.pages[idx] = {
                    ...project.pages[idx],
                    html: op.html,
                    ...(op.editableFields ? { editableFields: op.editableFields } : {}),
                    updatedAt: Date.now(),
                  };
                  if (state.currentEntityId === op.pageId) {
                    newPageHtml = op.html;
                    if (op.editableFields) newPageEditableFields = op.editableFields;
                    newPageVersion = state.pageVersion + 1;
                  }
                  if (!newOpenTabs.some((t) => t.id === op.pageId)) {
                    const entity = project.pages[idx];
                    newOpenTabs = [...newOpenTabs, { id: entity.id, type: "page" as const, title: entity.title }];
                  }
                  aiModifiedIds.push(op.pageId);
                }
                break;
              }
              case "RENAME": {
                const idx = (project.pages || []).findIndex((pg) => pg.id === op.pageId);
                if (idx >= 0) {
                  project.pages[idx] = { ...project.pages[idx], title: op.title, updatedAt: Date.now() };
                  newOpenTabs = newOpenTabs.map((t) => t.id === op.pageId ? { ...t, title: op.title } : t);
                }
                break;
              }
              case "DELETE": {
                project.pages = (project.pages || []).filter((pg) => pg.id !== op.pageId);
                newOpenTabs = newOpenTabs.filter((t) => t.id !== op.pageId);
                if (newCurrentEntityId === op.pageId) {
                  newCurrentEntityId = null;
                  newCurrentEntityType = null;
                  newPageHtml = "";
                  newPageEditableFields = [];
                  newPageVersion = state.pageVersion + 1;
                }
                break;
              }
            }
          }
        }

        project.updatedAt = Date.now();
        newProjects[projIdx] = project;
        entityOpsApplied = true;
      } else if (state.currentProjectId) {
        console.error("[Drafta] Project not found in store for entity ops, projectId:", state.currentProjectId);
        toast.error("Failed to apply changes — project not found. Please try again.");
      }
    }

    set({
      messages: [...state.messages, newMessage],
      isStreaming: false,
      streamingContent: "",
      sheets: newSheets,
      sheetVersion: newSheetVersion,
      pendingSheetImages: newPendingImages,
      docContent: newDocContent,
      docVersion: newDocVersion,
      deckSlides: newDeckSlides,
      deckTheme: newDeckTheme,
      deckVersion: newDeckVersion,
      deckPhase: newDeckPhase,
      deckStyle: newDeckStyle,
      pageHtml: newPageHtml,
      pageEditableFields: newPageEditableFields,
      pageVersion: newPageVersion,
      activeTab: newActiveTab,
      workspaceOpen: state.workspaceOpen || !!shouldOpen,
      suggestions: suggestions || [],
      readingFiles: [],
      aiPhase: 'done' as const,
      undoStack: newUndoStack,
      canUndo: newUndoStack.length > 0,
      // Clear redo stack when new AI operations are applied
      redoStack: hasAnyOps ? [] : state.redoStack,
      canRedo: hasAnyOps ? false : state.canRedo,
      projects: newProjects,
      currentEntityId: newCurrentEntityId,
      currentEntityType: newCurrentEntityType,
      openTabs: newOpenTabs,
      aiModifiedEntityIds: aiModifiedIds.length > 0 ? aiModifiedIds : state.aiModifiedEntityIds,
    });

    // Auto-clear the AI-modified markers after a beat. The old TabBar cleared
    // these on a 2s timer; with the tab row gone nothing did, so the set grew
    // unbounded for the whole session. (Consumers may still read them meanwhile.)
    if (aiModifiedIds.length > 0) {
      aiModifiedIds.forEach((id) => setTimeout(() => get().clearAiModifiedEntity(id), 2200));
    }

    // Success toasts — only fire when mutations actually landed in the store
    if (hasSheetOps) toast.success("Spreadsheet updated");
    else if (hasDocOps) toast.success("Document updated");

    // Collect deleted entity IDs for server sync
    const deletedKuIds: string[] = [];
    const deletedTableIds: string[] = [];
    const deletedDeckIds: string[] = [];
    const deletedPageIds: string[] = [];

    if (hasKuOps && entityOpsApplied) {
      for (const op of kuOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
        else if (op.type === "DELETE") deletedKuIds.push(op.kuId);
        else if (op.type === "RENAME") toast.success("Document renamed");
      }
    }
    if (hasTableOps && entityOpsApplied) {
      for (const op of tableOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
        else if (op.type === "DELETE") deletedTableIds.push(op.tableId);
      }
    }
    if (hasDeckOps && entityOpsApplied) {
      for (const op of deckOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
        else if (op.type === "DELETE") deletedDeckIds.push(op.deckId);
        else if (op.type === "RENAME") toast.success("Deck renamed");
      }
    }
    if (hasPageOps && entityOpsApplied) {
      for (const op of pageOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
        else if (op.type === "DELETE") deletedPageIds.push(op.pageId);
        else if (op.type === "RENAME") toast.success("Page renamed");
      }
    }

    // Immediately sync deletions to server (debounced save won't include deletedXxxIds)
    // Uses retry with backoff since delete ops are not included in the regular save payload
    if (state.currentProjectId) {
      const deletePayload: Record<string, string[]> = {};
      if (deletedKuIds.length > 0) deletePayload.deletedKnowledgeUnitIds = deletedKuIds;
      if (deletedTableIds.length > 0) deletePayload.deletedTableIds = deletedTableIds;
      if (deletedDeckIds.length > 0) deletePayload.deletedDeckIds = deletedDeckIds;
      if (deletedPageIds.length > 0) deletePayload.deletedPageIds = deletedPageIds;
      if (Object.keys(deletePayload).length > 0) {
        const projectId = state.currentProjectId;
        updateProjectOnServer(projectId, deletePayload).catch(() => {
          // First retry failed (updateProjectOnServer already retries 2x internally)
          // Schedule one more attempt after 5 seconds
          console.warn("[Drafta] Delete sync failed, scheduling retry...");
          setTimeout(() => {
            updateProjectOnServer(projectId, deletePayload).catch(() => {
              console.error("[Drafta] Delete sync failed permanently:", deletePayload);
              toast.error("Some deletions may not have been saved to the server. Please refresh.");
            });
          }, 5000);
        });
      }
    }

    // Auto-save (debounced for batching)
    if (state.currentProjectId) {
      scheduleDebouncedSave();
    }

    // Persistent snapshot (fire-and-forget, debounced per artifact).
    // Captures post-AI-edit state of the active artifact so users can
    // restore via the version history panel. Failures are silent.
    if (hasAnyOps && state.currentEntityId && state.currentEntityType) {
      const post = get();
      const labelPreview = displayContent.slice(0, 60);
      const label = labelPreview ? `After AI edit — ${labelPreview}` : "After AI edit";
      const id = post.currentEntityId!;
      switch (post.currentEntityType) {
        case "ku":
          scheduleSnapshot({ type: "ku", id, content: { docContent: post.docContent }, label });
          break;
        case "table":
          scheduleSnapshot({ type: "table", id, content: { sheets: post.sheets }, label });
          break;
        case "deck":
          scheduleSnapshot({
            type: "deck",
            id,
            content: { slides: post.deckSlides, theme: post.deckTheme },
            label,
          });
          break;
      }
    }

    // Auto-generate title
    setTimeout(() => get().autoGenerateTitle(), 200);
  },

  applySheetOperations: (operations: SheetOperation[]) =>
    set((state) => ({
      sheets: applyOperations(state.sheets, operations),
      sheetVersion: state.sheetVersion + 1,
    })),

  applyDocOperations: (operations: DocOperation[]) =>
    set((state) => ({
      docContent: applyDocOps(state.docContent, operations),
      docVersion: state.docVersion + 1,
    })),

  updateSheetData: (data) => {
    if (!Array.isArray(data)) return;
    // Ensure every sheet has celldata array
    const safe = data.map((s: any) => ({
      ...s,
      celldata: Array.isArray(s.celldata) ? s.celldata : [],
    }));
    set({ sheets: safe });
    scheduleDebouncedSave();
  },

  updateDocContent: (content: string) => {
    set({ docContent: content });
    scheduleDebouncedSave();
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  addPendingAttachment: (attachment: FileAttachment) =>
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    })),

  removePendingAttachment: (id: string) =>
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
    })),

  updatePendingAttachment: (id: string, updates: Partial<FileAttachment>) =>
    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  clearPendingAttachments: () => set({ pendingAttachments: [] }),

  clearPendingSheetImages: () => set({ pendingSheetImages: [] }),

  clearSuggestions: () => set({ suggestions: [] }),

  clearAiModifiedEntity: (id: string) =>
    set((state) => ({
      aiModifiedEntityIds: state.aiModifiedEntityIds.filter((eid) => eid !== id),
    })),

  setReadingFiles: (files: string[]) => set({ readingFiles: files }),
  setAIPhase: (phase) => set({ aiPhase: phase }),

  // ── Legacy Conversations (TODO: Remove in next release — only kept for migration) ──

  loadConversations: () => {
    const conversations = loadConversationsFromStorage();
    set({ conversations });
  },

  autoGenerateTitle: async () => {
    const state = get();
    const isProject = !!state.currentProjectId;

    // For non-project chats: only on first exchange (exactly 2 messages)
    if (!isProject && state.messages.length !== 2) return;

    // For projects: need at least 2 messages
    if (isProject && state.messages.length < 2) return;

    // Only auto-generate title once — skip if project already has a real title
    if (isProject && state.currentProjectId) {
      const project = state.projects.find((p) => p.id === state.currentProjectId);
      if (project && project.title !== "New Project") return;
    }

    // Use the latest user and assistant messages for best context
    const userMsgs = state.messages.filter((m) => m.role === "user");
    const assistantMsgs = state.messages.filter((m) => m.role === "assistant");
    const userMsg = userMsgs[userMsgs.length - 1];
    const assistantMsg = assistantMsgs[assistantMsgs.length - 1];
    if (!userMsg || !assistantMsg) return;

    try {
      const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: userMsg.content.slice(0, 300),
          assistantMessage: assistantMsg.content.slice(0, 300),
          includeProjectDetails: isProject,
        }),
      });
      if (!response.ok) return;
      const { title, description, projectType } = await response.json();
      if (!title) return;

      if (isProject && state.currentProjectId) {
        get().renameProject(state.currentProjectId, title);
        const updates: { description?: string; projectType?: string } = {};
        if (description) updates.description = description;
        if (projectType) updates.projectType = projectType;
        if (Object.keys(updates).length > 0) {
          get().updateProject(state.currentProjectId, updates);
        }
      }
    } catch {
      // Silently fail — title generation is best-effort
    }
  },

  updateProjectMemory: (memory) => {
    const state = get();
    const newMemory = { ...state.projectMemory, ...memory };
    set({ projectMemory: newMemory });

    // Background sync to Neon if in a project
    if (state.currentProjectId) {
      updateProjectOnServer(state.currentProjectId, { memory: newMemory }).catch(() => {});
    }
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const snapshot = state.undoStack[state.undoStack.length - 1];
    const newStack = state.undoStack.slice(0, -1);

    // Push current state onto redo stack before restoring (deep-clone to avoid mutation)
    const redoSnapshot: UndoSnapshot = {
      entityType: snapshot.entityType,
      sheets: JSON.parse(JSON.stringify(state.sheets)),
      docContent: state.docContent,
      deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
      deckTheme: state.deckTheme,
      pageHtml: state.pageHtml,
      pageEditableFields: JSON.parse(JSON.stringify(state.pageEditableFields)),
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
      deckSlides: snapshot.deckSlides,
      deckTheme: snapshot.deckTheme,
      deckVersion: state.deckVersion + 1,
      pageHtml: snapshot.pageHtml,
      pageEditableFields: snapshot.pageEditableFields,
      pageVersion: state.pageVersion + 1,
      undoStack: newStack,
      canUndo: newStack.length > 0,
      redoStack: [...state.redoStack, redoSnapshot],
      canRedo: true,
    });

    toast(`Undone: ${snapshot.label}`);

    setTimeout(() => {
      const s = get();
      if (s.currentProjectId) s.saveCurrentEntity();
    }, 100);
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const snapshot = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);

    // Push current state back onto undo stack (deep-clone to avoid mutation)
    const undoSnapshot: UndoSnapshot = {
      entityType: snapshot.entityType,
      sheets: JSON.parse(JSON.stringify(state.sheets)),
      docContent: state.docContent,
      deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
      deckTheme: state.deckTheme,
      pageHtml: state.pageHtml,
      pageEditableFields: JSON.parse(JSON.stringify(state.pageEditableFields)),
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
      deckSlides: snapshot.deckSlides,
      deckTheme: snapshot.deckTheme,
      deckVersion: state.deckVersion + 1,
      pageHtml: snapshot.pageHtml,
      pageEditableFields: snapshot.pageEditableFields,
      pageVersion: state.pageVersion + 1,
      undoStack: [...state.undoStack, undoSnapshot],
      canUndo: true,
      redoStack: newRedoStack,
      canRedo: newRedoStack.length > 0,
    });

    setTimeout(() => {
      const s = get();
      if (s.currentProjectId) s.saveCurrentEntity();
    }, 100);
  },

  resetAll: () => {
    const state = get();
    if (state.messages.length > 0 && state.currentProjectId) {
      state.saveCurrentEntity();
    }

    set({
      messages: [],
      currentConversationId: null,
      currentProjectId: null,
      currentEntityId: null,
      currentEntityType: null,
      isStreaming: false,
      streamingContent: "",
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      activeTab: "sheet",
      workspaceOpen: false,
      pendingAttachments: [],
      suggestions: [],
      projectMemory: {},
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
      openTabs: [],
    });
  },

  // ══════════════════════════════════
  // ── Project CRUD ──
  // ══════════════════════════════════

  createProject: (title: string) => {
    const now = Date.now();
    const project: Project = {
      id: nanoid(),
      title,
      description: "A new workspace for your documents, spreadsheets, and AI-assisted content.",
      projectType: "Content",
      knowledgeUnits: [],
      tables: [],
      decks: [],
      pages: [],
      messages: [],
      memory: {},
      createdAt: now,
      updatedAt: now,
    };

    const state = get();
    // Save current work before switching
    if (state.messages.length > 0 && state.currentProjectId) {
      state.saveCurrentEntity();
    }

    const updated = [project, ...state.projects];
    set({
      projects: updated,
      currentProjectId: project.id,
      currentConversationId: null,
      currentEntityId: null,
      currentEntityType: null,
      projectsFullyLoaded: { ...state.projectsFullyLoaded, [project.id]: true },
      messages: [],
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      deckSlides: [],
      deckTheme: "light" as const,
      deckVersion: state.deckVersion + 1,
      workspaceOpen: true,
      activeTab: "sheet",
      pendingAttachments: [],
      suggestions: [],
      projectMemory: {},
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
      openTabs: [],
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    createProjectOnServer({ id: project.id, title, description: project.description, projectType: project.projectType }).catch(() => {});

    return project;
  },

  deleteProject: (id: string) => {
    const state = get();
    const updated = state.projects.filter((p) => p.id !== id);
    const isCurrent = state.currentProjectId === id;

    set({
      projects: updated,
      ...(isCurrent
        ? {
            currentProjectId: null,
            currentEntityId: null,
            currentEntityType: null,
            messages: [],
            sheets: createEmptySheet(),
            sheetVersion: state.sheetVersion + 1,
            docContent: "",
            docVersion: state.docVersion + 1,
            deckSlides: [],
            deckTheme: "light" as const,
            deckVersion: state.deckVersion + 1,
            workspaceOpen: false,
            isStreaming: false,
            streamingContent: "",
            openTabs: [],
            suggestions: [],
            projectMemory: {},
            undoStack: [],
            canUndo: false,
            redoStack: [],
            canRedo: false,
          }
        : {}),
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    deleteProjectOnServer(id).catch(() => {});
  },

  renameProject: (id: string, title: string) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === id ? { ...p, title, updatedAt: Date.now() } : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(id, { title }).catch(() => {});
  },

  updateProject: (id: string, updates: { title?: string; description?: string; projectType?: string }) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(id, updates).catch(() => {});
  },

  switchProject: (id: string) => {
    const state = get();
    // Save current work
    if (state.messages.length > 0 && state.currentProjectId) {
      state.saveCurrentEntity();
    }

    const project = state.projects.find((p) => p.id === id);
    if (!project) return;

    set({
      currentProjectId: project.id,
      currentConversationId: null,
      currentEntityId: null,
      currentEntityType: null,
      messages: project.messages,
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      deckSlides: [],
      deckTheme: "light" as const,
      deckVersion: state.deckVersion + 1,
      workspaceOpen: true,
      activeTab: "sheet",
      isStreaming: false,
      streamingContent: "",
      pendingAttachments: [],
      suggestions: [],
      projectMemory: project.memory || {},
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
      openTabs: [],
    });

    // Load full project data if not already loaded
    if (!state.projectsFullyLoaded[id]) {
      get().loadFullProject(id);
    }

    // Auto-update project details if missing and project has messages
    const needsDetails =
      !project.description ||
      project.description === "A new workspace for your documents, spreadsheets, and AI-assisted content." ||
      !project.projectType;
    if (needsDetails && project.messages.length >= 2) {
      setTimeout(() => get().autoGenerateTitle(), 300);
    }
  },

  // Return to the global all-projects list. Mirrors switchProject's reset so
  // NO project-scoped state (messages, openTabs, undo, memory, entity buffers)
  // bleeds into the Projects view. Single source of truth for "go home".
  goToProjectsHome: () => {
    const state = get();
    if (state.currentProjectId) state.saveCurrentEntity();
    set({
      currentProjectId: null,
      currentEntityId: null,
      currentEntityType: null,
      messages: [],
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      deckSlides: [],
      deckTheme: "light" as const,
      deckVersion: state.deckVersion + 1,
      pageHtml: "",
      pageEditableFields: [],
      pageVersion: state.pageVersion + 1,
      workspaceOpen: false,
      isStreaming: false,
      streamingContent: "",
      openTabs: [],
      suggestions: [],
      projectMemory: {},
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
    });
  },

  // Close the open entity → the current project's home (files grid). Keeps the
  // project, its messages, open tabs and memory; clears only the active entity
  // and its flat buffers.
  goToProjectHome: () => {
    const state = get();
    if (state.currentEntityId) state.saveCurrentEntity();
    set({
      currentEntityId: null,
      currentEntityType: null,
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      deckSlides: [],
      deckVersion: state.deckVersion + 1,
      pageHtml: "",
      pageEditableFields: [],
      pageVersion: state.pageVersion + 1,
      suggestions: [],
    });
  },

  // ══════════════════════════════════
  // ── Folder CRUD (in-project grouping) ──
  // ══════════════════════════════════

  createFolder: (projectId: string, name = "New Folder", color = "#FFB43F") => {
    const now = Date.now();
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    const position = project?.folders?.length ?? 0;
    const folder: Folder = { id: nanoid(), projectId, name, color, position, createdAt: now, updatedAt: now };
    const updated = state.projects.map((p) =>
      p.id === projectId ? { ...p, folders: [...(p.folders || []), folder] } : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);
    updateProjectOnServer(projectId, {
      folders: [{ id: folder.id, name: folder.name, color: folder.color, position: folder.position }],
    }).catch(() => {});
    return folder;
  },

  renameFolder: (projectId: string, folderId: string, name: string) => {
    const updated = get().projects.map((p) =>
      p.id === projectId
        ? { ...p, folders: (p.folders || []).map((f) => (f.id === folderId ? { ...f, name } : f)) }
        : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);
    const f = updated.find((p) => p.id === projectId)?.folders?.find((x) => x.id === folderId);
    if (f) updateProjectOnServer(projectId, { folders: [{ id: f.id, name: f.name, color: f.color, position: f.position }] }).catch(() => {});
  },

  recolorFolder: (projectId: string, folderId: string, color: string) => {
    const updated = get().projects.map((p) =>
      p.id === projectId
        ? { ...p, folders: (p.folders || []).map((f) => (f.id === folderId ? { ...f, color } : f)) }
        : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);
    const f = updated.find((p) => p.id === projectId)?.folders?.find((x) => x.id === folderId);
    if (f) updateProjectOnServer(projectId, { folders: [{ id: f.id, name: f.name, color: f.color, position: f.position }] }).catch(() => {});
  },

  deleteFolder: (projectId: string, folderId: string) => {
    const clearFolder = <T extends { folderId?: string | null }>(arr: T[]) =>
      arr.map((e) => (e.folderId === folderId ? { ...e, folderId: null } : e));
    const updated = get().projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            folders: (p.folders || []).filter((f) => f.id !== folderId),
            knowledgeUnits: clearFolder(p.knowledgeUnits),
            tables: clearFolder(p.tables),
            decks: clearFolder(p.decks),
            pages: clearFolder(p.pages),
          }
        : p
    );
    set({ projects: updated });
    saveProjectsToStorage(updated);
    updateProjectOnServer(projectId, { deletedFolderIds: [folderId] }).catch(() => {});
  },

  moveEntityToFolder: (projectId: string, entityId: string, entityType: EntityType, folderId: string | null) => {
    const apply = <T extends { id: string; folderId?: string | null }>(arr: T[]) =>
      arr.map((e) => (e.id === entityId ? { ...e, folderId } : e));
    const updated = get().projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        knowledgeUnits: entityType === "ku" ? apply(p.knowledgeUnits) : p.knowledgeUnits,
        tables: entityType === "table" ? apply(p.tables) : p.tables,
        decks: entityType === "deck" ? apply(p.decks) : p.decks,
        pages: entityType === "page" ? apply(p.pages) : p.pages,
      };
    });
    set({ projects: updated });
    saveProjectsToStorage(updated);
    updateProjectOnServer(projectId, {
      entityFolderMoves: [{ id: entityId, entityType, folderId }],
    }).catch(() => {});
  },

  // ══════════════════════════════════
  // ── Knowledge Unit CRUD ──
  // ══════════════════════════════════

  createKnowledgeUnit: (projectId: string, title: string, content?: string) => {
    const now = Date.now();
    const ku: KnowledgeUnit = {
      id: nanoid(),
      projectId,
      title,
      content: content || "",
      createdAt: now,
      updatedAt: now,
    };

    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, knowledgeUnits: [...p.knowledgeUnits, ku], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: ku.id,
      currentEntityType: "ku",
      docContent: ku.content,
      docVersion: state.docVersion + 1,
      activeTab: "doc",
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== ku.id), { id: ku.id, type: "ku" as const, title: ku.title }],
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(projectId, {
      knowledgeUnits: [{ id: ku.id, title: ku.title, content: ku.content }],
    }).catch(() => {});

    // Background embedding generation
    if (ku.content) {
      generateEntityEmbedding(ku.id, projectId, `${ku.title}\n${ku.content}`);
    }

    return ku;
  },

  duplicateKnowledgeUnit: (projectId: string, kuId: string) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    const original = project.knowledgeUnits.find((k) => k.id === kuId);
    if (!original) return null;

    const now = Date.now();
    const ku: KnowledgeUnit = {
      id: nanoid(),
      projectId,
      title: `${original.title} (copy)`,
      content: original.content,
      createdAt: now,
      updatedAt: now,
    };

    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, knowledgeUnits: [...p.knowledgeUnits, ku], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: ku.id,
      currentEntityType: "ku",
      docContent: ku.content,
      docVersion: state.docVersion + 1,
      activeTab: "doc",
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== ku.id), { id: ku.id, type: "ku" as const, title: ku.title }],
    });
    saveProjectsToStorage(updated);

    updateProjectOnServer(projectId, {
      knowledgeUnits: [{ id: ku.id, title: ku.title, content: ku.content }],
    }).catch(() => {});

    toast.success(`Duplicated "${original.title}"`);
    return ku;
  },

  deleteKnowledgeUnit: (projectId: string, kuId: string) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            knowledgeUnits: p.knowledgeUnits.filter((k) => k.id !== kuId),
            updatedAt: Date.now(),
          }
        : p
    );

    const isCurrent = state.currentEntityId === kuId;
    set({
      projects: updated,
      openTabs: state.openTabs.filter((t) => t.id !== kuId),
      ...(isCurrent
        ? {
            currentEntityId: null,
            currentEntityType: null,
            docContent: "",
            docVersion: state.docVersion + 1,
            workspaceOpen: false,
          }
        : {}),
    });
    saveProjectsToStorage(updated);

    // Background sync: delete KU on server
    updateProjectOnServer(projectId, {
      deletedKnowledgeUnitIds: [kuId],
    }).catch(() => {});
  },

  renameKnowledgeUnit: (projectId: string, kuId: string, title: string) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            knowledgeUnits: p.knowledgeUnits.map((k) =>
              k.id === kuId ? { ...k, title, updatedAt: Date.now() } : k
            ),
            updatedAt: Date.now(),
          }
        : p
    );
    set({
      projects: updated,
      openTabs: state.openTabs.map((t) => t.id === kuId ? { ...t, title } : t),
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(projectId, {
      knowledgeUnits: [{ id: kuId, title }],
    }).catch(() => {});
  },

  openKnowledgeUnit: (kuId: string) => {
    // Save current entity first, then re-read state for fresh projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const found = findKnowledgeUnit(state.projects, kuId);
    if (!found) return;

    // Add to open tabs if not already there
    const newTabs = state.openTabs.some((t) => t.id === kuId)
      ? state.openTabs
      : [...state.openTabs, { id: kuId, type: "ku" as const, title: found.ku.title }];

    set({
      currentEntityId: found.ku.id,
      currentEntityType: "ku",
      docContent: found.ku.content,
      docVersion: state.docVersion + 1,
      activeTab: "doc",
      workspaceOpen: true,
      openTabs: newTabs,
    });
  },

  // ══════════════════════════════════
  // ── Table CRUD ──
  // ══════════════════════════════════

  createTable: (projectId: string, title: string, sheets?) => {
    const now = Date.now();
    const table: ProjectTable = {
      id: nanoid(),
      projectId,
      title,
      sheets: sheets || createEmptySheet(),
      createdAt: now,
      updatedAt: now,
    };

    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, tables: [...p.tables, table], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: table.id,
      currentEntityType: "table",
      sheets: table.sheets,
      sheetVersion: state.sheetVersion + 1,
      activeTab: "sheet",
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== table.id), { id: table.id, type: "table" as const, title: table.title }],
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(projectId, {
      tables: [{ id: table.id, title: table.title, sheets: table.sheets }],
    }).catch(() => {});

    // Background embedding generation from title + headers
    const headers = table.sheets[0]?.celldata
      ?.filter((c) => c.r === 0)
      .sort((a, b) => a.c - b.c)
      .map((c) => String(c.v?.v || ""))
      .join(", ");
    generateEntityEmbedding(table.id, projectId, `${table.title}\n${headers || ""}`);

    return table;
  },

  duplicateTable: (projectId: string, tableId: string) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    const original = project.tables.find((t) => t.id === tableId);
    if (!original) return null;

    const now = Date.now();
    const table: ProjectTable = {
      id: nanoid(),
      projectId,
      title: `${original.title} (copy)`,
      sheets: JSON.parse(JSON.stringify(original.sheets)),
      createdAt: now,
      updatedAt: now,
    };

    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, tables: [...p.tables, table], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: table.id,
      currentEntityType: "table",
      sheets: table.sheets,
      sheetVersion: state.sheetVersion + 1,
      activeTab: "sheet",
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== table.id), { id: table.id, type: "table" as const, title: table.title }],
    });
    saveProjectsToStorage(updated);

    updateProjectOnServer(projectId, {
      tables: [{ id: table.id, title: table.title, sheets: table.sheets }],
    }).catch(() => {});

    toast.success(`Duplicated "${original.title}"`);
    return table;
  },

  deleteTable: (projectId: string, tableId: string) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            tables: p.tables.filter((t) => t.id !== tableId),
            updatedAt: Date.now(),
          }
        : p
    );

    const isCurrent = state.currentEntityId === tableId;
    set({
      projects: updated,
      openTabs: state.openTabs.filter((t) => t.id !== tableId),
      ...(isCurrent
        ? {
            currentEntityId: null,
            currentEntityType: null,
            sheets: createEmptySheet(),
            sheetVersion: state.sheetVersion + 1,
            workspaceOpen: false,
          }
        : {}),
    });
    saveProjectsToStorage(updated);

    // Background sync: delete table on server
    updateProjectOnServer(projectId, {
      deletedTableIds: [tableId],
    }).catch(() => {});
  },

  renameTable: (projectId: string, tableId: string, title: string) => {
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            tables: p.tables.map((t) =>
              t.id === tableId ? { ...t, title, updatedAt: Date.now() } : t
            ),
            updatedAt: Date.now(),
          }
        : p
    );
    set({
      projects: updated,
      openTabs: state.openTabs.map((t) => t.id === tableId ? { ...t, title } : t),
    });
    saveProjectsToStorage(updated);

    // Background sync to Neon
    updateProjectOnServer(projectId, {
      tables: [{ id: tableId, title }],
    }).catch(() => {});
  },

  openTable: (tableId: string) => {
    // Save current entity first, then re-read state for fresh projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const found = findTable(state.projects, tableId);
    if (!found) return;

    // Add to open tabs if not already there
    const newTabs = state.openTabs.some((t) => t.id === tableId)
      ? state.openTabs
      : [...state.openTabs, { id: tableId, type: "table" as const, title: found.table.title }];

    set({
      currentEntityId: found.table.id,
      currentEntityType: "table",
      sheets: found.table.sheets,
      sheetVersion: state.sheetVersion + 1,
      activeTab: "sheet",
      workspaceOpen: true,
      openTabs: newTabs,
    });
  },

  // ══════════════════════════════════
  // ── Deck CRUD ──
  // ══════════════════════════════════

  createDeck: (projectId, title, theme = "light", slides) => {
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const now = Date.now();
    const newDeck: ProjectDeck = {
      id: nanoid(),
      projectId,
      title,
      theme,
      slides: slides || [],
      createdAt: now,
      updatedAt: now,
    };

    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, decks: [...(p.decks || []), newDeck], updatedAt: now };
      }
      return p;
    });

    set({ projects: newProjects });
    saveProjectsToStorage(newProjects);
    get().openDeck(newDeck.id);

    // New decks with no slides start in idle phase
    if (!slides || slides.length === 0) {
      set({
        deckPhase: "idle" as DeckPhase,
        deckStyle: null,
      });
    } else {
      set({ deckPhase: "viewing" as DeckPhase });
    }

    return newDeck;
  },

  duplicateDeck: (projectId: string, deckId: string) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    const original = (project.decks || []).find((d) => d.id === deckId);
    if (!original) return null;

    const now = Date.now();
    const deck: ProjectDeck = {
      id: nanoid(),
      projectId,
      title: `${original.title} (copy)`,
      theme: original.theme,
      slides: JSON.parse(JSON.stringify(original.slides)),
      createdAt: now,
      updatedAt: now,
    };

    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, decks: [...(p.decks || []), deck], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: deck.id,
      currentEntityType: "deck",
      deckSlides: deck.slides,
      deckTheme: deck.theme,
      deckVersion: state.deckVersion + 1,
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== deck.id), { id: deck.id, type: "deck" as const, title: deck.title }],
    });
    saveProjectsToStorage(updated);

    updateProjectOnServer(projectId, {
      decks: [{ id: deck.id, title: deck.title, theme: deck.theme, slides: deck.slides }],
    }).catch(() => {});

    toast.success(`Duplicated "${original.title}"`);
    return deck;
  },

  deleteDeck: (projectId, deckId) => {
    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, decks: (p.decks || []).filter((d) => d.id !== deckId), updatedAt: Date.now() };
      }
      return p;
    });

    const newTabs = state.openTabs.filter((t) => t.id !== deckId);
    const isCurrent = state.currentEntityId === deckId;
    set({
      projects: newProjects,
      openTabs: newTabs,
      ...(isCurrent
        ? {
            currentEntityId: null,
            currentEntityType: null,
            deckSlides: [],
            deckVersion: state.deckVersion + 1,
            workspaceOpen: false,
          }
        : {}),
    });
    saveProjectsToStorage(newProjects);
    updateProjectOnServer(projectId, { deletedDeckIds: [deckId] }).catch(() => {});
  },

  renameDeck: (projectId, deckId, title) => {
    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          decks: (p.decks || []).map((d) => d.id === deckId ? { ...d, title, updatedAt: Date.now() } : d),
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    const newTabs = state.openTabs.map((t) => t.id === deckId ? { ...t, title } : t);
    set({ projects: newProjects, openTabs: newTabs });
    saveProjectsToStorage(newProjects);
    updateProjectOnServer(projectId, { decks: [{ id: deckId, title }] }).catch(() => {});
  },

  openDeck: (deckId) => {
    // Save current entity first, then re-read state for fresh projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const found = findDeck(state.projects, deckId);
    if (!found) return;

    const newTabs = state.openTabs.some((t) => t.id === deckId)
      ? state.openTabs
      : [...state.openTabs, { id: deckId, type: "deck" as const, title: found.deck.title }];

    set({
      currentEntityId: found.deck.id,
      currentEntityType: "deck",
      deckSlides: found.deck.slides,
      deckTheme: found.deck.theme,
      deckStyle: found.deck.style || null,
      deckVersion: state.deckVersion + 1,
      deckPhase: found.deck.slides.length > 0 ? "viewing" as DeckPhase : "idle" as DeckPhase,
      workspaceOpen: true,
      openTabs: newTabs,
    });
  },

  updateDeckSlides: (slides) => {
    set({ deckSlides: slides });
    scheduleDebouncedSave();
  },

  updateDeckTheme: (theme) => {
    set({ deckTheme: theme });
    scheduleDebouncedSave();
  },

  setDeckPhase: (phase) => set({ deckPhase: phase }),
  updateDeckStyle: (style) => {
    set({ deckStyle: style });
    scheduleDebouncedSave();
  },

  resetDeckBuilder: () => set({
    deckPhase: "idle" as DeckPhase,
    deckSlides: [],
    deckStyle: null,
  }),

  // ══════════════════════════════════
  // ── HTML Page CRUD ──
  // ══════════════════════════════════

  createPage: (projectId, title, html = "", opts) => {
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const now = Date.now();
    const newPage: ProjectPage = {
      id: nanoid(),
      projectId,
      title,
      html,
      editableFields: opts?.editableFields || [],
      sourceKuId: opts?.sourceKuId || null,
      createdAt: now,
      updatedAt: now,
    };

    const state = get();
    const newProjects = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, pages: [...(p.pages || []), newPage], updatedAt: now }
        : p
    );

    set({
      projects: newProjects,
      currentEntityId: newPage.id,
      currentEntityType: "page",
      pageHtml: newPage.html,
      pageEditableFields: newPage.editableFields || [],
      pageVersion: state.pageVersion + 1,
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== newPage.id), { id: newPage.id, type: "page" as const, title: newPage.title }],
    });
    saveProjectsToStorage(newProjects);

    updateProjectOnServer(projectId, {
      pages: [{ id: newPage.id, title: newPage.title, html: newPage.html, editableFields: newPage.editableFields, sourceKuId: newPage.sourceKuId }],
    }).catch(() => {});

    if (html.trim()) {
      generateEntityEmbedding(newPage.id, projectId, `${title}\n${html.replace(/<[^>]+>/g, " ").slice(0, 4000)}`);
    }
    return newPage;
  },

  duplicatePage: (projectId, pageId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    const original = (project.pages || []).find((p) => p.id === pageId);
    if (!original) return null;

    const now = Date.now();
    const page: ProjectPage = {
      id: nanoid(),
      projectId,
      title: `${original.title} (copy)`,
      html: original.html,
      editableFields: original.editableFields ? JSON.parse(JSON.stringify(original.editableFields)) : [],
      sourceKuId: original.sourceKuId || null,
      createdAt: now,
      updatedAt: now,
    };

    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();
    const updated = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, pages: [...(p.pages || []), page], updatedAt: now }
        : p
    );

    set({
      projects: updated,
      currentEntityId: page.id,
      currentEntityType: "page",
      pageHtml: page.html,
      pageEditableFields: page.editableFields || [],
      pageVersion: state.pageVersion + 1,
      workspaceOpen: true,
      openTabs: [...state.openTabs.filter((t) => t.id !== page.id), { id: page.id, type: "page" as const, title: page.title }],
    });
    saveProjectsToStorage(updated);
    updateProjectOnServer(projectId, {
      pages: [{ id: page.id, title: page.title, html: page.html, editableFields: page.editableFields, sourceKuId: page.sourceKuId }],
    }).catch(() => {});
    toast.success(`Duplicated "${original.title}"`);
    return page;
  },

  deletePage: (projectId, pageId) => {
    const state = get();
    const newProjects = state.projects.map((p) =>
      p.id === projectId
        ? { ...p, pages: (p.pages || []).filter((pg) => pg.id !== pageId), updatedAt: Date.now() }
        : p
    );
    const newTabs = state.openTabs.filter((t) => t.id !== pageId);
    const isCurrent = state.currentEntityId === pageId;
    set({
      projects: newProjects,
      openTabs: newTabs,
      ...(isCurrent
        ? {
            currentEntityId: null,
            currentEntityType: null,
            pageHtml: "",
            pageEditableFields: [],
            pageVersion: state.pageVersion + 1,
            workspaceOpen: false,
          }
        : {}),
    });
    saveProjectsToStorage(newProjects);
    updateProjectOnServer(projectId, { deletedPageIds: [pageId] }).catch(() => {});
  },

  renamePage: (projectId, pageId, title) => {
    const state = get();
    const newProjects = state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            pages: (p.pages || []).map((pg) => pg.id === pageId ? { ...pg, title, updatedAt: Date.now() } : pg),
            updatedAt: Date.now(),
          }
        : p
    );
    const newTabs = state.openTabs.map((t) => t.id === pageId ? { ...t, title } : t);
    set({ projects: newProjects, openTabs: newTabs });
    saveProjectsToStorage(newProjects);
    updateProjectOnServer(projectId, { pages: [{ id: pageId, title }] }).catch(() => {});
  },

  openPage: (pageId) => {
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();
    const found = findPage(state.projects, pageId);
    if (!found) return;

    const newTabs = state.openTabs.some((t) => t.id === pageId)
      ? state.openTabs
      : [...state.openTabs, { id: pageId, type: "page" as const, title: found.page.title }];

    set({
      currentEntityId: found.page.id,
      currentEntityType: "page",
      pageHtml: found.page.html,
      pageEditableFields: found.page.editableFields || [],
      pageVersion: state.pageVersion + 1,
      workspaceOpen: true,
      openTabs: newTabs,
    });
  },

  updatePageHtml: (html) => {
    set({ pageHtml: html });
    scheduleDebouncedSave();
  },

  applyPageOperations: (operations) => {
    const state = get();
    set({ pageHtml: applyPageOps(state.pageHtml, operations), pageVersion: state.pageVersion + 1 });
    scheduleDebouncedSave();
  },

  // ══════════════════════════════════
  // ── Tab Management ──
  // ══════════════════════════════════

  closeTab: (id: string) => {
    // Save current entity before any tab change
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();
    const newTabs = state.openTabs.filter((t) => t.id !== id);
    const isCurrent = state.currentEntityId === id;

    if (!isCurrent) {
      set({ openTabs: newTabs });
      return;
    }

    // Closing the active tab — pick next or previous tab
    const idx = state.openTabs.findIndex((t) => t.id === id);
    const nextTab = newTabs[idx] || newTabs[idx - 1];

    if (!nextTab) {
      // No more tabs — go to project home
      set({
        openTabs: newTabs,
        currentEntityId: null,
        currentEntityType: null,
        workspaceOpen: !!state.currentProjectId,
      });
      return;
    }

    // Switch to the next tab atomically — load its data in one set() to avoid double saves
    const updates: Partial<AppState> = {
      openTabs: newTabs,
      currentEntityId: nextTab.id,
      currentEntityType: nextTab.type,
      workspaceOpen: true,
    };

    if (nextTab.type === "ku") {
      const found = findKnowledgeUnit(state.projects, nextTab.id);
      if (found) {
        updates.docContent = found.ku.content;
        updates.docVersion = state.docVersion + 1;
        updates.activeTab = "doc";
      }
    } else if (nextTab.type === "table") {
      const found = findTable(state.projects, nextTab.id);
      if (found) {
        updates.sheets = found.table.sheets;
        updates.sheetVersion = state.sheetVersion + 1;
        updates.activeTab = "sheet";
      }
    } else if (nextTab.type === "deck") {
      const found = findDeck(state.projects, nextTab.id);
      if (found) {
        updates.deckSlides = found.deck.slides;
        updates.deckTheme = found.deck.theme;
        updates.deckVersion = state.deckVersion + 1;
      }
    }

    set(updates);
  },

  // ══════════════════════════════════
  // ── Entity Sync ──
  // ══════════════════════════════════

  saveCurrentEntity: () => {
    const state = get();
    if (!state.currentProjectId) return;
    set({ isSaving: true, saveError: null });

    const projIdx = state.projects.findIndex((p) => p.id === state.currentProjectId);
    if (projIdx < 0) {
      set({ isSaving: false });
      return;
    }

    const updated = [...state.projects];
    const project = { ...updated[projIdx] };

    // Save messages to project
    project.messages = state.messages;
    project.memory = state.projectMemory;

    // Save active entity's flat fields back
    if (state.currentEntityId && state.currentEntityType === "ku") {
      project.knowledgeUnits = project.knowledgeUnits.map((k) =>
        k.id === state.currentEntityId
          ? { ...k, content: state.docContent, updatedAt: Date.now() }
          : k
      );
    } else if (state.currentEntityId && state.currentEntityType === "table") {
      // Sanitize sheets before saving — ensure celldata is always an array
      const sanitizedSheets = state.sheets.map((s) => ({
        ...s,
        celldata: Array.isArray(s.celldata) ? s.celldata : [],
      }));
      project.tables = project.tables.map((t) =>
        t.id === state.currentEntityId
          ? { ...t, sheets: sanitizedSheets, updatedAt: Date.now() }
          : t
      );
    } else if (state.currentEntityId && state.currentEntityType === "deck") {
      project.decks = (project.decks || []).map((d) =>
        d.id === state.currentEntityId
          ? { ...d, slides: state.deckSlides, theme: state.deckTheme, style: state.deckStyle, updatedAt: Date.now() }
          : d
      );
    } else if (state.currentEntityId && state.currentEntityType === "page") {
      project.pages = (project.pages || []).map((pg) =>
        pg.id === state.currentEntityId
          ? { ...pg, html: state.pageHtml, editableFields: state.pageEditableFields, updatedAt: Date.now() }
          : pg
      );
    }

    project.updatedAt = Date.now();
    updated[projIdx] = project;

    set({ projects: updated });
    saveProjectsToStorage(updated);

    // Regenerate embedding for updated entity (only if it doesn't have one yet)
    if (state.currentEntityId && state.currentProjectId) {
      if (state.currentEntityType === "ku") {
        const ku = project.knowledgeUnits.find((k) => k.id === state.currentEntityId);
        if (ku && ku.content && !ku.embedding) {
          generateEntityEmbedding(ku.id, state.currentProjectId, `${ku.title}\n${ku.content}`);
        }
      } else if (state.currentEntityType === "table") {
        const table = project.tables.find((t) => t.id === state.currentEntityId);
        if (table && !table.embedding) {
          const headers = table.sheets[0]?.celldata
            ?.filter((c) => c.r === 0)
            .sort((a, b) => a.c - b.c)
            .map((c) => String(c.v?.v || ""))
            .join(", ");
          generateEntityEmbedding(table.id, state.currentProjectId, `${table.title}\n${headers || ""}`);
        }
      }
    }

    // Background sync full project state to Neon
    const syncPayload: Record<string, any> = {
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      memory: project.memory,
      knowledgeUnits: project.knowledgeUnits.map((k) => ({
        id: k.id,
        title: k.title,
        content: k.content,
      })),
      tables: project.tables.map((t) => ({
        id: t.id,
        title: t.title,
        sheets: t.sheets,
      })),
      decks: (project.decks || []).map((d) => ({
        id: d.id,
        title: d.title,
        theme: d.theme,
        style: d.style || null,
        slides: d.slides,
      })),
      pages: (project.pages || []).map((pg) => ({
        id: pg.id,
        title: pg.title,
        html: pg.html,
        editableFields: pg.editableFields || [],
        sourceKuId: pg.sourceKuId || null,
      })),
      newMessages: project.messages.slice(-2).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        attachments: m.attachments,
      })),
    };
    updateProjectOnServer(project.id, syncPayload)
      .then((result) => {
        if (!result.ok) {
          toast.error("Failed to save to server — changes are saved locally");
          set({ saveError: "Failed to save" });
        } else {
          set({ saveError: null });
        }
      })
      .catch(() => {
        toast.error("Failed to save to server — changes are saved locally");
        set({ saveError: "Failed to save" });
      })
      .finally(() => set({ isSaving: false, lastSavedAt: Date.now() }));
  },

  loadProjects: async () => {
    // Immediately hydrate from localStorage so the UI never flashes empty
    const cached = loadProjectsFromStorage();
    if (cached.length > 0 && get().projects.length === 0) {
      set({ projects: cached });
    }

    // Then fetch lightweight list from server and merge
    try {
      const listItems = await fetchProjects();
      if (listItems.length > 0) {
        const state = get();
        // Convert lightweight items to Project shape, preserving any
        // already-loaded full data from localStorage cache
        const mergedProjects: Project[] = listItems.map((item) => {
          const existing = state.projects.find((p) => p.id === item.id);
          if (existing && state.projectsFullyLoaded[item.id]) {
            // Keep full data but update metadata from server
            return {
              ...existing,
              title: item.title,
              description: item.description,
              projectType: item.projectType,
              shareToken: item.shareToken,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              counts: item.counts,
            };
          }
          // Create a lightweight shell — entities will be loaded on open
          return {
            id: item.id,
            title: item.title,
            description: item.description,
            projectType: item.projectType,
            shareToken: item.shareToken,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            counts: item.counts,
            folders: existing?.folders || [],
            knowledgeUnits: existing?.knowledgeUnits || [],
            tables: existing?.tables || [],
            decks: existing?.decks || [],
            pages: existing?.pages || [],
            messages: existing?.messages || [],
            memory: existing?.memory || {},
          };
        });
        set({ projects: mergedProjects });
        saveProjectsToStorage(mergedProjects);
        return;
      }
    } catch {
      // Server unavailable or not authenticated — fall back
    }

    // If server returned nothing and we haven't hydrated yet, use localStorage
    if (get().projects.length === 0) {
      set({ projects: cached });
    }
  },

  loadFullProject: async (id: string) => {
    const state = get();
    // Skip if already fully loaded
    if (state.projectsFullyLoaded[id]) return;

    set({ isLoadingProject: true });
    try {
      const fullProject = await fetchFullProject(id);
      const current = get();
      const updated = current.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              ...fullProject,
              memory: fullProject.memory || p.memory || {},
              hasMoreMessages: fullProject.hasMoreMessages,
            }
          : p
      );

      set({
        projects: updated,
        projectsFullyLoaded: { ...current.projectsFullyLoaded, [id]: true },
        isLoadingProject: false,
      });
      saveProjectsToStorage(updated);

      // If this project is currently open, update the active view state
      if (current.currentProjectId === id) {
        const loadedProject = updated.find((pp) => pp.id === id);
        if (loadedProject) {
          set({ messages: loadedProject.messages });
        }
      }
    } catch (err) {
      console.error("[Store] Failed to load full project:", err);
      set({ isLoadingProject: false });
    }
  },

  loadEarlierMessages: async () => {
    const state = get();
    if (!state.currentProjectId) return false;

    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project || !project.hasMoreMessages) return false;

    const oldestMessage = state.messages[0];
    if (!oldestMessage) return false;

    try {
      const { messages: olderMessages, hasMore } = await fetchOlderMessages(
        state.currentProjectId,
        oldestMessage.timestamp
      );

      if (olderMessages.length === 0) {
        // No more messages — update flag
        const updated = get().projects.map((p) =>
          p.id === state.currentProjectId ? { ...p, hasMoreMessages: false } : p
        );
        set({ projects: updated });
        return false;
      }

      // Prepend older messages (they arrive in chronological order)
      const merged = [...olderMessages, ...state.messages];
      const updatedProjects = get().projects.map((p) =>
        p.id === state.currentProjectId
          ? { ...p, messages: merged, hasMoreMessages: hasMore }
          : p
      );

      set({ messages: merged, projects: updatedProjects });
      return hasMore;
    } catch (err) {
      console.error("[Store] Failed to load earlier messages:", err);
      return false;
    }
  },

  migrateConversations: () => {
    const state = get();
    if (state.projects.length > 0) return; // Already migrated
    if (state.conversations.length === 0) return; // Nothing to migrate

    const now = Date.now();
    const projects: Project[] = state.conversations.map((conv) => {
      const kus: KnowledgeUnit[] = [];
      const tables: ProjectTable[] = [];

      // If conversation had doc content, create a KU
      if (conv.docContent) {
        kus.push({
          id: nanoid(),
          projectId: "", // Will be set below
          title: "Document",
          content: conv.docContent,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        });
      }

      // If conversation had sheet data, create a table
      if (conv.sheets && conv.sheets.some((s) => s.celldata && s.celldata.length > 0)) {
        tables.push({
          id: nanoid(),
          projectId: "", // Will be set below
          title: "Spreadsheet",
          sheets: conv.sheets,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        });
      }

      const project: Project = {
        id: nanoid(),
        title: conv.title,
        knowledgeUnits: kus,
        tables,
        decks: [],
        pages: [],
        messages: conv.messages,
        memory: conv.memory || {},
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };

      // Fix projectId references
      kus.forEach((k) => (k.projectId = project.id));
      tables.forEach((t) => (t.projectId = project.id));

      return project;
    });

    set({ projects });
    saveProjectsToStorage(projects);
  },
})));
