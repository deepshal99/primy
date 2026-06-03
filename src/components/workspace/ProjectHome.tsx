"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Table2,
  Presentation,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Clock,
  Share2,
  Plus,
  Search,
  Settings,
  X,
  AlertTriangle,
  SearchX,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { confirmDialog } from "@/lib/confirm";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import { useCanEdit } from "@/lib/useCanEdit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  KnowledgeUnit,
  ProjectTable,
  ProjectDeck,
  ProjectPage,
} from "@/lib/types";
import { ShareModal } from "@/components/settings/ShareModal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// ====================================
// -- Entity type config --
// ====================================

const FILE_TYPE_CONFIG = {
  ku: {
    label: "Document",
    icon: FileText,
    cardBg: "#f0f4fd",
    previewBg: "#ffffff",
    iconColor: "#2a6dfb",
    accentColor: "#c7d6f7",
    borderColor: "#dce6f9",
    hoverBorder: "#2a6dfb",
    desc: "Write and format text",
  },
  table: {
    label: "Spreadsheet",
    icon: Table2,
    cardBg: "#e8f7ea",
    previewBg: "#ffffff",
    iconColor: "#42c366",
    accentColor: "#b8e6c0",
    borderColor: "#c8eece",
    hoverBorder: "#42c366",
    desc: "Tables and data",
  },
  deck: {
    label: "Presentation",
    icon: Presentation,
    cardBg: "#fde8dc",
    previewBg: "#ffffff",
    iconColor: "#FFAD45",
    accentColor: "#f5c9b5",
    borderColor: "#f5d8ca",
    hoverBorder: "#FFAD45",
    desc: "Slides and visuals",
  },
  page: {
    label: "Page",
    icon: LayoutTemplate,
    cardBg: "#f3eeff",
    previewBg: "#ffffff",
    iconColor: "#9061ff",
    accentColor: "#d9caff",
    borderColor: "#e6dcff",
    hoverBorder: "#9061ff",
    desc: "Visual HTML document",
  },
} as const;

type EntityType = keyof typeof FILE_TYPE_CONFIG;

// ====================================
// -- Helpers --
// ====================================

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
}

// ====================================
// -- Main component --
// ====================================

