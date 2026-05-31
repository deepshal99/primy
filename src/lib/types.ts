export interface CellValue {
  v?: string | number | null;
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
  v: CellValue | null;
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
    }
  | {
      type: "INSERT_IMAGE";
      sheetIndex: number;
      url: string;
      row: number;
      column: number;
      width?: number;
      height?: number;
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

/** @deprecated Legacy type — only "sheet" | "doc" but activeTab is now driven by entity type. Will be removed in a future release. */
export type WorkspaceTab = "sheet" | "doc";

// ═══ File Attachments ═══

export interface FileAttachment {
  id: string;
  name: string;
  type: "text" | "image" | "pdf" | "docx" | "xlsx" | "zip";
  mimeType: string;
  size: number;
  previewUrl?: string;
  extractedText?: string;
  base64?: string;
  isExtracting?: boolean;
}

// ═══ Messages ═══

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  interrupted?: boolean;
  groundingSources?: GroundingSource[];
  mentionedEntities?: { id: string; type: EntityType; title: string }[];
}

// ═══ Conversation History (legacy — kept for migration) ═══

export interface ProjectMemory {
  tone?: string;           // "casual", "formal", "technical", etc.
  audience?: string;       // "developers", "executives", "general public", etc.
  goals?: string;          // freeform project goal description
  customInstructions?: string; // user-defined AI instructions for this project
}

/** @deprecated Legacy conversation model — replaced by the Project system. Kept only for migration via `migrateConversations()`. Will be removed in a future release. */
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

/** In-project grouping for the Workspaces tree + board (one level deep). */
export interface Folder {
  id: string;
  projectId: string;
  name: string;
  color: string;
  position: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface KnowledgeUnit {
  id: string;
  projectId: string;
  folderId?: string | null;
  title: string;
  content: string;          // Tiptap HTML or markdown
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  embedding?: number[];
}

export interface ProjectTable {
  id: string;
  projectId: string;
  folderId?: string | null;
  title: string;
  sheets: SheetData[];      // Fortune Sheet format
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  embedding?: number[];
}

/** Editable region declared by the AI inside an HTML page */
export interface PageEditableField {
  id: string;
  selector: string;
  type: "text" | "heading" | "image" | "list";
  currentValue: string;
}

/**
 * HTML page — a visual, designed, interactive document. AI-generated full
 * markup that stays fully editable. Often a richer rendering of a Document.
 */
export interface ProjectPage {
  id: string;
  projectId: string;
  folderId?: string | null;
  title: string;
  html: string;                       // full standalone HTML/CSS
  editableFields?: PageEditableField[];
  sourceKuId?: string | null;         // the doc this page visualizes, if any
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  embedding?: number[];
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  projectType?: string;       // "Marketing", "Content", "Research", "Engineering", "Design", "Other"
  folders?: Folder[];
  knowledgeUnits: KnowledgeUnit[];
  tables: ProjectTable[];
  decks: ProjectDeck[];
  pages: ProjectPage[];
  messages: Message[];       // Chat history scoped to project
  memory: ProjectMemory;
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  hasMoreMessages?: boolean;  // True when older messages exist but weren't loaded
  counts?: ProjectEntityCounts; // Lightweight counts from list endpoint
}

/** Lightweight entity counts returned by the project list endpoint */
export interface ProjectEntityCounts {
  knowledgeUnits: number;
  tables: number;
  decks: number;
  pages: number;
}

/** Lightweight project metadata returned by GET /api/projects (list) */
export interface ProjectListItem {
  id: string;
  title: string;
  description?: string;
  projectType?: string;
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  counts: ProjectEntityCounts;
}

export type EntityType = "ku" | "table" | "deck" | "page";

// ═══ Page Operations (AI fence: ```pageops) ═══

export type PageOperation =
  | {
      type: "CREATE";
      title: string;
      html: string;
      editableFields?: PageEditableField[];
      sourceKuId?: string;
    }
  | {
      type: "UPDATE";
      pageId: string;
      html: string;
      editableFields?: PageEditableField[];
    }
  | { type: "RENAME"; pageId: string; title: string }
  | { type: "DELETE"; pageId: string };

export type AIPhase = 'idle' | 'thinking' | 'streaming' | 'updating' | 'done';

// ═══ Deck / Presentation ═══

// Legacy — kept for backward compat with existing structured slides
export type DeckTheme = string;

export type DeckPhase = "idle" | "generating" | "viewing";

/** Full custom style config — AI generates this for every deck */
export interface ThemeConfig {
  label: string;
  bg: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentAlt: string;
  accentLight: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  headingCase: "none" | "uppercase";
  cardBg: string;
  cardBorder: string;
  divider: string;
  bulletStyle: "disc" | "dash" | "number" | "arrow" | "check" | "ring" | "bar";
  decorStyle: "geometric" | "minimal" | "gradient";
  googleFonts: string[];
}

export interface DeckOutlineItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  layout?: string;
  visual?: string;
  imageQuery?: string;
}

