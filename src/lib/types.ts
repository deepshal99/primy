export interface CellValue {
  v?: string | number;
  m?: string | number;
  f?: string;
  ct?: { fa?: string; t?: string };
  bl?: number;
  it?: number;
  fc?: string;
  bg?: string;
  fs?: number;
}

export interface CellData {
  r: number;
  c: number;
  v: CellValue;
}

export interface SheetConfig {
  columnlen?: Record<string, number>;
  rowlen?: Record<string, number>;
}

export interface DataVerification {
  type: string;       // "dropdown" | "checkbox" | "number" etc.
  type2: string;      // "" for single-select, "true" for multi-select
  value1: string;     // comma-separated options for dropdown
  value2: string;
  remote: boolean;
  prohibitInput: boolean;
  hintShow: boolean;
  hintValue: string;
}

export interface SheetData {
  name: string;
  order: number;
  status: number;
  celldata: CellData[];
  config?: SheetConfig;
  row?: number;
  column?: number;
  dataVerification?: Record<string, DataVerification>;
}

export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export type SheetOperation =
  | {
      type: "SET_SHEET_DATA";
      sheetIndex: number;
      data: {
        name?: string;
        celldata: CellData[];
        config?: SheetConfig;
      };
    }
  | {
      type: "ADD_SHEET";
      name: string;
      celldata: CellData[];
    }
  | {
      type: "UPDATE_CELLS";
      sheetIndex: number;
      cells: CellData[];
    }
  | {
      type: "FORMAT_CELLS";
      sheetIndex: number;
      range: CellRange;
      format: Partial<CellValue>;
    }
  | {
      type: "SET_COLUMN_WIDTHS";
      sheetIndex: number;
      widths: Record<string, number>;
    }
  | {
      type: "DELETE_ROWS";
      sheetIndex: number;
      rows: number[];
    }
  | {
      type: "DELETE_COLUMNS";
      sheetIndex: number;
      columns: number[];
    }
  | {
      type: "SORT";
      sheetIndex: number;
      column: number;
      ascending: boolean;
    }
  | {
      type: "SET_DROPDOWN";
      sheetIndex: number;
      column: number;
      rowStart: number;
      rowEnd: number;
      options: string[];
    };

// ═══ Document Operations ═══

export type DocOperation =
  | {
      type: "SET_CONTENT";
      markdown: string;
    }
  | {
      type: "APPEND_CONTENT";
      markdown: string;
    }
  | {
      type: "REPLACE_SECTION";
      headingText: string;
      markdown: string;
    };

export type WorkspaceTab = "sheet" | "doc";

// ═══ File Attachments ═══

export interface FileAttachment {
  id: string;
  name: string;
  type: "text" | "image" | "pdf" | "docx";
  mimeType: string;
  size: number;
  previewUrl?: string;
  extractedText?: string;
  base64?: string;
  isExtracting?: boolean;
}

// ═══ Messages ═══

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  interrupted?: boolean;
}

// ═══ Conversation History (legacy — kept for migration) ═══

export interface ProjectMemory {
  tone?: string;           // "casual", "formal", "technical", etc.
  audience?: string;       // "developers", "executives", "general public", etc.
  goals?: string;          // freeform project goal description
  customInstructions?: string; // user-defined AI instructions for this project
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  hasSheet: boolean;
  hasDoc: boolean;
  sheets?: SheetData[];
  docContent?: string;
  memory?: ProjectMemory;
}

// ═══ Project System ═══

