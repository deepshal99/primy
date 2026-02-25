import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  AppState,
  SheetOperation,
  DocOperation,
  KuOperation,
  TableOperation,
  FileAttachment,
  Conversation,
  UndoSnapshot,
  Project,
  KnowledgeUnit,
  ProjectTable,
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
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      toast.error("Storage full — some changes may not be saved");
    }
  }
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

export const useAppStore = create<AppState>((set, get) => ({
  // Active view (flat fields synced to current entity)
  messages: [],
  isStreaming: false,
  streamingContent: "",
  sheets: createEmptySheet(),
  sheetVersion: 0,
  docContent: "",
  docVersion: 0,
  activeTab: "sheet",
  workspaceOpen: false,
  pendingAttachments: [],
  suggestions: [],
  projectMemory: {},
  readingFiles: [],
  undoStack: [],
  canUndo: false,
  redoStack: [],
  canRedo: false,
  isSaving: false,
  lastSavedAt: 0,

  // Legacy conversations
  conversations: [],
  currentConversationId: null,
  sidebarOpen: true,

  // Project system
  projects: [],
  currentProjectId: null,
  currentEntityId: null,
  currentEntityType: null,
  openTabs: [],

  // ── Chat Actions ──

  addUserMessage: (content: string, attachments?: FileAttachment[]) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nanoid(),
          role: "user",
          content,
          timestamp: Date.now(),
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        },
      ],
    })),

  startStreaming: () =>
    set({ isStreaming: true, streamingContent: "" }),

  abortStreaming: () =>
    set({ isStreaming: false, streamingContent: "", readingFiles: [] }),

  appendStreamChunk: (chunk: string) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk,
    })),

  finishStreaming: (
    fullContent: string,
    sheetOperations?: SheetOperation[],
    docOperations?: DocOperation[],
    kuOperations?: KuOperation[],
    tableOperations?: TableOperation[],
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

    // Snapshot current state before applying AI operations (for undo)
    // New AI operations clear the redo stack (standard editor behavior)
    let newUndoStack = state.undoStack;
    if (hasSheetOps || hasDocOps) {
      const snapshot: UndoSnapshot = {
        sheets: JSON.parse(JSON.stringify(state.sheets)),
        docContent: state.docContent,
        label: hasSheetOps && hasDocOps ? "AI sheet & doc changes" : hasSheetOps ? "AI sheet changes" : "AI doc changes",
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

    const shouldOpen = hasSheetOps || hasDocOps || hasKuOps || hasTableOps;

    // Apply project-level KU and Table operations
    let newProjects = state.projects;
    let newCurrentEntityId = state.currentEntityId;
    let newCurrentEntityType = state.currentEntityType;
    let newOpenTabs = state.openTabs;

    if (state.currentProjectId && (hasKuOps || hasTableOps)) {
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
      activeTab: newActiveTab,
      workspaceOpen: state.workspaceOpen || !!shouldOpen,
      suggestions: suggestions || [],
      readingFiles: [],
      undoStack: newUndoStack,
      canUndo: newUndoStack.length > 0,
      // Clear redo stack when new AI operations are applied
      redoStack: (hasSheetOps || hasDocOps) ? [] : state.redoStack,
      canRedo: (hasSheetOps || hasDocOps) ? false : state.canRedo,
      projects: newProjects,
      currentEntityId: newCurrentEntityId,
      currentEntityType: newCurrentEntityType,
      openTabs: newOpenTabs,
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

    // Auto-save
    setTimeout(() => {
      const s = get();
      if (s.currentProjectId) {
        s.saveCurrentEntity();
      } else {
        s.saveCurrentConversation();
      }
    }, 100);

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
  },

  updateDocContent: (content: string) => set({ docContent: content }),

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

  setReadingFiles: (files: string[]) => set({ readingFiles: files }),

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

    // Push current state onto redo stack before restoring
    const redoSnapshot: UndoSnapshot = {
      sheets: state.sheets,
      docContent: state.docContent,
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
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

    // Push current state back onto undo stack
    const undoSnapshot: UndoSnapshot = {
      sheets: state.sheets,
      docContent: state.docContent,
      label: snapshot.label,
      timestamp: Date.now(),
    };

    set({
      sheets: snapshot.sheets,
      sheetVersion: state.sheetVersion + 1,
      docContent: snapshot.docContent,
      docVersion: state.docVersion + 1,
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

    const state = get();
    // Save current entity first
    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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

    return ku;
  },

  duplicateKnowledgeUnit: (projectId: string, kuId: string) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
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

    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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
    const state = get();
    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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

    const state = get();
    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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

    return table;
  },

  duplicateTable: (projectId: string, tableId: string) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
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

    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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
    const state = get();
    if (state.currentEntityId) {
      state.saveCurrentEntity();
    }

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
  // ── Tab Management ──
  // ══════════════════════════════════

  closeTab: (id: string) => {
    const state = get();
    const newTabs = state.openTabs.filter((t) => t.id !== id);
    const isCurrent = state.currentEntityId === id;

    if (isCurrent) {
      // Switch to the next tab, or previous, or go to project home
      const idx = state.openTabs.findIndex((t) => t.id === id);
      const nextTab = newTabs[idx] || newTabs[idx - 1];

      if (nextTab) {
        // Save current entity first, then clear currentEntityId so the inner open doesn't double-save
        state.saveCurrentEntity();
        set({ openTabs: newTabs, currentEntityId: null, currentEntityType: null });
        if (nextTab.type === "ku") {
          get().openKnowledgeUnit(nextTab.id);
        } else {
          get().openTable(nextTab.id);
        }
      } else {
        // No more tabs — go to project home
        state.saveCurrentEntity();
        set({
          openTabs: newTabs,
          currentEntityId: null,
          currentEntityType: null,
          workspaceOpen: false,
        });
      }
    } else {
      set({ openTabs: newTabs });
    }
  },

  // ══════════════════════════════════
  // ── Entity Sync ──
  // ══════════════════════════════════

  saveCurrentEntity: () => {
    const state = get();
    if (!state.currentProjectId) return;
    set({ isSaving: true });

    const projIdx = state.projects.findIndex((p) => p.id === state.currentProjectId);
    if (projIdx < 0) return;

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
    }

    project.updatedAt = Date.now();
    updated[projIdx] = project;

    set({ projects: updated });
    saveProjectsToStorage(updated);

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
      newMessages: project.messages.slice(-2).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        attachments: m.attachments,
      })),
    };
    updateProjectOnServer(project.id, syncPayload)
      .catch(() => {})
      .finally(() => set({ isSaving: false, lastSavedAt: Date.now() }));
  },

  loadProjects: async () => {
    // Try server first (Neon), fall back to localStorage
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
    const projects = loadProjectsFromStorage();
    set({ projects });
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