export interface DeckSlide {
  id: string;
  layout: "title" | "bullets" | "titleContent" | "twoColumn" | "section" | "quote" | "blank" | "stats" | "imageFeature" | "statement" | "metrics" | "featureGrid" | "logoGrid" | "html";
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  stats?: { value: string; label: string }[];
  notes?: string;
  // Image support
  backgroundImage?: string;       // Unsplash URL for slide background
  backgroundOverlay?: string;     // CSS gradient overlay (default: dark gradient)
  contentImage?: string;          // Image URL for inline content
  imageQuery?: string;            // AI-suggested Unsplash search term
  // Legacy HTML (deprecated — kept for backward compat)
  html?: string;
  htmlPrompt?: string;
  generatedBy?: "gemini" | "kimi";
}

/** Editable region declared by the AI inside an HTML slide */
export interface SlideEditableField {
  id: string;
  selector: string;
  type: "text" | "heading" | "image" | "list";
  currentValue: string;
}

/** New HTML/CSS slide — AI generates the full markup */
export interface HtmlDeckSlide {
  id: string;
  html: string;
  editableFields: SlideEditableField[];
  notes?: string;
  imageQuery?: string;
}

/** Check if a slide uses the new HTML format */
export function isHtmlSlide(slide: DeckSlide | HtmlDeckSlide): slide is HtmlDeckSlide {
  return 'html' in slide && !('layout' in slide);
}

export interface ProjectDeck {
  id: string;
  projectId: string;
  folderId?: string | null;
  title: string;
  theme: DeckTheme;
  style?: ThemeConfig | null;
  slides: (DeckSlide | HtmlDeckSlide)[];
  shareToken?: string | null;
  createdAt: number;
  updatedAt: number;
  embedding?: number[];
}

export type DeckOperation =
  | {
      type: "CREATE";
      title: string;
      theme?: DeckTheme;
      style?: ThemeConfig;
      slides: (DeckSlide | HtmlDeckSlide)[];
    }
  | {
      type: "UPDATE";
      deckId: string;
      slides: (DeckSlide | HtmlDeckSlide)[];
      theme?: DeckTheme;
      style?: ThemeConfig;
    }
  | { type: "DELETE"; deckId: string }
  | { type: "RENAME"; deckId: string; title: string };

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
    }
  | { type: "DELETE"; kuId: string };

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
    }
  | { type: "DELETE"; tableId: string };

// ═══ Undo History ═══

export interface UndoSnapshot {
  entityType: "ku" | "table" | "deck" | "page" | "mixed";
  sheets: SheetData[];
  docContent: string;
  deckSlides: (DeckSlide | HtmlDeckSlide)[];
  deckTheme: DeckTheme;
  pageHtml: string;
  pageEditableFields: PageEditableField[];
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
  deckSlides: (DeckSlide | HtmlDeckSlide)[];
  deckTheme: DeckTheme;
  deckVersion: number;
  deckPhase: DeckPhase;
  deckStyle: ThemeConfig | null;
  pageHtml: string;
  pageEditableFields: PageEditableField[];
  pageVersion: number;
  activeTab: WorkspaceTab;
  workspaceOpen: boolean;
  pendingAttachments: FileAttachment[];
  pendingSheetImages: { sheetIndex: number; url: string; row: number; column: number; width?: number; height?: number }[];
  suggestions: string[];
  projectMemory: ProjectMemory;
  readingFiles: string[];
  aiPhase: AIPhase;

  // Undo/Redo history
  undoStack: UndoSnapshot[];
  canUndo: boolean;
  redoStack: UndoSnapshot[];
  canRedo: boolean;
  isSaving: boolean;
  lastSavedAt: number;
  saveError: string | null;

  // Legacy conversation history (kept for migration — TODO: Remove in next release)
  conversations: Conversation[];
  currentConversationId: string | null;