export function ProjectHome() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const openDeck = useAppStore((s) => s.openDeck);
  const openPage = useAppStore((s) => s.openPage);
  const createKnowledgeUnit = useAppStore((s) => s.createKnowledgeUnit);
  const createTable = useAppStore((s) => s.createTable);
  const createDeck = useAppStore((s) => s.createDeck);
  const createPage = useAppStore((s) => s.createPage);
  const canEdit = useCanEdit();
  const updateProject = useAppStore((s) => s.updateProject);
  const renameKnowledgeUnit = useAppStore((s) => s.renameKnowledgeUnit);
  const renameTable = useAppStore((s) => s.renameTable);
  const renameDeck = useAppStore((s) => s.renameDeck);
  const renamePage = useAppStore((s) => s.renamePage);
  const deleteKnowledgeUnit = useAppStore((s) => s.deleteKnowledgeUnit);
  const deleteTable = useAppStore((s) => s.deleteTable);
  const deleteDeck = useAppStore((s) => s.deleteDeck);
  const deletePage = useAppStore((s) => s.deletePage);
  const duplicateKnowledgeUnit = useAppStore((s) => s.duplicateKnowledgeUnit);
  const duplicateTable = useAppStore((s) => s.duplicateTable);
  const duplicateDeck = useAppStore((s) => s.duplicateDeck);
  const duplicatePage = useAppStore((s) => s.duplicatePage);

  const isLoadingProject = useAppStore((s) => s.isLoadingProject);

  const [filter, setFilter] = useState<"all" | EntityType>("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deleteProject = useAppStore((s) => s.deleteProject);

  // Cmd+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const project = projects.find((p) => p.id === currentProjectId);

  const entities = useMemo(() => {
    if (!project) return [];
    return [
      ...project.knowledgeUnits.map((k) => ({
        id: k.id,
        title: k.title,
        type: "ku" as const,
        updatedAt: k.updatedAt,
        data: k as KnowledgeUnit,
      })),
      ...project.tables.map((t) => ({
        id: t.id,
        title: t.title,
        type: "table" as const,
        updatedAt: t.updatedAt,
        data: t as ProjectTable,
      })),
      ...(project.decks || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: "deck" as const,
        updatedAt: d.updatedAt,
        data: d as ProjectDeck,
      })),
      ...(project.pages || []).map((pg) => ({
        id: pg.id,
        title: pg.title,
        type: "page" as const,
        updatedAt: pg.updatedAt,
        data: pg as ProjectPage,
      })),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [project]);

  const filteredEntities = useMemo(() => {
    let result = filter === "all" ? entities : entities.filter((e) => e.type === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    return result;
  }, [entities, filter, searchQuery]);

  if (!project) return null;

  if (isLoadingProject) {
    return (
      <div className="h-full overflow-y-auto bg-background" aria-label="Loading project">
        <div className="max-w-[1100px] mx-auto px-20 py-10">
          {/* Header */}
          <Skeleton className="h-[32px] w-[280px] mb-3 rounded-md" />
          <Skeleton className="h-[14px] w-[360px] mb-2 rounded" />
          <Skeleton className="h-[11px] w-[140px] mt-4 mb-10 rounded" />

          {/* Filter chips */}
          <div className="flex gap-2 mb-7">
            {[112, 92, 108, 110].map((w, i) => (
              <Skeleton
                key={i}
                className="h-[28px] rounded-full"
                style={{ width: w }}
              />
            ))}
          </div>

          {/* Card grid — matches actual card layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden border border-border"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Skeleton
                  variant="shimmer"
                  className="h-[110px] rounded-xl mx-3 mt-3"
                />
                <div className="px-4 pt-3.5 pb-4">
                  <Skeleton className="h-[10px] w-[80px] mb-2 rounded" />
                  <Skeleton className="h-[14px] w-[160px] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kuCount = project.knowledgeUnits.length;
  const tableCount = project.tables.length;
  const deckCount = (project.decks || []).length;
  const pageCount = (project.pages || []).length;
  const totalFiles = kuCount + tableCount + deckCount + pageCount;

  const handleOpen = (entity: FileEntity) => {
    if (entity.type === "deck") openDeck(entity.id);
    else if (entity.type === "ku") openKnowledgeUnit(entity.id);
    else if (entity.type === "page") openPage(entity.id);
    else openTable(entity.id);
  };

  const handleCreate = (type: EntityType) => {
    if (!canEdit) { toast.error("You have view-only access to this project."); return; }
    if (type === "ku") createKnowledgeUnit(project.id, "New Document");
    else if (type === "table") createTable(project.id, "New Table");
    else if (type === "page") createPage(project.id, "New Page");
    else createDeck(project.id, "New Deck");
  };

  const handleRename = (entity: FileEntity, name: string) => {
    if (!canEdit) { toast.error("You have view-only access to this project."); return; }
    if (entity.type === "deck") renameDeck(project.id, entity.id, name);
    else if (entity.type === "ku") renameKnowledgeUnit(project.id, entity.id, name);
    else if (entity.type === "page") renamePage(project.id, entity.id, name);
    else renameTable(project.id, entity.id, name);
  };

  const handleDuplicate = (entity: FileEntity) => {
    if (!canEdit) { toast.error("You have view-only access to this project."); return; }
    if (entity.type === "ku") duplicateKnowledgeUnit(project.id, entity.id);
    else if (entity.type === "table") duplicateTable(project.id, entity.id);
    else if (entity.type === "deck") duplicateDeck(project.id, entity.id);
    else if (entity.type === "page") duplicatePage(project.id, entity.id);
  };

  const handleDelete = async (entity: FileEntity) => {
    if (!canEdit) { toast.error("You have view-only access to this project."); return; }
    const ok = await confirmDialog({ title: `Delete "${entity.title || "Untitled"}"?`, message: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    if (entity.type === "deck") deleteDeck(project.id, entity.id);
    else if (entity.type === "ku") deleteKnowledgeUnit(project.id, entity.id);
    else if (entity.type === "page") deletePage(project.id, entity.id);
    else deleteTable(project.id, entity.id);
  };

  return (
    <div className="relative h-full overflow-y-auto bg-background">
      <div className="max-w-[1100px] mx-auto px-20 py-10">
        {/* -- Project header (scrolls away) -- */}
        <div className="mb-8">
          {!canEdit && (
            <span className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B87426]" />
              View only
            </span>
          )}
          <EditableTitle
            value={project.title}
            onSave={(title) => { if (canEdit) updateProject(project.id, { title }); }}
          />
          <EditableDescription
            value={project.description || ""}
            onSave={(description) => updateProject(project.id, { description })}
          />
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(project.updatedAt || Date.now())}
            </div>
            <span className="text-[12px] text-muted-foreground/60">&middot;</span>
            <span className="text-[12px] text-muted-foreground">{totalFiles} file{totalFiles !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* -- Files section -- */}
        <div>
          {/* Sticky filter bar */}
          {totalFiles > 0 && (
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pt-3 pb-4 -mx-3 px-3">
              <div className="flex items-center justify-between gap-3">
                {/* Left: filter tabs */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {([
                    { key: "all" as const, label: "All files", count: totalFiles },
                    { key: "ku" as const, label: "Documents", count: kuCount },
                    { key: "table" as const, label: "Spreadsheets", count: tableCount },
                    { key: "deck" as const, label: "Presentations", count: deckCount },
                    { key: "page" as const, label: "Pages", count: pageCount },
                  ]).map((tab) => {
                    const isActive = filter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] t-normal cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-muted-foreground hover:border-border-strong hover:bg-accent"
                        )}
                        style={{ fontWeight: isActive ? 550 : 420 }}
                      >
                        {tab.label}
                        <span className={cn("text-[10px]", isActive ? "text-primary-foreground/60" : "text-muted-foreground/70")}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: search + more menu */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Expandable search */}
                  <div className={cn(
                    "flex items-center rounded-full border t-slow ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                    searchOpen
                      ? "w-[220px] border-border-strong bg-card shadow-[var(--shadow-card)]"
                      : "w-[32px] border-transparent hover:bg-accent"
                  )}>
                    {searchOpen ? (
                      <>
                        <Search className="w-3.5 h-3.5 text-muted-foreground ml-2.5 flex-shrink-0" strokeWidth={2} />
                        <input
                          ref={searchInputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search files..."
                          className="flex-1 bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60 px-2 py-[6px]"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSearchQuery("");
                              setSearchOpen(false);
                            }
                          }}
                        />
                        {searchQuery ? (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground mr-0.5 flex-shrink-0 cursor-pointer"
                            aria-label="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                            className="mr-1.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-secondary border border-border cursor-pointer"
                          >
                            Esc
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setSearchOpen(true);
                          setTimeout(() => searchInputRef.current?.focus(), 50);
                        }}
                        className="w-[32px] h-[32px] flex items-center justify-center text-icon hover:text-foreground cursor-pointer"
                        aria-label="Search files"
                        title="Search (⌘F)"
                      >
                        <Search className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  {/* More menu: share + settings */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-icon hover:text-foreground hover:bg-accent transition-colors cursor-pointer" aria-label="More options">
                        <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[168px] rounded-xl p-1.5"
                      style={{ boxShadow: "var(--shadow-pane)" }}
                    >
                      <DropdownMenuItem
                        onClick={() => setShareOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-foreground cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                        Share project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-foreground cursor-pointer"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        Project settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}

          {/* Content: empty states or card grid */}
          {filteredEntities.length === 0 && searchQuery.trim() ? (
            <EmptyState
              size="md"
              icon={SearchX}
              title="No matches"
              description={`Nothing found for "${searchQuery.trim()}". Try a shorter query or different word.`}
            />
          ) : filteredEntities.length === 0 && filter !== "all" ? (
            <EmptyState
              size="md"
              icon={filter === "ku" ? FileText : filter === "table" ? Table2 : filter === "page" ? LayoutTemplate : Presentation}
              title={`No ${filter === "ku" ? "documents" : filter === "table" ? "spreadsheets" : filter === "page" ? "pages" : "presentations"} yet`}
              description="Switch to All files, or create your first one here."
              action={{
                label: `Create ${filter === "ku" ? "document" : filter === "table" ? "spreadsheet" : filter === "page" ? "page" : "presentation"}`,
                onClick: () => handleCreate(filter),
                icon: Plus,
              }}
            />
          ) : entities.length === 0 ? (
            /* First-run / empty-after-delete — chip-style entity creators */
            <EmptyState
              size="lg"
              illustration={
                <div
                  className="relative w-14 h-14 flex items-center justify-center"
                  aria-hidden
                >
                  {/* Layered card stack illustration */}
                  <div
                    className="absolute w-10 h-12 rounded-[8px] -rotate-[10deg] -translate-x-3 translate-y-1"
                    style={{
                      background: "rgba(255, 173, 69, 0.16)",
                      border: "1px solid rgba(255, 173, 69, 0.30)",
                    }}
                  />
                  <div
                    className="absolute w-10 h-12 rounded-[8px] rotate-[10deg] translate-x-3 translate-y-1"
                    style={{
                      background: "rgba(46, 158, 71, 0.14)",
                      border: "1px solid rgba(46, 158, 71, 0.30)",
                    }}
                  />
                  <div
                    className="relative w-10 h-12 rounded-[8px]"
                    style={{
                      background: "rgba(74, 122, 237, 0.14)",
                      border: "1px solid rgba(74, 122, 237, 0.30)",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div className="absolute inset-x-2 top-2.5 h-[2px] rounded-full bg-[rgba(74,122,237,0.35)]" />
                    <div className="absolute inset-x-2 top-5 h-[2px] w-[60%] rounded-full bg-[rgba(74,122,237,0.22)]" />
                    <div className="absolute inset-x-2 top-[30px] h-[2px] w-[80%] rounded-full bg-[rgba(74,122,237,0.18)]" />
                  </div>
                </div>
              }
              title="A clean slate"
              description="Add a document, spreadsheet, deck or page. Or describe what you want in chat and let AI build it."
            >
              <div className="flex flex-wrap items-center justify-center gap-2 stagger-children">
                <button
                  onClick={() => handleCreate("ku")}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:border-[#4a7aed]/40 hover:bg-[#4a7aed]/10 active:scale-[0.98] t-fast animate-fade-in"
                >
                  <FileText className="w-3.5 h-3.5 text-[#4a7aed]" strokeWidth={2} />
                  <span className="text-[12.5px] font-medium text-foreground">Add document</span>
                </button>
                <button
                  onClick={() => handleCreate("table")}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:border-[#2e9e47]/40 hover:bg-[#2e9e47]/10 active:scale-[0.98] t-fast animate-fade-in"
                >
                  <Table2 className="w-3.5 h-3.5 text-[#2e9e47]" strokeWidth={2} />
                  <span className="text-[12.5px] font-medium text-foreground">Add sheet</span>
                </button>
                <button
                  onClick={() => handleCreate("deck")}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:border-[#FFAD45]/50 hover:bg-[#FFAD45]/12 active:scale-[0.98] t-fast animate-fade-in"
                >
                  <Presentation className="w-3.5 h-3.5 text-[#FFAD45]" strokeWidth={2} />
                  <span className="text-[12.5px] font-medium text-foreground">Add deck</span>
                </button>
                <button
                  onClick={() => handleCreate("page")}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:border-[#9061ff]/40 hover:bg-[#9061ff]/10 active:scale-[0.98] t-fast animate-fade-in"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 text-[#9061ff]" strokeWidth={2} />
                  <span className="text-[12.5px] font-medium text-foreground">Add page</span>
                </button>
              </div>
            </EmptyState>
          ) : (
            /* File cards grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {filteredEntities.map((entity, idx) => {
                const config = FILE_TYPE_CONFIG[entity.type];
                const Icon = config.icon;
                const isRenaming = renamingId === entity.id;

                return (
                  <div
                    key={entity.id}
                    className="group relative rounded-2xl overflow-hidden cursor-pointer t-normal active:scale-[0.98] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 animate-scale-in"
                    style={{
                      background: config.cardBg,
                      animationDelay: `${idx * 50}ms`,
                    }}
                    onClick={() => {
                      if (!isRenaming) handleOpen(entity);
                    }}
                  >
                    {/* Three-dot menu */}
                    <div
                      className="absolute top-2.5 right-2.5 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:opacity-100 data-[state=open]:bg-accent data-[state=open]:text-foreground"
                            aria-label="File options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[148px] rounded-xl p-1.5"
                          style={{ boxShadow: "var(--shadow-pane)" }}
                        >
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(entity)}
                            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-foreground cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingId(entity.id);
                              setRenameValue(entity.title);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-foreground cursor-pointer"
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 mx-1" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(entity)}
                            variant="destructive"
                            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Preview area */}
                    <div
                      className="mx-3 mt-3 rounded-xl overflow-hidden"
                      style={{ background: config.previewBg }}
                    >
                      <div className="h-[100px] overflow-hidden select-none pointer-events-none">
                        {entity.type === "ku" && <DocPreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
                        {entity.type === "table" && <TablePreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
                        {entity.type === "deck" && <DeckPreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
                        {entity.type === "page" && <PagePreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
                      </div>
                    </div>

                    {/* File info */}
                    <div className="px-4 pt-3.5 pb-4">
                      {/* Type + time */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: config.iconColor, opacity: 0.7 }}
                          strokeWidth={1.75}
                        />
                        <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 450 }}>
                          {config.label}
                        </span>
                        <span className="text-[11px] text-ink-4">&middot;</span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(entity.updatedAt)}</span>
                      </div>
                      {/* Title */}
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => {
                            if (renameValue.trim() && renameValue.trim() !== entity.title) {
                              handleRename(entity, renameValue.trim());
                            }
                            setRenamingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full bg-transparent outline-none border-b-2 pb-0.5 text-[14px] font-semibold text-foreground"
                          style={{ borderColor: config.iconColor }}
                        />
                      ) : (
                        <h3 className="text-[14px] text-foreground font-semibold leading-snug line-clamp-2">
                          {entity.title}
                        </h3>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Project share modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode="project"
        entityId={project.id}
        entityTitle={project.title}
        currentToken={project.shareToken || null}
        onTokenChange={(token) => {
          const state = useAppStore.getState();
          useAppStore.setState({
            projects: state.projects.map((p) =>
              p.id === project.id ? { ...p, shareToken: token } : p
            ),
          });
        }}
      />

      {/* Project settings dialog */}
      <ProjectSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
      />

      {/* FAB — New file */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
        {/* Expanded options */}
        {fabOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setFabOpen(false)}
            />
            <div className="relative z-50 flex flex-col items-end gap-1.5 mb-2">
              {(["ku", "table", "deck", "page"] as const).map((type, i) => {
                const config = FILE_TYPE_CONFIG[type];
                const IconComp = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      handleCreate(type);
                      setFabOpen(false);
                    }}
                    className="flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-2xl bg-card border border-border shadow-[var(--shadow-lift)] hover:border-border-strong hover:shadow-[var(--shadow-pane)] active:scale-[0.95] t-normal cursor-pointer"
                    style={{
                      animation: `fab-item-in 200ms ${(4 - i) * 40}ms both cubic-bezier(0.34,1.56,0.64,1)`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: config.borderColor }}
                    >
                      <IconComp
                        className="w-4 h-4"
                        style={{ color: config.iconColor }}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="text-left">
                      <div className="text-[13px] font-medium text-foreground leading-tight">{config.label}</div>
                      <div className="text-[10.5px] text-muted-foreground leading-tight">{config.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="relative z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_6px_24px_rgba(24,24,22,0.18),0_2px_6px_rgba(24,24,22,0.18)] hover:opacity-90 hover:shadow-[0_8px_30px_rgba(24,24,22,0.18)] active:scale-[0.95] t-normal cursor-pointer"
          aria-label={fabOpen ? "Close menu" : "Create new file"}
        >
          <Plus
            className="w-6 h-6 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            strokeWidth={2.5}
            style={{ transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </div>
  );
}

// ====================================
// -- Project settings dialog --
// ====================================

function ProjectSettingsDialog({
  open,
  onClose,
  project,
  onUpdateProject,
  onDeleteProject,
}: {
  open: boolean;
  onClose: () => void;
  project: { id: string; title: string; description?: string; createdAt?: number };
  onUpdateProject: (id: string, data: { title?: string; description?: string }) => void;
  onDeleteProject: (id: string) => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(project.title);
      setDescription(project.description || "");
      setDeleteConfirm(false);
    }
  }, [open, project.title, project.description]);

  const handleSave = () => {
    const trimTitle = title.trim();
    if (!trimTitle) return;
    const updates: { title?: string; description?: string } = {};
    if (trimTitle !== project.title) updates.title = trimTitle;
    if (description.trim() !== (project.description || "")) updates.description = description.trim();
    if (Object.keys(updates).length > 0) {
      onUpdateProject(project.id, updates);
      toast.success("Project updated");
    }
    onClose();
  };

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    onDeleteProject(project.id);
    toast.success("Project deleted");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-[16px] font-semibold text-foreground">Project settings</DialogTitle>
          <DialogDescription className="sr-only">Manage your project settings</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block mb-1.5 text-[12px] font-medium text-muted-foreground">Project name</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[13px]"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1.5 text-[12px] font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this project..."
              rows={3}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)]/30 focus:border-[var(--accent-amber)]/60 transition-colors"
            />
          </div>

          {/* Created date */}
          {project.createdAt && (
            <p className="text-[11px] text-muted-foreground">
              Created {new Date(project.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          {/* Delete */}
          <button
            onClick={handleDelete}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer",
              deleteConfirm
                ? "bg-red-50 text-red-600 border border-red-200"
                : "text-muted-foreground hover:text-red-500 hover:bg-red-50/60"
            )}
          >
            {deleteConfirm ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Click again to confirm
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Delete project
              </>
            )}
          </button>

          {/* Save */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-[12px]">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="text-[12px] bg-primary hover:bg-primary/90 text-primary-foreground">
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ====================================
// -- Inline-editable components --
// ====================================

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="w-full bg-transparent outline-none border-b-2 border-[var(--accent-amber)] pb-1 text-[26px] text-foreground tracking-[-0.4px] font-semibold"
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="cursor-text rounded-lg transition-colors hover:bg-accent -mx-2 px-2 py-1 text-[26px] text-foreground tracking-[-0.4px] font-semibold leading-[1.2]"
      title="Click to rename"
    >
      {value}
    </h1>
  );
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="w-full bg-transparent outline-none border-b-2 border-[var(--accent-amber)] pb-1 resize-none text-[14px] text-ink-2 leading-relaxed max-w-[520px]"
        style={{ minHeight: "24px" }}
        placeholder="Add a project description..."
      />
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-text rounded-lg transition-colors hover:bg-accent -mx-2 px-2 py-1 mt-1 text-[14px] leading-relaxed max-w-[520px]",
        value ? "text-ink-2" : "text-ink-4"
      )}
      title="Click to edit description"
    >
      {value || "Add a project description..."}
    </p>
  );
}

// ====================================
// -- Mini preview renderers --
// ====================================

function DocPreviewContent({ accent }: { accent: string; iconColor: string }) {
  return (
    <div className="flex flex-col gap-[6px] p-4">
      <div className="h-[7px] w-[55%] rounded-sm" style={{ background: accent, opacity: 0.8 }} />
      <div className="h-[5px] w-[90%] rounded-sm" style={{ background: accent, opacity: 0.4 }} />
      <div className="h-[5px] w-[78%] rounded-sm" style={{ background: accent, opacity: 0.35 }} />
      <div className="h-[5px] w-[85%] rounded-sm" style={{ background: accent, opacity: 0.3 }} />
      <div className="h-2" />
      <div className="h-[5px] w-[92%] rounded-sm" style={{ background: accent, opacity: 0.35 }} />
      <div className="h-[5px] w-[65%] rounded-sm" style={{ background: accent, opacity: 0.28 }} />
      <div className="h-[5px] w-[88%] rounded-sm" style={{ background: accent, opacity: 0.32 }} />
    </div>
  );
}

function TablePreviewContent({ accent }: { accent: string; iconColor: string }) {
  return (
    <div className="p-3.5">
      <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${accent}50` }}>
        <div className="flex">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[16px] border-r last:border-r-0"
              style={{ background: `${accent}40`, borderColor: `${accent}30` }}
            />
          ))}
        </div>
        {[...Array(4)].map((_, r) => (
          <div key={r} className="flex" style={{ borderTop: `1px solid ${accent}25` }}>
            {[...Array(4)].map((_, c) => (
              <div
                key={c}
                className="flex-1 h-[14px] border-r last:border-r-0"
                style={{
                  borderColor: `${accent}18`,
                  background: c === 0 ? `${accent}15` : "transparent",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeckPreviewContent({ accent }: { accent: string; iconColor: string }) {
  return (
    <div className="flex items-center justify-center p-3.5 h-full">
      <div
        className="w-full rounded-md p-3.5 flex flex-col items-center justify-center"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
      >
        <div className="h-[6px] w-[50%] rounded-sm mb-1.5" style={{ background: accent, opacity: 0.7 }} />
        <div className="h-[4px] w-[70%] rounded-sm mb-[3px]" style={{ background: accent, opacity: 0.35 }} />
        <div className="h-[4px] w-[50%] rounded-sm" style={{ background: accent, opacity: 0.28 }} />
        <div className="mt-3 flex gap-2">
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}45` }} />
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}28` }} />
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}45` }} />
        </div>
      </div>
    </div>
  );
}

function PagePreviewContent({ accent }: { accent: string; iconColor: string }) {
  return (
    <div className="flex items-center justify-center p-3.5 h-full">
      <div
        className="w-full h-full rounded-md p-2.5 flex flex-col gap-1.5"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
      >
        {/* hero band */}
        <div className="h-[18px] rounded-[3px]" style={{ background: `${accent}40` }} />
        {/* two-column visual blocks */}
        <div className="flex gap-1.5 flex-1">
          <div className="flex-1 rounded-[3px]" style={{ background: `${accent}28` }} />
          <div className="flex-[2] flex flex-col gap-1 justify-center px-1">
            <div className="h-[4px] w-[80%] rounded-sm" style={{ background: accent, opacity: 0.6 }} />
            <div className="h-[4px] w-[60%] rounded-sm" style={{ background: accent, opacity: 0.4 }} />
            <div className="h-[4px] w-[70%] rounded-sm" style={{ background: accent, opacity: 0.4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================
// -- Types --
// ====================================

interface FileEntity {
  id: string;
  title: string;
  type: EntityType;
  updatedAt: number;
  data: KnowledgeUnit | ProjectTable | ProjectDeck | ProjectPage;
}
