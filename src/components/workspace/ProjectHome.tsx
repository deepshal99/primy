"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Table2, Plus, Clock, Sparkles, ArrowRight, ChevronDown, Check, Settings2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import { PROJECT_TYPES } from "@/lib/constants";

export function ProjectHome() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
  const openKnowledgeUnit = useAppStore((s) => s.openKnowledgeUnit);
  const openTable = useAppStore((s) => s.openTable);
  const createKnowledgeUnit = useAppStore((s) => s.createKnowledgeUnit);
  const createTable = useAppStore((s) => s.createTable);
  const updateProject = useAppStore((s) => s.updateProject);
  const updateProjectMemory = useAppStore((s) => s.updateProjectMemory);
  const projectMemory = useAppStore((s) => s.projectMemory);
  const renameKnowledgeUnit = useAppStore((s) => s.renameKnowledgeUnit);
  const renameTable = useAppStore((s) => s.renameTable);
  const deleteKnowledgeUnit = useAppStore((s) => s.deleteKnowledgeUnit);
  const deleteTable = useAppStore((s) => s.deleteTable);
  const messages = useAppStore((s) => s.messages);

  // Entity rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      // Check if click is inside a menu dropdown
      const target = e.target as HTMLElement;
      if (target.closest("[data-entity-menu]")) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const project = projects.find((p) => p.id === currentProjectId);
  if (!project) return null;

  const entities = [
    ...project.knowledgeUnits.map((k) => ({
      id: k.id,
      title: k.title,
      type: "ku" as const,
      updatedAt: k.updatedAt,
      preview: k.content.replace(/<[^>]+>/g, "").replace(/[#*_~`]/g, "").slice(0, 140).trim(),
    })),
    ...project.tables.map((t) => ({
      id: t.id,
      title: t.title,
      type: "table" as const,
      updatedAt: t.updatedAt,
      preview: getTablePreview(t.sheets),
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  const kuCount = project.knowledgeUnits.length;
  const tableCount = project.tables.length;
  const totalFiles = kuCount + tableCount;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div className="max-w-3xl mx-auto px-8 py-10">

        {/* ── Hero section with editable fields ── */}
        <div className="mb-10">
          {/* Accent bar */}
          <div
            className="w-10 h-1 rounded-full mb-6"
            style={{
              background: `linear-gradient(135deg, ${design.colors.brand.primary}, ${design.colors.accent.purple})`,
            }}
          />

          {/* Editable title */}
          <EditableTitle
            value={project.title}
            onSave={(title) => updateProject(project.id, { title })}
          />

          {/* Editable description */}
          <EditableDescription
            value={project.description || ""}
            onSave={(description) => updateProject(project.id, { description })}
          />

          {/* Type picker + Stats row */}
          <div className="flex items-center gap-3 mt-4">
            <TypePicker
              value={project.projectType}
              onChange={(projectType) => updateProject(project.id, { projectType })}
            />
            <span style={{ color: design.colors.border.default }}>·</span>
            <span
              style={{
                fontSize: "13px",
                color: design.colors.text.muted,
              }}
            >
              {kuCount} {kuCount === 1 ? "doc" : "docs"} · {tableCount} {tableCount === 1 ? "table" : "tables"} · {messages.length} messages
            </span>
          </div>
        </div>

        {/* ── Project Memory / AI Settings ── */}
        <ProjectMemorySection memory={projectMemory} onUpdate={updateProjectMemory} />

        {/* ── Create buttons ── */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => createKnowledgeUnit(project.id, "New Document")}
            className="group flex items-center gap-3 transition-all duration-200"
            style={{
              backgroundColor: design.colors.bg.elevated,
              border: `1.5px solid ${design.colors.border.default}`,
              borderRadius: "14px",
              padding: "14px 20px",
              flex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = design.colors.accent.purple;
              e.currentTarget.style.boxShadow = design.shadows.lg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.default;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: design.colors.accent.purpleSubtle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileText style={{ width: "20px", height: "20px", color: design.colors.accent.purple }} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                  display: "block",
                }}
              >
                New Document
              </span>
              <span style={{ fontSize: "12px", color: design.colors.text.muted }}>
                Rich text & markdown
              </span>
            </div>
            <Plus
              className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0"
              style={{ width: "16px", height: "16px", color: design.colors.text.muted }}
            />
          </button>

          <button
            onClick={() => createTable(project.id, "New Table")}
            className="group flex items-center gap-3 transition-all duration-200"
            style={{
              backgroundColor: design.colors.bg.elevated,
              border: `1.5px solid ${design.colors.border.default}`,
              borderRadius: "14px",
              padding: "14px 20px",
              flex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = design.colors.accent.teal;
              e.currentTarget.style.boxShadow = design.shadows.lg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = design.colors.border.default;
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: design.colors.accent.tealSubtle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Table2 style={{ width: "20px", height: "20px", color: design.colors.accent.teal }} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                  display: "block",
                }}
              >
                New Table
              </span>
              <span style={{ fontSize: "12px", color: design.colors.text.muted }}>
                Spreadsheet & formulas
              </span>
            </div>
            <Plus
              className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0"
              style={{ width: "16px", height: "16px", color: design.colors.text.muted }}
            />
          </button>
        </div>

        {/* ── Files section ── */}
        {entities.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 relative overflow-hidden"
            style={{
              border: `1.5px dashed ${design.colors.border.default}`,
              borderRadius: "14px",
              backgroundColor: design.colors.bg.elevated,
            }}
          >
            <div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${design.colors.accent.purpleSubtle} 0%, transparent 70%)` }}
            />
            <div
              className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${design.colors.accent.tealSubtle} 0%, transparent 70%)` }}
            />
            <Sparkles className="w-7 h-7 mb-4" style={{ color: design.colors.accent.gold }} strokeWidth={1.5} />
            <p style={{ fontSize: "14px", fontWeight: 500, color: design.colors.text.primary, marginBottom: "4px" }}>
              Your workspace awaits
            </p>
            <p style={{ fontSize: "12px", color: design.colors.text.muted, lineHeight: "1.5", maxWidth: "280px", textAlign: "center" }}>
              Create files above, or chat with AI to generate documents and spreadsheets automatically
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: design.colors.text.muted }}>
                Files
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: design.colors.border.light }} />
              <span style={{ fontSize: "11px", color: design.colors.text.placeholder }}>{totalFiles}</span>
            </div>

            {/* File tiles — 2-col grid, Conversion.ai colored-border card style */}
            <div className="grid grid-cols-2 gap-3">
              {entities.map((entity) => {
                const isKu = entity.type === "ku";
                const accent = isKu ? design.colors.accent.purple : design.colors.accent.teal;
                const accentSubtle = isKu ? design.colors.accent.purpleSubtle : design.colors.accent.tealSubtle;
                const typeLabel = isKu ? "Document" : "Spreadsheet";
                const isRenaming = renamingId === entity.id;

                return (
                  <div
                    key={entity.id}
                    className="group relative flex flex-col text-left transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: design.colors.bg.elevated,
                      border: `1.5px solid ${design.colors.border.default}`,
                      borderRadius: "14px",
                      padding: "18px",
                    }}
                    onClick={() => {
                      if (isRenaming || menuOpenId === entity.id) return;
                      if (isKu) openKnowledgeUnit(entity.id);
                      else openTable(entity.id);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = design.colors.border.focus;
                      e.currentTarget.style.boxShadow = design.shadows.md;
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = design.colors.border.default;
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* ··· Menu button */}
                    <div
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      data-entity-menu
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === entity.id ? null : entity.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: menuOpenId === entity.id ? design.colors.bg.tertiary : "transparent" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.tertiary; }}
                        onMouseLeave={(e) => { if (menuOpenId !== entity.id) e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <MoreHorizontal className="w-4 h-4" style={{ color: design.colors.text.muted }} />
                      </button>

                      {menuOpenId === entity.id && (
                        <div
                          className="absolute top-full right-0 mt-1 border rounded-xl py-1 min-w-[140px] z-50"
                          style={{
                            backgroundColor: design.colors.bg.elevated,
                            borderColor: design.colors.border.default,
                            boxShadow: design.shadows.dropdown,
                          }}
                        >
                          <button
                            onClick={() => {
                              setRenamingId(entity.id);
                              setRenameValue(entity.title);
                              setMenuOpenId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
                            style={{ color: design.colors.text.primary }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              if (!window.confirm(`Delete "${entity.title}"? This cannot be undone.`)) return;
                              if (isKu) deleteKnowledgeUnit(project.id, entity.id);
                              else deleteTable(project.id, entity.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
                            style={{ color: "#e54545" }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(229,69,69,0.06)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Header: icon badge + file name */}
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          backgroundColor: accentSubtle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isKu ? (
                          <FileText style={{ width: "18px", height: "18px", color: accent }} strokeWidth={1.8} />
                        ) : (
                          <Table2 style={{ width: "18px", height: "18px", color: accent }} strokeWidth={1.8} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => {
                              if (renameValue.trim() && renameValue.trim() !== entity.title) {
                                if (isKu) renameKnowledgeUnit(project.id, entity.id, renameValue.trim());
                                else renameTable(project.id, entity.id, renameValue.trim());
                              }
                              setRenamingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            className="block w-full bg-transparent outline-none border-b-2 pb-0.5"
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: design.colors.text.primary,
                              fontFamily: design.typography.family.heading,
                              borderColor: design.colors.brand.primary,
                            }}
                          />
                        ) : (
                          <span
                            className="block truncate"
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: design.colors.text.primary,
                              fontFamily: design.typography.family.heading,
                              lineHeight: "1.3",
                            }}
                          >
                            {entity.title}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            color: design.colors.text.muted,
                          }}
                        >
                          {typeLabel} · {formatTimeAgo(entity.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Content preview */}
                    {entity.preview ? (
                      <p
                        className="line-clamp-2"
                        style={{ fontSize: "13px", color: design.colors.text.muted, lineHeight: "1.5" }}
                      >
                        {entity.preview}
                      </p>
                    ) : (
                      <p
                        className="italic"
                        style={{ fontSize: "13px", color: design.colors.text.placeholder }}
                      >
                        Empty {typeLabel.toLowerCase()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── AI tip ── */}
        {totalFiles > 0 && (
          <div
            className="mt-8 flex items-center gap-3"
            style={{
              backgroundColor: design.colors.accent.goldSubtle,
              border: `1.5px solid rgba(229, 149, 62, 0.12)`,
              borderRadius: "14px",
              padding: "14px 20px",
            }}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: design.colors.accent.gold }} />
            <p style={{ fontSize: "13px", color: design.colors.text.secondary }}>
              <span style={{ fontWeight: 600, color: design.colors.accent.goldDark }}>Tip: </span>
              Chat with AI to create, edit, or analyze any file in this project
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════
// ── Inline-editable components ──
// ══════════════════════════════════

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
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full bg-transparent outline-none border-b-2 pb-1"
        style={{
          fontFamily: design.typography.family.heading,
          fontSize: "26px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: design.colors.text.primary,
          borderColor: design.colors.brand.primary,
        }}
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="cursor-text rounded-lg transition-colors hover:bg-black/[0.03] -mx-2 px-2 py-1"
      style={{
        fontFamily: design.typography.family.heading,
        fontSize: "26px",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        color: design.colors.text.primary,
      }}
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
        className="w-full bg-transparent outline-none border-b-2 pb-1 resize-none"
        style={{
          fontSize: "14px",
          lineHeight: "1.6",
          color: design.colors.text.secondary,
          borderColor: design.colors.brand.primary,
          minHeight: "24px",
        }}
        placeholder="Add a project description..."
      />
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className="cursor-text rounded-lg transition-colors hover:bg-black/[0.03] -mx-2 px-2 py-1 mt-1"
      style={{
        fontSize: "14px",
        lineHeight: "1.6",
        color: value ? design.colors.text.secondary : design.colors.text.placeholder,
      }}
      title="Click to edit description"
    >
      {value || "Add a project description..."}
    </p>
  );
}

function TypePicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors"
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: value ? design.colors.text.secondary : design.colors.text.placeholder,
          backgroundColor: design.colors.bg.secondary,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.tertiary; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.secondary; }}
      >
        {value || "Set type"}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 border rounded-xl py-1 min-w-[140px] animate-scale-in"
          style={{
            backgroundColor: design.colors.bg.elevated,
            borderColor: design.colors.border.default,
            boxShadow: design.shadows.dropdown,
          }}
        >
          {PROJECT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => { onChange(type); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
              style={{ color: design.colors.text.primary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <span className="flex-1">{type}</span>
              {value === type && <Check className="w-3.5 h-3.5" style={{ color: design.colors.brand.primary }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function getColumnHeaders(sheets: { celldata: { r: number; c: number; v: { v?: string | number } }[] }[]): string[] {
  if (!sheets[0]?.celldata?.length) return [];
  return sheets[0].celldata
    .filter((c) => c.r === 0)
    .sort((a, b) => a.c - b.c)
    .map((c) => String(c.v?.v || ""))
    .filter(Boolean);
}

function getTablePreview(sheets: { celldata: { r: number; c: number; v: { v?: string | number } }[] }[]): string {
  const headers = getColumnHeaders(sheets);
  if (headers.length === 0) return "";
  return headers.slice(0, 4).join(" · ") + (headers.length > 4 ? ` +${headers.length - 4} more` : "");
}

const TONE_OPTIONS = ["Casual", "Formal", "Technical", "Friendly", "Professional", "Creative"];

function ProjectMemorySection({
  memory,
  onUpdate,
}: {
  memory: { tone?: string; audience?: string; goals?: string; customInstructions?: string };
  onUpdate: (m: Partial<typeof memory>) => void;
}) {
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAnyField = !!(memory.tone || memory.audience || memory.goals || memory.customInstructions);

  const debouncedUpdate = useCallback(
    (field: string, value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate({ [field]: value || undefined });
      }, 500);
    },
    [onUpdate]
  );

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          fontSize: "13px",
          fontWeight: 500,
          color: hasAnyField ? design.colors.text.secondary : design.colors.text.muted,
          backgroundColor: open ? design.colors.bg.secondary : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = design.colors.bg.secondary;
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Settings2 className="w-3.5 h-3.5" />
        AI Settings
        {hasAnyField && !open && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: design.colors.brand.primary }}
          />
        )}
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>

      {open && (
        <div
          className="mt-3 rounded-xl border p-5 grid gap-4"
          style={{
            backgroundColor: design.colors.bg.elevated,
            borderColor: design.colors.border.default,
          }}
        >
          {/* Tone */}
          <div>
            <label
              className="block mb-1.5"
              style={{ fontSize: "12px", fontWeight: 600, color: design.colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Tone
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdate({ tone: memory.tone === t ? undefined : t })}
                  className="px-3 py-1 rounded-lg text-[13px] transition-colors"
                  style={{
                    backgroundColor: memory.tone === t ? design.colors.brand.primary : design.colors.bg.secondary,
                    color: memory.tone === t ? "#fff" : design.colors.text.secondary,
                    fontWeight: memory.tone === t ? 600 : 400,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label
              className="block mb-1.5"
              style={{ fontSize: "12px", fontWeight: 600, color: design.colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Audience
            </label>
            <input
              defaultValue={memory.audience || ""}
              onChange={(e) => debouncedUpdate("audience", e.target.value)}
              placeholder="e.g. developers, executives, general public..."
              className="w-full px-3 py-2 rounded-lg outline-none transition-colors text-[13px]"
              style={{
                backgroundColor: design.colors.bg.secondary,
                color: design.colors.text.primary,
                border: `1px solid ${design.colors.border.default}`,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; }}
            />
          </div>

          {/* Goals */}
          <div>
            <label
              className="block mb-1.5"
              style={{ fontSize: "12px", fontWeight: 600, color: design.colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Goals
            </label>
            <textarea
              defaultValue={memory.goals || ""}
              onChange={(e) => debouncedUpdate("goals", e.target.value)}
              placeholder="What are you trying to achieve with this project?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg outline-none transition-colors text-[13px] resize-none"
              style={{
                backgroundColor: design.colors.bg.secondary,
                color: design.colors.text.primary,
                border: `1px solid ${design.colors.border.default}`,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; }}
            />
          </div>

          {/* Custom Instructions */}
          <div>
            <label
              className="block mb-1.5"
              style={{ fontSize: "12px", fontWeight: 600, color: design.colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Custom Instructions
            </label>
            <textarea
              defaultValue={memory.customInstructions || ""}
              onChange={(e) => debouncedUpdate("customInstructions", e.target.value)}
              placeholder="Any specific instructions for the AI when working on this project..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg outline-none transition-colors text-[13px] resize-none"
              style={{
                backgroundColor: design.colors.bg.secondary,
                color: design.colors.text.primary,
                border: `1px solid ${design.colors.border.default}`,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = design.colors.brand.primary; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = design.colors.border.default; }}
            />
          </div>

          <p style={{ fontSize: "11px", color: design.colors.text.placeholder, lineHeight: "1.4" }}>
            These settings help the AI tailor responses for this project. Changes are saved automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
