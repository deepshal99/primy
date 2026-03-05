"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Table2,
  GitBranch,
  Presentation,
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
import { cn } from "@/lib/cn";
import { toast } from "sonner";
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
  ProjectDiagram,
  ProjectDeck,
} from "@/lib/types";
import { ShareModal } from "@/components/settings/ShareModal";
import { Skeleton } from "@/components/ui/skeleton";

// ====================================
// -- Entity type config --
// ====================================

const FILE_TYPE_CONFIG = {
  ku: {
    label: "Document",
    icon: FileText,
    cardBg: "#f0f4fd",
    previewBg: "#ffffff",
    iconColor: "#4a7aed",
    accentColor: "#c7d6f7",
    borderColor: "#dce6f9",
    hoverBorder: "#4a7aed",
    desc: "Write and format text",
  },
  table: {
    label: "Spreadsheet",
    icon: Table2,
    cardBg: "#e8f7ea",
    previewBg: "#ffffff",
    iconColor: "#2e9e47",
    accentColor: "#b8e6c0",
    borderColor: "#c8eece",
    hoverBorder: "#2e9e47",
    desc: "Tables and data",
  },
  deck: {
    label: "Presentation",
    icon: Presentation,
    cardBg: "#fde8dc",
    previewBg: "#ffffff",
    iconColor: "#d4582a",
    accentColor: "#f5c9b5",
    borderColor: "#f5d8ca",
    hoverBorder: "#d4582a",
    desc: "Slides and visuals",
  },
  diagram: {
    label: "Diagram",
    icon: GitBranch,
    cardBg: "#ece4f8",
    previewBg: "#ffffff",
    iconColor: "#7c5cb8",
    accentColor: "#d3c5ec",
    borderColor: "#ddd2f0",
    hoverBorder: "#7c5cb8",
    desc: "Flowcharts and maps",
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
  const openDiagram = useAppStore((s) => s.openDiagram);
  const openDeck = useAppStore((s) => s.openDeck);
  const createKnowledgeUnit = useAppStore((s) => s.createKnowledgeUnit);
  const createTable = useAppStore((s) => s.createTable);
  const createDiagram = useAppStore((s) => s.createDiagram);
  const createDeck = useAppStore((s) => s.createDeck);
  const updateProject = useAppStore((s) => s.updateProject);
  const renameKnowledgeUnit = useAppStore((s) => s.renameKnowledgeUnit);
  const renameTable = useAppStore((s) => s.renameTable);
  const renameDiagram = useAppStore((s) => s.renameDiagram);
  const renameDeck = useAppStore((s) => s.renameDeck);
  const deleteKnowledgeUnit = useAppStore((s) => s.deleteKnowledgeUnit);
  const deleteTable = useAppStore((s) => s.deleteTable);
  const deleteDiagram = useAppStore((s) => s.deleteDiagram);
  const deleteDeck = useAppStore((s) => s.deleteDeck);
  const duplicateKnowledgeUnit = useAppStore((s) => s.duplicateKnowledgeUnit);
  const duplicateTable = useAppStore((s) => s.duplicateTable);
  const duplicateDiagram = useAppStore((s) => s.duplicateDiagram);
  const duplicateDeck = useAppStore((s) => s.duplicateDeck);

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
      ...(project.diagrams || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: "diagram" as const,
        updatedAt: d.updatedAt,
        data: d as ProjectDiagram,
      })),
      ...(project.decks || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: "deck" as const,
        updatedAt: d.updatedAt,
        data: d as ProjectDeck,
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
      <div className="h-full overflow-y-auto bg-white">
        <div className="max-w-[1100px] mx-auto px-20 py-10">
          <Skeleton className="h-8 w-[280px] mb-3" />
          <Skeleton className="h-4 w-[360px] mb-2" />
          <Skeleton className="h-3 w-[140px] mt-4 mb-10" />
          <div className="flex gap-2 mb-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-[90px] rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <Skeleton className="h-[100px] rounded-xl mx-3 mt-3" />
                <div className="px-4 pt-3.5 pb-4">
                  <Skeleton className="h-3 w-[80px] mb-2" />
                  <Skeleton className="h-4 w-[140px]" />
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
  const diagramCount = (project.diagrams || []).length;
  const deckCount = (project.decks || []).length;
  const totalFiles = kuCount + tableCount + diagramCount + deckCount;

  const handleOpen = (entity: FileEntity) => {
    if (entity.type === "deck") openDeck(entity.id);
    else if (entity.type === "diagram") openDiagram(entity.id);
    else if (entity.type === "ku") openKnowledgeUnit(entity.id);
    else openTable(entity.id);
  };

  const handleCreate = (type: EntityType) => {
    if (type === "ku") createKnowledgeUnit(project.id, "New Document");
    else if (type === "table") createTable(project.id, "New Table");
    else if (type === "diagram") createDiagram(project.id, "New Diagram");
    else createDeck(project.id, "New Deck");
  };

  const handleRename = (entity: FileEntity, name: string) => {
    if (entity.type === "deck") renameDeck(project.id, entity.id, name);
    else if (entity.type === "diagram") renameDiagram(project.id, entity.id, name);
    else if (entity.type === "ku") renameKnowledgeUnit(project.id, entity.id, name);
    else renameTable(project.id, entity.id, name);
  };

  const handleDuplicate = (entity: FileEntity) => {
    if (entity.type === "ku") duplicateKnowledgeUnit(project.id, entity.id);
    else if (entity.type === "table") duplicateTable(project.id, entity.id);
    else if (entity.type === "diagram") duplicateDiagram(project.id, entity.id);
    else if (entity.type === "deck") duplicateDeck(project.id, entity.id);
  };

  const handleDelete = (entity: FileEntity) => {
    if (!window.confirm(`Delete "${entity.title}"? This cannot be undone.`)) return;
    if (entity.type === "deck") deleteDeck(project.id, entity.id);
    else if (entity.type === "diagram") deleteDiagram(project.id, entity.id);
    else if (entity.type === "ku") deleteKnowledgeUnit(project.id, entity.id);
    else deleteTable(project.id, entity.id);
  };

  return (
    <div className="relative h-full overflow-y-auto bg-white">
      <div className="max-w-[1100px] mx-auto px-20 py-10">
        {/* -- Project header (scrolls away) -- */}
        <div className="mb-8">
          <EditableTitle
            value={project.title}
            onSave={(title) => updateProject(project.id, { title })}
          />
          <EditableDescription
            value={project.description || ""}
            onSave={(description) => updateProject(project.id, { description })}
          />
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 text-[12px] text-[#a09d96]">
              <Clock className="w-3.5 h-3.5" />
              {timeAgo(project.updatedAt || Date.now())}
            </div>
            <span className="text-[12px] text-[#d5d2cc]">&middot;</span>
            <span className="text-[12px] text-[#a09d96]">{totalFiles} file{totalFiles !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* -- Files section -- */}
        <div>
          {/* Sticky filter bar */}
          {totalFiles > 0 && (
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pt-3 pb-4 -mx-3 px-3">
              <div className="flex items-center justify-between gap-3">
                {/* Left: filter tabs */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {([
                    { key: "all" as const, label: "All files", count: totalFiles },
                    { key: "ku" as const, label: "Documents", count: kuCount },
                    { key: "table" as const, label: "Spreadsheets", count: tableCount },
                    { key: "deck" as const, label: "Presentations", count: deckCount },
                    { key: "diagram" as const, label: "Diagrams", count: diagramCount },
                  ]).map((tab) => {
                    const isActive = filter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] transition-all duration-200 cursor-pointer",
                          isActive
                            ? "bg-[#1a1a2e] text-white"
                            : "bg-white border border-[#e8e7e4] text-[#5a5852] hover:border-[#d0cfc9] hover:bg-[#f7f6f3]"
                        )}
                        style={{ fontWeight: isActive ? 550 : 420 }}
                      >
                        {tab.label}
                        <span className={cn("text-[10px]", isActive ? "text-white/60" : "text-[#b0ada6]")}>
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
                    "flex items-center rounded-full border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
                    searchOpen
                      ? "w-[220px] border-[#d0cfc9] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                      : "w-[32px] border-transparent hover:bg-[#f7f6f3]"
                  )}>
                    {searchOpen ? (
                      <>
                        <Search className="w-3.5 h-3.5 text-[#a09d96] ml-2.5 flex-shrink-0" strokeWidth={2} />
                        <input
                          ref={searchInputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search files..."
                          className="flex-1 bg-transparent outline-none text-[12px] text-[#1a1a2e] placeholder:text-[#c5c2bb] px-2 py-[6px]"
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
                            className="w-6 h-6 flex items-center justify-center text-[#a09d96] hover:text-[#5a5852] mr-0.5 flex-shrink-0 cursor-pointer"
                            aria-label="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                            className="mr-1.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] text-[#b0ada6] bg-[#f3f2ee] border border-[#e8e7e4] cursor-pointer"
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
                        className="w-[32px] h-[32px] flex items-center justify-center text-[#95928E] hover:text-[#5a5852] cursor-pointer"
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
                      <button className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-[#95928E] hover:text-[#5a5852] hover:bg-[#f7f6f3] transition-colors cursor-pointer" aria-label="More options">
                        <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[168px] rounded-xl p-1.5"
                      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)" }}
                    >
                      <DropdownMenuItem
                        onClick={() => setShareOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#9a968f]" />
                        Share project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] cursor-pointer"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <Settings className="w-3.5 h-3.5 text-[#9a968f]" />
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f5f4f0] flex items-center justify-center mb-3">
                <SearchX className="w-5 h-5 text-[#b0ada6]" />
              </div>
              <p className="text-[14px] font-medium text-[#6b6b80] mb-1">No results found</p>
              <p className="text-[13px] text-[#a09d96]">
                No files matching &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            </div>
          ) : filteredEntities.length === 0 && filter !== "all" ? (
            <div className="py-10 text-center text-[#a09d96] text-[13px]">
              No {filter === "ku" ? "documents" : filter === "table" ? "spreadsheets" : filter === "deck" ? "presentations" : "diagrams"} yet
            </div>
          ) : entities.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-center mb-8">
                <h3 className="text-[20px] font-semibold text-[#1a1a2e] tracking-[-0.3px] mb-2" style={{ fontFamily: "'Degular', 'Inter', sans-serif" }}>
                  Start creating
                </h3>
                <p className="text-[14px] text-[#8a877f] leading-relaxed">
                  Create your first file to get started
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full max-w-[400px] stagger-children">
                {/* Document */}
                <button onClick={() => handleCreate('ku')} className="group flex items-center gap-3 px-5 py-4 rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 active:scale-[0.98] animate-fade-in">
                  <FileText className="w-5 h-5 text-[#4a7aed] transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-[#2d2e2e]">Document</span>
                </button>

                {/* Spreadsheet */}
                <button onClick={() => handleCreate('table')} className="group flex items-center gap-3 px-5 py-4 rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 active:scale-[0.98] animate-fade-in">
                  <Table2 className="w-5 h-5 text-[#2e9e47] transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-[#2d2e2e]">Spreadsheet</span>
                </button>

                {/* Diagram */}
                <button onClick={() => handleCreate('diagram')} className="group flex items-center gap-3 px-5 py-4 rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 active:scale-[0.98] animate-fade-in">
                  <GitBranch className="w-5 h-5 text-[#7c5cb8] transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-[#2d2e2e]">Diagram</span>
                </button>

                {/* Presentation */}
                <button onClick={() => handleCreate('deck')} className="group flex items-center gap-3 px-5 py-4 rounded-xl border border-[#e8e7e4] hover:border-[#ff4a00]/30 hover:bg-[#fff8f5] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 active:scale-[0.98] animate-fade-in">
                  <Presentation className="w-5 h-5 text-[#d4582a] transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-[#2d2e2e]">Presentation</span>
                </button>
              </div>
            </div>
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
                    className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] animate-scale-in"
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
                            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[#999] hover:bg-black/[0.05] hover:text-[#5a5852] data-[state=open]:opacity-100 data-[state=open]:bg-black/[0.05] data-[state=open]:text-[#5a5852]"
                            aria-label="File options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[148px] rounded-xl p-1.5"
                          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)" }}
                        >
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(entity)}
                            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-[#9a968f]" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingId(entity.id);
                              setRenameValue(entity.title);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3 text-[#9a968f]" />
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
                        {entity.type === "diagram" && <DiagramPreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
                        {entity.type === "deck" && <DeckPreviewContent accent={config.accentColor} iconColor={config.iconColor} />}
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
                        <span className="text-[11px] text-[#a09d96]" style={{ fontWeight: 450 }}>
                          {config.label}
                        </span>
                        <span className="text-[11px] text-[#d5d2cc]">&middot;</span>
                        <span className="text-[11px] text-[#b0ada6]">{timeAgo(entity.updatedAt)}</span>
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
                          className="w-full bg-transparent outline-none border-b-2 pb-0.5 text-[14px] font-semibold text-[#1a1a2e]"
                          style={{ borderColor: config.iconColor }}
                        />
                      ) : (
                        <h3 className="text-[14px] text-[#1a1a2e] font-semibold leading-snug line-clamp-2">
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
              {(["ku", "table", "diagram", "deck"] as const).map((type, i) => {
                const config = FILE_TYPE_CONFIG[type];
                const IconComp = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      handleCreate(type);
                      setFabOpen(false);
                    }}
                    className="flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-2xl bg-white border border-[#e8e7e4] shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#d0cfc9] hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)] active:scale-[0.97] transition-all duration-200 cursor-pointer"
                    style={{
                      animation: `fab-item-in 200ms ${(3 - i) * 40}ms both cubic-bezier(0.34,1.56,0.64,1)`,
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
                      <div className="text-[13px] font-medium text-[#1a1a2e] leading-tight">{config.label}</div>
                      <div className="text-[10.5px] text-[#a09d96] leading-tight">{config.desc}</div>
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
          className="relative z-50 w-14 h-14 rounded-2xl bg-[#ff4a00] text-white flex items-center justify-center shadow-[0_6px_24px_rgba(255,74,0,0.35),0_2px_6px_rgba(255,74,0,0.2)] hover:bg-[#e54400] hover:shadow-[0_8px_30px_rgba(255,74,0,0.4)] active:scale-[0.93] transition-all duration-200 cursor-pointer"
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
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#e8e7e4]">
          <DialogTitle className="text-[16px] font-semibold text-[#1a1a2e]">Project settings</DialogTitle>
          <DialogDescription className="sr-only">Manage your project settings</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block mb-1.5 text-[12px] font-medium text-[#6b6b80]">Project name</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[13px]"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1.5 text-[12px] font-medium text-[#6b6b80]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this project..."
              rows={3}
              className="w-full rounded-lg border border-[#dddfe3] bg-transparent px-3 py-2 text-[13px] text-[#1a1a2e] placeholder:text-[#c5c2bb] resize-none focus:outline-none focus:ring-2 focus:ring-[#ff4a00]/20 focus:border-[#ff4a00]/40 transition-colors"
            />
          </div>

          {/* Created date */}
          {project.createdAt && (
            <p className="text-[11px] text-[#b0ada6]">
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
                : "text-[#a09d96] hover:text-red-500 hover:bg-red-50/60"
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
            <Button size="sm" onClick={handleSave} className="text-[12px] bg-[#ff4a00] hover:bg-[#e54400] text-white">
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
        className="w-full bg-transparent outline-none border-b-2 border-[#ff4a00] pb-1 text-[26px] text-[#1a1a2e] tracking-[-0.4px] font-semibold"
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="cursor-text rounded-lg transition-colors hover:bg-black/[0.03] -mx-2 px-2 py-1 text-[26px] text-[#1a1a2e] tracking-[-0.4px] font-semibold leading-[1.2]"
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
        className="w-full bg-transparent outline-none border-b-2 border-[#ff4a00] pb-1 resize-none text-[14px] text-[#8a877f] leading-relaxed max-w-[520px]"
        style={{ minHeight: "24px" }}
        placeholder="Add a project description..."
      />
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-text rounded-lg transition-colors hover:bg-black/[0.03] -mx-2 px-2 py-1 mt-1 text-[14px] leading-relaxed max-w-[520px]",
        value ? "text-[#8a877f]" : "text-[#c5c2bb]"
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

function DiagramPreviewContent({ accent }: { accent: string; iconColor: string }) {
  return (
    <div className="flex items-center justify-center p-3.5 h-full">
      <svg width="100%" height="85" viewBox="0 0 140 85">
        <line x1="70" y1="20" x2="35" y2="46" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        <line x1="70" y1="20" x2="105" y2="46" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        <line x1="35" y1="54" x2="35" y2="68" stroke={accent} strokeWidth="1.5" opacity="0.35" />
        <line x1="105" y1="54" x2="105" y2="68" stroke={accent} strokeWidth="1.5" opacity="0.35" />
        <rect x="52" y="6" width="36" height="20" rx="5" fill={accent} opacity="0.55" />
        <rect x="17" y="40" width="36" height="18" rx="5" fill={accent} opacity="0.35" />
        <rect x="87" y="40" width="36" height="18" rx="5" fill={accent} opacity="0.35" />
        <rect x="19" y="64" width="32" height="14" rx="4" fill={accent} opacity="0.2" />
        <rect x="89" y="64" width="32" height="14" rx="4" fill={accent} opacity="0.2" />
      </svg>
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
  data: KnowledgeUnit | ProjectTable | ProjectDiagram | ProjectDeck;
}