  // Project system
  projects: Project[];
  currentProjectId: string | null;
  currentEntityId: string | null;
  currentEntityType: EntityType | null;
  projectsFullyLoaded: Record<string, boolean>; // Track which projects have been fully fetched
  isLoadingProject: boolean; // True while fetching full project data

  // Open file tabs
  openTabs: { id: string; type: EntityType; title: string }[];

  // AI-modified entity highlights
  aiModifiedEntityIds: string[];
  clearAiModifiedEntity: (id: string) => void;

  // Chat/streaming actions
  addUserMessage: (content: string, attachments?: FileAttachment[], mentionedEntities?: { id: string; type: EntityType; title: string }[]) => void;
  startStreaming: () => void;
  appendStreamChunk: (chunk: string) => void;
  finishStreaming: (
    fullContent: string,
    sheetOperations?: SheetOperation[],
    docOperations?: DocOperation[],
    kuOperations?: KuOperation[],
    tableOperations?: TableOperation[],
    deckOperations?: DeckOperation[],
    pageOperations?: PageOperation[],
    suggestions?: string[]
  ) => void;
  abortStreaming: () => void;
  clearSuggestions: () => void;
  setReadingFiles: (files: string[]) => void;
  setAIPhase: (phase: AIPhase) => void;
  applySheetOperations: (operations: SheetOperation[]) => void;
  applyDocOperations: (operations: DocOperation[]) => void;
  updateSheetData: (data: SheetData[]) => void;
  updateDocContent: (content: string) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  addPendingAttachment: (attachment: FileAttachment) => void;
  removePendingAttachment: (id: string) => void;
  updatePendingAttachment: (id: string, updates: Partial<FileAttachment>) => void;
  clearPendingAttachments: () => void;
  clearPendingSheetImages: () => void;
  updateProjectMemory: (memory: Partial<ProjectMemory>) => void;
  undo: () => void;
  redo: () => void;
  resetAll: () => void;

  autoGenerateTitle: () => void;

  // Legacy (TODO: Remove in next release — only kept for migration)
  loadConversations: () => void;

  // Project CRUD
  createProject: (title: string) => Project;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  updateProject: (id: string, updates: { title?: string; description?: string; projectType?: string }) => void;
  switchProject: (id: string) => void;
  goToProjectsHome: () => void;
  goToProjectHome: () => void;

  // Folder CRUD (in-project grouping)
  createFolder: (projectId: string, name?: string, color?: string) => Folder;
  renameFolder: (projectId: string, folderId: string, name: string) => void;
  recolorFolder: (projectId: string, folderId: string, color: string) => void;
  deleteFolder: (projectId: string, folderId: string) => void;
  moveEntityToFolder: (projectId: string, entityId: string, entityType: EntityType, folderId: string | null) => void;

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

  // Deck CRUD
  createDeck: (projectId: string, title: string, theme?: DeckTheme, slides?: (DeckSlide | HtmlDeckSlide)[]) => ProjectDeck;
  duplicateDeck: (projectId: string, deckId: string) => ProjectDeck | null;
  deleteDeck: (projectId: string, deckId: string) => void;
  renameDeck: (projectId: string, deckId: string, title: string) => void;
  openDeck: (deckId: string) => void;
  updateDeckSlides: (slides: (DeckSlide | HtmlDeckSlide)[]) => void;
  updateDeckTheme: (theme: DeckTheme) => void;
  setDeckPhase: (phase: DeckPhase) => void;
  updateDeckStyle: (style: ThemeConfig | null) => void;
  resetDeckBuilder: () => void;

  // HTML Page CRUD
  createPage: (projectId: string, title: string, html?: string, opts?: { editableFields?: PageEditableField[]; sourceKuId?: string }) => ProjectPage;
  duplicatePage: (projectId: string, pageId: string) => ProjectPage | null;
  deletePage: (projectId: string, pageId: string) => void;
  renamePage: (projectId: string, pageId: string, title: string) => void;
  openPage: (pageId: string) => void;
  updatePageHtml: (html: string) => void;
  applyPageOperations: (operations: PageOperation[]) => void;

  // Tab management
  closeTab: (id: string) => void;

  // Entity sync
  saveCurrentEntity: () => void;
  loadProjects: () => void | Promise<void>;
  loadFullProject: (id: string) => Promise<void>;
  loadEarlierMessages: () => Promise<boolean>; // Returns false if no more messages
  migrateConversations: () => void;
}
