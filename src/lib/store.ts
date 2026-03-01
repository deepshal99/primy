import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  AppState,
  SheetOperation,
  DocOperation,
  KuOperation,
  TableOperation,
  DiagramOperation,
  DeckOperation,
  DeckSlide,
  FileAttachment,
  Conversation,
  UndoSnapshot,
  Project,
  KnowledgeUnit,
  ProjectTable,
  ProjectDiagram,
  ProjectDeck,
  EntityType,
} from "@/lib/types";
import { createEmptySheet } from "@/lib/sheet/defaultData";
import { applyOperations, normalizeCells } from "@/lib/ai/sheetOperations";
import { applyDocOps } from "@/lib/ai/docOperations";
import {
  fetchProjects,
  createProjectOnServer,
  updateProjectOnServer,
  deleteProjectOnServer,
} from "@/lib/api";

// ── Debounced save manager ──

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 2000;

function scheduleDebouncedSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    const state = useAppStore.getState();
    if (state.currentProjectId) {
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

const STORAGE_KEY = "drafta_conversations";
const PROJECTS_KEY = "drafta_projects";

function loadConversationsFromStorage(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversationsToStorage(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      toast.error("Storage full — some changes may not be saved");
    }
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
      diagrams: (p.diagrams || []).map(({ embedding, ...rest }) => rest),
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
          diagrams: (p.diagrams || []).map((d) =>
            d.id === entityId ? { ...d, embedding } : d
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

function generateTitle(messages: { role: string; content: string }[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  const content = firstUser.content.trim();
  if (content.length <= 40) return content;
  return content.slice(0, 40).trim() + "…";
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

function findDiagram(projects: Project[], diagramId: string): { project: Project; diagram: ProjectDiagram } | null {
  for (const project of projects) {
    const diagram = (project.diagrams || []).find((d) => d.id === diagramId);
    if (diagram) return { project, diagram };
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

export const useAppStore = create<AppState>((set, get) => ({
  // Active view (flat fields synced to current entity)
  messages: [],
  isStreaming: false,
  streamingContent: "",
  sheets: createEmptySheet(),
  sheetVersion: 0,
  docContent: "",
  docVersion: 0,
  diagramSource: "",
  diagramType: "mermaid" as const,
  diagramVersion: 0,
  deckSlides: [] as DeckSlide[],
  deckTheme: "light" as const,
  deckVersion: 0,
  activeTab: "sheet",
  workspaceOpen: false,
  pendingAttachments: [],
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

  // AI-modified entity highlights
  aiModifiedEntityIds: [],

  // Legacy conversations
  conversations: [],
  currentConversationId: null,
  sidebarOpen: true,

  // Project system
  projects: loadProjectsFromStorage(),
  currentProjectId: null,
  currentEntityId: null,
  currentEntityType: null,
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
    sheetOperations?: SheetOperation[],
    docOperations?: DocOperation[],
    kuOperations?: KuOperation[],
    tableOperations?: TableOperation[],
    diagramOperations?: DiagramOperation[],
    deckOperations?: DeckOperation[],
    suggestions?: string[]
  ) => {
    const state = get();
    const newMessage = {
      id: nanoid(),
      role: "assistant" as const,
      content: fullContent,
      timestamp: Date.now(),
    };

    const hasSheetOps = sheetOperations && sheetOperations.length > 0;
    const hasDocOps = docOperations && docOperations.length > 0;
    const hasKuOps = kuOperations && kuOperations.length > 0;
    const hasTableOps = tableOperations && tableOperations.length > 0;
    const hasDiagramOps = diagramOperations && diagramOperations.length > 0;
    const hasDeckOps = deckOperations && deckOperations.length > 0;

    // Snapshot current state before applying AI operations (for undo)
    // New AI operations clear the redo stack (standard editor behavior)
    const hasAnyOps = hasSheetOps || hasDocOps || hasDiagramOps || hasDeckOps;
    let newUndoStack = state.undoStack;
    if (hasAnyOps) {
      const labelParts: string[] = [];
      if (hasSheetOps) labelParts.push("sheet");
      if (hasDocOps) labelParts.push("doc");
      if (hasDiagramOps) labelParts.push("diagram");
      if (hasDeckOps) labelParts.push("deck");
      const entityType: UndoSnapshot["entityType"] = labelParts.length > 1 ? "mixed"
        : hasDeckOps ? "deck" : hasDiagramOps ? "diagram" : hasSheetOps ? "table" : "ku";
      const snapshot: UndoSnapshot = {
        entityType,
        sheets: JSON.parse(JSON.stringify(state.sheets)),
        docContent: state.docContent,
        diagramSource: state.diagramSource,
        diagramType: state.diagramType,
        deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
        deckTheme: state.deckTheme,
        label: `AI ${labelParts.join(" & ")} changes`,
        timestamp: Date.now(),
      };
      newUndoStack = [...state.undoStack, snapshot].slice(-20);
    }

    let newSheets = state.sheets;
    let newSheetVersion = state.sheetVersion;
    if (hasSheetOps) {
      newSheets = applyOperations(state.sheets, sheetOperations);
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

    const shouldOpen = hasSheetOps || hasDocOps || hasKuOps || hasTableOps || hasDiagramOps || hasDeckOps;

    // Diagram flat fields
    let newDiagramSource = state.diagramSource;
    let newDiagramType = state.diagramType;
    let newDiagramVersion = state.diagramVersion;

    // Deck flat fields
    let newDeckSlides = state.deckSlides;
    let newDeckTheme = state.deckTheme;
    let newDeckVersion = state.deckVersion;

    // Apply project-level KU and Table operations
    let newProjects = state.projects;
    let newCurrentEntityId = state.currentEntityId;
    let newCurrentEntityType = state.currentEntityType;
    let newOpenTabs = state.openTabs;
    const aiModifiedIds: string[] = [];

    if (state.currentProjectId && (hasKuOps || hasTableOps || hasDiagramOps || hasDeckOps)) {
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
            }
          }
        }

        // Apply Diagram operations
        if (hasDiagramOps) {
          project.diagrams = [...(project.diagrams || [])];
          for (const op of diagramOperations) {
            switch (op.type) {
              case "CREATE": {
                const newDiagram: ProjectDiagram = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  diagramType: op.diagramType || "mermaid",
                  source: op.source || "",
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.diagrams.push(newDiagram);
                // Auto-open the newly created diagram
                newCurrentEntityId = newDiagram.id;
                newCurrentEntityType = "diagram";
                newDiagramSource = newDiagram.source;
                newDiagramType = newDiagram.diagramType;
                newDiagramVersion = state.diagramVersion + 1;
                // Add to open tabs
                if (!newOpenTabs.some((t) => t.id === newDiagram.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newDiagram.id, type: "diagram" as const, title: newDiagram.title }];
                }
                break;
              }
              case "UPDATE": {
                const idx = (project.diagrams || []).findIndex((d) => d.id === op.diagramId);
                if (idx >= 0) {
                  project.diagrams[idx] = {
                    ...project.diagrams[idx],
                    source: op.source,
                    updatedAt: Date.now(),
                  };
                  if (state.currentEntityId === op.diagramId) {
                    newDiagramSource = op.source;
                    newDiagramVersion = state.diagramVersion + 1;
                  }
                  // Auto-open tab for updated diagram
                  if (!newOpenTabs.some((t) => t.id === op.diagramId)) {
                    const entity = project.diagrams[idx];
                    newOpenTabs = [...newOpenTabs, { id: entity.id, type: "diagram" as const, title: entity.title }];
                  }
                  aiModifiedIds.push(op.diagramId);
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
                const newDeck: ProjectDeck = {
                  id: nanoid(),
                  projectId: project.id,
                  title: op.title,
                  theme: op.theme || "light",
                  slides: op.slides || [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                project.decks.push(newDeck);
                newCurrentEntityId = newDeck.id;
                newCurrentEntityType = "deck";
                newDeckSlides = newDeck.slides;
                newDeckTheme = newDeck.theme;
                newDeckVersion = state.deckVersion + 1;
                if (!newOpenTabs.some((t) => t.id === newDeck.id)) {
                  newOpenTabs = [...newOpenTabs, { id: newDeck.id, type: "deck" as const, title: newDeck.title }];
                }
                // Auto-fetch background images for slides with imageQuery
                const slidesWithQuery = newDeck.slides.filter((s) => s.imageQuery && !s.backgroundImage);
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
                  project.decks[idx] = {
                    ...project.decks[idx],
                    slides: op.slides,
                    ...(op.theme ? { theme: op.theme } : {}),
                    updatedAt: Date.now(),
                  };
                  if (state.currentEntityId === op.deckId) {
                    newDeckSlides = op.slides;
                    if (op.theme) newDeckTheme = op.theme;
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
            }
          }
        }

        project.updatedAt = Date.now();
        newProjects[projIdx] = project;
      }
    }

    set({
      messages: [...state.messages, newMessage],
      isStreaming: false,
      streamingContent: "",
      sheets: newSheets,
      sheetVersion: newSheetVersion,
      docContent: newDocContent,
      docVersion: newDocVersion,
      diagramSource: newDiagramSource,
      diagramType: newDiagramType,
      diagramVersion: newDiagramVersion,
      deckSlides: newDeckSlides,
      deckTheme: newDeckTheme,
      deckVersion: newDeckVersion,
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

    // Success toasts for AI operations
    if (hasSheetOps) toast.success("Spreadsheet updated");
    else if (hasDocOps) toast.success("Document updated");
    if (hasKuOps) {
      for (const op of kuOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
      }
    }
    if (hasTableOps) {
      for (const op of tableOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
      }
    }
    if (hasDiagramOps) {
      for (const op of diagramOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
      }
    }
    if (hasDeckOps) {
      for (const op of deckOperations) {
        if (op.type === "CREATE") toast.success(`Created "${op.title}"`);
      }
    }

    // Auto-save (debounced for batching, immediate for legacy conversations)
    if (state.currentProjectId) {
      scheduleDebouncedSave();
    } else {
      setTimeout(() => get().saveCurrentConversation(), 100);
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

  clearSuggestions: () => set({ suggestions: [] }),

  clearAiModifiedEntity: (id: string) =>
    set((state) => ({
      aiModifiedEntityIds: state.aiModifiedEntityIds.filter((eid) => eid !== id),
    })),

  setReadingFiles: (files: string[]) => set({ readingFiles: files }),
  setAIPhase: (phase) => set({ aiPhase: phase }),

  // ── Legacy Conversation History ──

  saveCurrentConversation: () => {
    const state = get();
    if (state.messages.length === 0) return;

    const hasSheet = state.sheets.some((s) => s.celldata && s.celldata.length > 0);
    const hasDoc = !!state.docContent;

    const conversation: Conversation = {
      id: state.currentConversationId || nanoid(),
      title: generateTitle(state.messages),
      createdAt: state.conversations.find((c) => c.id === state.currentConversationId)?.createdAt || Date.now(),
      updatedAt: Date.now(),
      messages: state.messages,
      hasSheet,
      hasDoc,
      sheets: hasSheet ? state.sheets : undefined,
      docContent: hasDoc ? state.docContent : undefined,
      memory: Object.keys(state.projectMemory).length > 0 ? state.projectMemory : undefined,
    };

    const existing = state.conversations.filter((c) => c.id !== conversation.id);
    const updated = [conversation, ...existing].slice(0, 50);

    set({ conversations: updated, currentConversationId: conversation.id });
    saveConversationsToStorage(updated);
  },

  loadConversation: (id: string) => {
    const state = get();
    if (state.messages.length > 0 && state.currentConversationId) {
      state.saveCurrentConversation();
    }

    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return;

    set({
      messages: conv.messages,
      currentConversationId: conv.id,
      currentProjectId: null,
      currentEntityId: null,
      currentEntityType: null,
      sheets: conv.sheets || createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: conv.docContent || "",
      docVersion: state.docVersion + 1,
      diagramSource: "",
      diagramType: "mermaid",
      diagramVersion: state.diagramVersion + 1,
      deckSlides: [],
      deckTheme: "light" as const,
      deckVersion: state.deckVersion + 1,
      workspaceOpen: conv.hasSheet || conv.hasDoc,
      activeTab: conv.hasDoc ? "doc" : "sheet",
      isStreaming: false,
      streamingContent: "",
      pendingAttachments: [],
      projectMemory: conv.memory || {},
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
    });
  },

  deleteConversation: (id: string) => {
    const state = get();
    const updated = state.conversations.filter((c) => c.id !== id);
    const isCurrent = state.currentConversationId === id;

    set({
      conversations: updated,
      ...(isCurrent
        ? {
            currentConversationId: null,
            messages: [],
            sheets: createEmptySheet(),
            sheetVersion: state.sheetVersion + 1,
            docContent: "",
            docVersion: state.docVersion + 1,
            diagramSource: "",
            diagramType: "mermaid",
            diagramVersion: state.diagramVersion + 1,
            deckSlides: [],
            deckTheme: "light" as const,
            deckVersion: state.deckVersion + 1,
            workspaceOpen: false,
            isStreaming: false,
            streamingContent: "",
          }
        : {}),
    });
    saveConversationsToStorage(updated);
  },

  renameConversation: (id: string, title: string) => {
    const state = get();
    const updated = state.conversations.map((c) =>
      c.id === id ? { ...c, title } : c
    );
    set({ conversations: updated });
    saveConversationsToStorage(updated);
  },

  newConversation: () => {
    const state = get();
    if (state.messages.length > 0) {
      if (state.currentProjectId) {
        state.saveCurrentEntity();
      } else {
        state.saveCurrentConversation();
      }
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
      diagramSource: "",
      diagramType: "mermaid",
      diagramVersion: state.diagramVersion + 1,
      deckSlides: [],
      deckTheme: "light" as const,
      deckVersion: state.deckVersion + 1,
      activeTab: "sheet",
      workspaceOpen: false,
      pendingAttachments: [],
      undoStack: [],
      canUndo: false,
      redoStack: [],
      canRedo: false,
    });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

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
      } else if (state.currentConversationId) {
        get().renameConversation(state.currentConversationId, title);
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
      diagramSource: state.diagramSource,
      diagramType: state.diagramType,
      deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
      deckTheme: state.deckTheme,
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
      diagramSource: snapshot.diagramSource,
      diagramType: snapshot.diagramType,
      diagramVersion: state.diagramVersion + 1,
      deckSlides: snapshot.deckSlides,
      deckTheme: snapshot.deckTheme,
      deckVersion: state.deckVersion + 1,
      undoStack: newStack,
      canUndo: newStack.length > 0,
      redoStack: [...state.redoStack, redoSnapshot],
      canRedo: true,
    });

    toast(`Undone: ${snapshot.label}`);

    setTimeout(() => {
      const s = get();
      if (s.currentProjectId) {
        s.saveCurrentEntity();
      } else {
        s.saveCurrentConversation();
      }
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
      diagramSource: state.diagramSource,
      diagramType: state.diagramType,
      deckSlides: JSON.parse(JSON.stringify(state.deckSlides)),
      deckTheme: state.deckTheme,
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
      diagramSource: snapshot.diagramSource,
      diagramType: snapshot.diagramType,
      diagramVersion: state.diagramVersion + 1,
      deckSlides: snapshot.deckSlides,
      deckTheme: snapshot.deckTheme,
      deckVersion: state.deckVersion + 1,
      undoStack: [...state.undoStack, undoSnapshot],
      canUndo: true,
      redoStack: newRedoStack,
      canRedo: newRedoStack.length > 0,
    });

    setTimeout(() => {
      const s = get();
      if (s.currentProjectId) {
        s.saveCurrentEntity();
      } else {
        s.saveCurrentConversation();
      }
    }, 100);
  },

  resetAll: () => {
    const state = get();
    if (state.messages.length > 0) {
      if (state.currentProjectId) {
        state.saveCurrentEntity();
      } else {
        state.saveCurrentConversation();
      }
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
      diagrams: [],
      decks: [],
      messages: [],
      memory: {},
      createdAt: now,
      updatedAt: now,
    };

    const state = get();
    // Save current work before switching
    if (state.messages.length > 0) {
      if (state.currentProjectId) {
        state.saveCurrentEntity();
      } else {
        state.saveCurrentConversation();
      }
    }

    const updated = [project, ...state.projects];
    set({
      projects: updated,
      currentProjectId: project.id,
      currentConversationId: null,
      currentEntityId: null,
      currentEntityType: null,
      messages: [],
      sheets: createEmptySheet(),
      sheetVersion: state.sheetVersion + 1,
      docContent: "",
      docVersion: state.docVersion + 1,
      diagramSource: "",
      diagramType: "mermaid",
      diagramVersion: state.diagramVersion + 1,
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
            diagramSource: "",
            diagramType: "mermaid",
            diagramVersion: state.diagramVersion + 1,
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
    if (state.messages.length > 0) {
      if (state.currentProjectId) {
        state.saveCurrentEntity();
      } else {
        state.saveCurrentConversation();
      }
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
      diagramSource: "",
      diagramType: "mermaid",
      diagramVersion: state.diagramVersion + 1,
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

    // Auto-update project details if missing and project has messages
    const needsDetails =
      !project.description ||
      project.description === "A new workspace for your documents, spreadsheets, and AI-assisted content." ||
      !project.projectType;
    if (needsDetails && project.messages.length >= 2) {
      setTimeout(() => get().autoGenerateTitle(), 300);
    }
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
  // ── Diagram CRUD ──
  // ══════════════════════════════════

  createDiagram: (projectId: string, title: string, diagramType: "mermaid" | "chart" | "excalidraw" | "reactflow" = "mermaid", source: string = "") => {
    // Save current entity first, then re-read state to avoid stale projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }

    const now = Date.now();
    const newDiagram: ProjectDiagram = {
      id: nanoid(),
      projectId,
      title,
      diagramType,
      source: source || (diagramType === "mermaid" ? "graph TD\n    A[Start] --> B[End]" : '{"chartType":"bar","data":[],"xKey":"name","yKeys":["value"],"colors":["#6B8FA3"]}'),
      createdAt: now,
      updatedAt: now,
    };

    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, diagrams: [...(p.diagrams || []), newDiagram], updatedAt: now };
      }
      return p;
    });

    set({ projects: newProjects });
    saveProjectsToStorage(newProjects);
    get().openDiagram(newDiagram.id);
    return newDiagram;
  },

  deleteDiagram: (projectId: string, diagramId: string) => {
    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, diagrams: (p.diagrams || []).filter((d) => d.id !== diagramId), updatedAt: Date.now() };
      }
      return p;
    });

    // Close tab if open
    const newTabs = state.openTabs.filter((t) => t.id !== diagramId);
    const isCurrent = state.currentEntityId === diagramId;
    set({
      projects: newProjects,
      openTabs: newTabs,
      ...(isCurrent
        ? {
            currentEntityId: null,
            currentEntityType: null,
            diagramSource: "",
            diagramVersion: state.diagramVersion + 1,
            workspaceOpen: false,
          }
        : {}),
    });
    saveProjectsToStorage(newProjects);

    // Background sync: delete diagram on server
    updateProjectOnServer(projectId, {
      deletedDiagramIds: [diagramId],
    }).catch(() => {});
  },

  renameDiagram: (projectId: string, diagramId: string, title: string) => {
    const state = get();
    const newProjects = state.projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          diagrams: (p.diagrams || []).map((d) => d.id === diagramId ? { ...d, title, updatedAt: Date.now() } : d),
          updatedAt: Date.now(),
        };
      }
      return p;
    });

    const newTabs = state.openTabs.map((t) => t.id === diagramId ? { ...t, title } : t);
    set({ projects: newProjects, openTabs: newTabs });
    saveProjectsToStorage(newProjects);

    // Background sync to Neon
    updateProjectOnServer(projectId, {
      diagrams: [{ id: diagramId, title }],
    }).catch(() => {});
  },

  openDiagram: (diagramId: string) => {
    // Save current entity first, then re-read state for fresh projects
    if (get().currentEntityId) {
      get().saveCurrentEntity();
    }
    const state = get();

    const found = findDiagram(state.projects, diagramId);
    if (!found) return;

    const newTabs = state.openTabs.some((t) => t.id === diagramId)
      ? state.openTabs
      : [...state.openTabs, { id: diagramId, type: "diagram" as const, title: found.diagram.title }];

    set({
      currentEntityId: found.diagram.id,
      currentEntityType: "diagram",
      diagramSource: found.diagram.source,
      diagramType: found.diagram.diagramType,
      diagramVersion: state.diagramVersion + 1,
      workspaceOpen: true,
      openTabs: newTabs,
    });
  },

  updateDiagramSource: (source: string) => {
    set({ diagramSource: source });
    // Debounced auto-save (800ms)
    if (typeof window !== "undefined") {
      if ((window as any).__diagramSaveTimer) clearTimeout((window as any).__diagramSaveTimer);
      (window as any).__diagramSaveTimer = setTimeout(() => {
        get().saveCurrentEntity();
      }, 800);
    }
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
      slides: slides || [{ id: nanoid(), layout: "title", title, subtitle: "" }],
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
    return newDeck;
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
      deckVersion: state.deckVersion + 1,
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
    } else if (nextTab.type === "diagram") {
      const found = findDiagram(state.projects, nextTab.id);
      if (found) {
        updates.diagramSource = found.diagram.source;
        updates.diagramType = found.diagram.diagramType;
        updates.diagramVersion = state.diagramVersion + 1;
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
    set({ isSaving: true });

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
    } else if (state.currentEntityId && state.currentEntityType === "diagram") {
      project.diagrams = (project.diagrams || []).map((d) =>
        d.id === state.currentEntityId
          ? { ...d, source: state.diagramSource, diagramType: state.diagramType, updatedAt: Date.now() }
          : d
      );
    } else if (state.currentEntityId && state.currentEntityType === "deck") {
      project.decks = (project.decks || []).map((d) =>
        d.id === state.currentEntityId
          ? { ...d, slides: state.deckSlides, theme: state.deckTheme, updatedAt: Date.now() }
          : d
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
      diagrams: (project.diagrams || []).map((d) => ({
        id: d.id,
        title: d.title,
        diagramType: d.diagramType,
        source: d.source,
      })),
      decks: (project.decks || []).map((d) => ({
        id: d.id,
        title: d.title,
        theme: d.theme,
        slides: d.slides,
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
        }
      })
      .catch(() => {
        toast.error("Failed to save to server — changes are saved locally");
      })
      .finally(() => set({ isSaving: false, lastSavedAt: Date.now() }));
  },

  loadProjects: async () => {
    // Immediately hydrate from localStorage so the UI never flashes empty
    const cached = loadProjectsFromStorage();
    if (cached.length > 0 && get().projects.length === 0) {
      set({ projects: cached });
    }

    // Then fetch latest from server and update
    try {
      const serverProjects = await fetchProjects();
      if (serverProjects.length > 0) {
        set({ projects: serverProjects });
        saveProjectsToStorage(serverProjects); // Cache locally
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
        diagrams: [],
        decks: [],
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
}));
