"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  KnowledgeUnit,
  ProjectTable,
  ProjectDiagram,
  ProjectDeck,
} from "@/lib/types";
import { ShareModal } from "@/components/settings/ShareModal";

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
    badgeBg: "#e0eafc",
    badgeText: "#3b6ad8",
    desc: "Write and format text",
  },
  table: {
    label: "Spreadsheet",
    icon: Table2,
    cardBg: "#e8f7ea",
    previewBg: "#ffffff",
    iconColor: "#2e9e47",
    accentColor: "#b8e6c0",
    badgeBg: "#d4f0d8",
    badgeText: "#288c3e",
    desc: "Tables and data",
  },
  deck: {
    label: "Presentation",
    icon: Presentation,
    cardBg: "#fde8dc",
    previewBg: "#ffffff",
    iconColor: "#d4582a",
    accentColor: "#f5c9b5",
    badgeBg: "#fdd8c7",
    badgeText: "#c04f24",
    desc: "Slides and visuals",
  },
  diagram: {
    label: "Diagram",
    icon: GitBranch,
    cardBg: "#ece4f8",
    previewBg: "#ffffff",
    iconColor: "#7c5cb8",
    accentColor: "#d3c5ec",
    badgeBg: "#e0d5f3",
    badgeText: "#6b4ea5",
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

  const [filter, setFilter] = useState<"all" | EntityType>("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

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
    if (filter === "all") return entities;
    return entities.filter((e) => e.type === filter);
  }, [entities, filter]);

  if (!project) return null;

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
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-[1100px] mx-auto px-20 py-10">
        {/* -- Project header -- */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <EditableTitle
                value={project.title}
                onSave={(title) => updateProject(project.id, { title })}
              />
              <EditableDescription
                value={project.description || ""}
                onSave={(description) => updateProject(project.id, { description })}
              />
              <div className="flex items-center gap-5 mt-5">
                <div className="flex items-center gap-1.5 text-[12px] text-[#8a877f]">
                  <Clock className="w-3.5 h-3.5" />
                  Updated {timeAgo(project.updatedAt || Date.now())}
                </div>
                <div className="w-px h-3 bg-[#e0deda]" />
                <div className="text-[12px] text-[#8a877f]">{totalFiles} files</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setShareOpen(true)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-lg border border-[#e8e7e4] text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#f7f6f3] transition-colors"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff4a00] text-white text-[13px] font-medium hover:bg-[#e54400] transition-colors shadow-[0_1px_3px_rgba(255,74,0,0.2)]">
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    New file
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[232px] p-1.5 rounded-xl">
                  {(["ku", "table", "diagram", "deck"] as const).map((type) => {
                    const config = FILE_TYPE_CONFIG[type];
                    const IconComp = config.icon;
                    return (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => handleCreate(type)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                      >
                        <IconComp
                          className="w-[17px] h-[17px] flex-shrink-0"
                          style={{ color: config.iconColor }}
                          strokeWidth={1.75}
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-[#2d2e2e] font-medium">{config.label}</div>
                          <div className="text-[10.5px] text-[#a09d96]">{config.desc}</div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* -- Files section -- */}
        <div>
          {/* Filter tabs */}
          {totalFiles > 0 && (
            <div className="flex items-center gap-1.5 mb-6 flex-wrap">
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
          )}

          {/* Content: empty states or card grid */}
          {filteredEntities.length === 0 && filter !== "all" ? (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {filteredEntities.map((entity, idx) => {
                const config = FILE_TYPE_CONFIG[entity.type];
                const Icon = config.icon;
                const isRenaming = renamingId === entity.id;
                const canDuplicate = true;

                return (
                  <div
                    key={entity.id}
                    className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.99] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] animate-scale-in"
                    style={{ background: config.cardBg, animationDelay: `${idx * 60}ms` }}
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
                            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-[#999] hover:bg-white/70 hover:text-[#5a5852] data-[state=open]:opacity-100 data-[state=open]:bg-white/70 data-[state=open]:text-[#5a5852]"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[148px] rounded-xl p-1.5"
                          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)" }}
                        >
                          {canDuplicate && (
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(entity)}
                              className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-[#3d3d3d] cursor-pointer"
                            >
                              <Copy className="w-3 h-3 text-[#9a968f]" />
                              Duplicate
                            </DropdownMenuItem>
                          )}
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
                    <div className="mx-3 mt-3 rounded-xl overflow-hidden" style={{ background: config.previewBg }}>
                      <div className="h-[130px] overflow-hidden select-none pointer-events-none">
                        {entity.type === "ku" && <DocPreviewContent accent={config.accentColor} />}
                        {entity.type === "table" && <TablePreviewContent accent={config.accentColor} />}
                        {entity.type === "diagram" && <DiagramPreviewContent accent={config.accentColor} />}
                        {entity.type === "deck" && <DeckPreviewContent accent={config.accentColor} />}
                      </div>
                    </div>

                    {/* File info */}
                    <div className="px-3.5 pt-3 pb-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          className="w-[16px] h-[16px] flex-shrink-0"
                          style={{ color: config.iconColor }}
                          strokeWidth={1.75}
                        />
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
                            className="flex-1 min-w-0 bg-transparent outline-none border-b-2 pb-0.5 text-[13px] font-medium text-[#2d2e2e]"
                            style={{ borderColor: config.iconColor }}
                          />
                        ) : (
                          <span className="text-[13px] text-[#2d2e2e] truncate" style={{ fontWeight: 500 }}>
                            {entity.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-[24px]">
                        <span className="text-[11px] text-[#a09d96]">{config.label}</span>
                        <span className="text-[11px] text-[#c5c2bb]">&middot;</span>
                        <span className="text-[11px] text-[#a09d96]">{timeAgo(entity.updatedAt)}</span>
                      </div>
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
    </div>
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

function DocPreviewContent({ accent }: { accent: string }) {
  return (
    <div className="flex flex-col gap-[6px] p-4">
      <div className="h-[8px] w-[65%] rounded-sm" style={{ background: accent }} />
      <div className="h-[5px] w-[90%] rounded-sm bg-[#e5e5e5]" />
      <div className="h-[5px] w-[80%] rounded-sm bg-[#e5e5e5]" />
      <div className="h-[5px] w-[85%] rounded-sm bg-[#ececec]" />
      <div className="h-3" />
      <div className="h-[5px] w-[92%] rounded-sm bg-[#e5e5e5]" />
      <div className="h-[5px] w-[70%] rounded-sm bg-[#ececec]" />
      <div className="h-[5px] w-[88%] rounded-sm bg-[#e5e5e5]" />
      <div className="h-[5px] w-[50%] rounded-sm bg-[#ececec]" />
    </div>
  );
}

function TablePreviewContent({ accent }: { accent: string }) {
  return (
    <div className="p-3">
      <div className="border border-[#e0e0e0] rounded-[4px] overflow-hidden">
        <div className="flex">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[16px] border-r last:border-r-0"
              style={{ background: accent, borderColor: `${accent}88` }}
            />
          ))}
        </div>
        {[...Array(4)].map((_, r) => (
          <div key={r} className="flex border-t border-[#eaeaea]">
            {[...Array(4)].map((_, c) => (
              <div
                key={c}
                className="flex-1 h-[14px] border-r last:border-r-0 border-[#f0f0f0]"
                style={{ background: c === 0 ? `${accent}22` : "transparent" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeckPreviewContent({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center p-3 h-full">
      <div
        className="w-full rounded-[4px] p-3 flex flex-col items-center justify-center"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
      >
        <div className="h-[7px] w-[60%] rounded-sm mb-[6px]" style={{ background: accent }} />
        <div className="h-[4px] w-[75%] rounded-sm bg-[#e0e0e0] mb-[3px]" />
        <div className="h-[4px] w-[55%] rounded-sm bg-[#e8e8e8]" />
        <div className="mt-3 flex gap-2">
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}40` }} />
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}25` }} />
          <div className="w-[18px] h-[12px] rounded-[2px]" style={{ background: `${accent}40` }} />
        </div>
      </div>
    </div>
  );
}

function DiagramPreviewContent({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center p-3 h-full">
      <svg width="100%" height="80" viewBox="0 0 120 80">
        <line x1="60" y1="18" x2="30" y2="48" stroke="#d0d0d0" strokeWidth="1.5" />
        <line x1="60" y1="18" x2="90" y2="48" stroke="#d0d0d0" strokeWidth="1.5" />
        <line x1="30" y1="48" x2="30" y2="70" stroke="#d0d0d0" strokeWidth="1.5" />
        <line x1="90" y1="48" x2="90" y2="70" stroke="#d0d0d0" strokeWidth="1.5" />
        <rect x="45" y="6" width="30" height="18" rx="4" fill={accent} opacity="0.7" />
        <rect x="15" y="40" width="30" height="16" rx="4" fill={accent} opacity="0.45" />
        <rect x="75" y="40" width="30" height="16" rx="4" fill={accent} opacity="0.45" />
        <rect x="17" y="64" width="26" height="12" rx="3" fill={accent} opacity="0.25" />
        <rect x="77" y="64" width="26" height="12" rx="3" fill={accent} opacity="0.25" />
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