export interface KnowledgeUnit {
  id: string;
  projectId: string;
  title: string;
  content: string;          // Tiptap HTML or markdown
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectTable {
  id: string;
  projectId: string;
  title: string;
  sheets: SheetData[];      // Fortune Sheet format
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDiagram {
  id: string;
  projectId: string;
  title: string;
  diagramType: "mermaid" | "chart";
  source: string;              // mermaid code or recharts JSON
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  projectType?: string;       // "Marketing", "Content", "Research", "Engineering", "Design", "Other"
  knowledgeUnits: KnowledgeUnit[];
  tables: ProjectTable[];
  diagrams: ProjectDiagram[];
  messages: Message[];       // Chat history scoped to project
  memory: ProjectMemory;
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type EntityType = "ku" | "table" | "diagram";

// ═══ KU Operations (AI fence: ```kuops) ═══

export type KuOperation =
  | {
      type: "CREATE";
      title: string;
      content: string;
    }
  | {
      type: "UPDATE";
      kuId: string;
      content: string;
    }
  | {
      type: "APPEND";
      kuId: string;
      content: string;
    }
  | {
      type: "RENAME";
      kuId: string;
      title: string;
    };

// ═══ Table Operations (AI fence: ```tableops) ═══

export type TableOperation =
  | {
      type: "CREATE";
      title: string;
      celldata: CellData[];
      config?: SheetConfig;
    }
  | {
      type: "UPDATE_CELLS";
      tableId: string;
      sheetIndex: number;
      cells: CellData[];
    }
  | {
      type: "SET_TABLE_DATA";
      tableId: string;
      sheetIndex: number;
      data: {
        name?: string;
        celldata: CellData[];
        config?: SheetConfig;
      };
    };

// ═══ Diagram Operations (AI fence: ```diagramops) ═══

export type DiagramOperation =
  | {
      type: "CREATE";
      title: string;
      diagramType: "mermaid" | "chart";
      source: string;
    }
  | {
      type: "UPDATE";
      diagramId: string;
      source: string;
    };

// ═══ Undo History ═══

export interface UndoSnapshot {
  sheets: SheetData[];
  docContent: string;
  label: string;
  timestamp: number;
}

// ═══ App State ═══

export interface AppState {
  // Active view (flat fields synced to current project entity)
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  sheets: SheetData[];
  sheetVersion: number;
  docContent: string;
  docVersion: number;
  diagramSource: string;
  diagramType: "mermaid" | "chart";
  diagramVersion: number;
  activeTab: WorkspaceTab;
  workspaceOpen: boolean;
  pendingAttachments: FileAttachment[];
  suggestions: string[];
  projectMemory: ProjectMemory;
  readingFiles: string[];

  // Undo/Redo history
  undoStack: UndoSnapshot[];
  canUndo: boolean;
  redoStack: UndoSnapshot[];
  canRedo: boolean;
  isSaving: boolean;
  lastSavedAt: number;

  // Legacy conversation history (kept for migration)
  conversations: Conversation[];
  currentConversationId: string | null;
  sidebarOpen: boolean;

  // Project system
  projects: Project[];
  currentProjectId: string | null;
  currentEntityId: string | null;
  currentEntityType: EntityType | null;

  // Open file tabs
  openTabs: { id: string; type: EntityType; title: string }[];

  // Chat/streaming actions
  addUserMessage: (content: string, attachments?: FileAttachment[]) => void;
  startStreaming: () => void;
  appendStreamChunk: (chunk: string) => void;
  finishStreaming: (
    fullContent: string,
    sheetOperations?: SheetOperation[],
    docOperations?: DocOperation[],
    kuOperations?: KuOperation[],
    tableOperations?: TableOperation[],
    diagramOperations?: DiagramOperation[],
    suggestions?: string[]
  ) => void;
  abortStreaming: () => void;
  clearSuggestions: () => void;
  setReadingFiles: (files: string[]) => void;
  applySheetOperations: (operations: SheetOperation[]) => void;
  applyDocOperations: (operations: DocOperation[]) => void;
  updateSheetData: (data: SheetData[]) => void;
  updateDocContent: (content: string) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  addPendingAttachment: (attachment: FileAttachment) => void;
  removePendingAttachment: (id: string) => void;
  updatePendingAttachment: (id: string, updates: Partial<FileAttachment>) => void;
  clearPendingAttachments: () => void;
  updateProjectMemory: (memory: Partial<ProjectMemory>) => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;

  // Legacy conversation actions (kept for backward compat)
  saveCurrentConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  newConversation: () => void;
  toggleSidebar: () => void;
  loadConversations: () => void;
  autoGenerateTitle: () => void;

  // Project CRUD
  createProject: (title: string) => Project;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  updateProject: (id: string, updates: { title?: string; description?: string; projectType?: string }) => void;
  switchProject: (id: string) => void;

  // Knowledge Unit CRUD
  createKnowledgeUnit: (projectId: string, title: string, content?: string) => KnowledgeUnit;
  duplicateKnowledgeUnit: (projectId: string, kuId: string) => KnowledgeUnit | null;
  deleteKnowledgeUnit: (projectId: string, kuId: string) => void;
  renameKnowledgeUnit: (projectId: string, kuId: string, title: string) => void;
  openKnowledgeUnit: (kuId: string) => void;

  // Table CRUD
  createTable: (projectId: string, title: string, sheets?: SheetData[]) => ProjectTable;
  duplicateTable: (projectId: string, tableId: string) => ProjectTable | null;
  deleteTable: (projectId: string, tableId: string) => void;
  renameTable: (projectId: string, tableId: string, title: string) => void;
  openTable: (tableId: string) => void;

  // Diagram CRUD
  createDiagram: (projectId: string, title: string, diagramType?: "mermaid" | "chart", source?: string) => ProjectDiagram;
  deleteDiagram: (projectId: string, diagramId: string) => void;
  renameDiagram: (projectId: string, diagramId: string, title: string) => void;
  openDiagram: (diagramId: string) => void;
  updateDiagramSource: (source: string) => void;

  // Tab management
  closeTab: (id: string) => void;

  // Entity sync
  saveCurrentEntity: () => void;
  loadProjects: () => void | Promise<void>;
  migrateConversations: () => void;
}
