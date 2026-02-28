"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { FileText, Table2, GitBranch, Presentation, Pen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import type { KnowledgeUnit, ProjectTable, ProjectDiagram, ProjectDeck } from "@/lib/types";

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
  // Entity rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  // Build entity list with full data for previews
  // Must be above the early return to keep hook order stable
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

  if (!project) return null;

  const kuCount = project.knowledgeUnits.length;
  const tableCount = project.tables.length;
  const diagramCount = (project.diagrams || []).length;
  const deckCount = (project.decks || []).length;
  const totalFiles = kuCount + tableCount + diagramCount + deckCount;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div className="max-w-3xl mx-auto px-8 py-8">

        {/* ── Hero section ── */}
        <div className="mb-8">
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

        </div>

        {/* ── Files ── */}
        <div>
          {/* Header row: label + create buttons */}
          <div className="flex items-center gap-2 mb-4">
            <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: design.colors.text.muted }}>
              Files
            </span>
            {totalFiles > 0 && (
              <span style={{ fontSize: "11px", color: design.colors.text.placeholder }}>{totalFiles}</span>
            )}
            <div className="flex-1" />
            <div className="flex gap-1">
              <CreatePill icon={<FileText className="w-3 h-3" />} label="Doc" color={design.colors.entity.doc} onClick={() => createKnowledgeUnit(project.id, "New Document")} />
              <CreatePill icon={<Table2 className="w-3 h-3" />} label="Table" color={design.colors.entity.sheet} onClick={() => createTable(project.id, "New Table")} />
              <CreatePill icon={<GitBranch className="w-3 h-3" />} label="Diagram" color={design.colors.entity.diagram} onClick={() => createDiagram(project.id, "New Diagram")} />
              <CreatePill icon={<Presentation className="w-3 h-3" />} label="Deck" color={design.colors.entity.deck} onClick={() => createDeck(project.id, "New Deck")} />
            </div>
          </div>

          {entities.length === 0 ? (
            <div className="py-6">
              <div
                className="flex flex-col items-center justify-center py-10 mb-6"
                style={{
                  borderRadius: "12px",
                  backgroundColor: design.colors.bg.secondary,
                  border: `1px solid ${design.colors.border.light}`,
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    backgroundColor: design.colors.accent.goldSubtle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <Pen className="w-5 h-5" style={{ color: design.colors.accent.gold }} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: "15px", fontWeight: 600, color: design.colors.text.primary, marginBottom: "6px", fontFamily: design.typography.family.heading }}>
                  Get started
                </p>
                <p style={{ fontSize: "13px", color: design.colors.text.muted, lineHeight: "1.5", maxWidth: "300px", textAlign: "center" }}>
                  Create your first file or ask AI to build something for you.
                </p>
              </div>

              {/* Quick start action cards */}
              <div className="grid grid-cols-4 gap-3">
                <QuickStartCard
                  icon={<FileText className="w-5 h-5" />}
                  label="Document"
                  desc="Notes, drafts, plans"
                  color={design.colors.entity.doc}
                  bg={design.colors.entity.docBg}
                  onClick={() => createKnowledgeUnit(project.id, "New Document")}
                />
                <QuickStartCard
                  icon={<Table2 className="w-5 h-5" />}
                  label="Spreadsheet"
                  desc="Tables, trackers, data"
                  color={design.colors.entity.sheet}
                  bg={design.colors.entity.sheetBg}
                  onClick={() => createTable(project.id, "New Table")}
                />
                <QuickStartCard
                  icon={<GitBranch className="w-5 h-5" />}
                  label="Diagram"
                  desc="Flowcharts, charts"
                  color={design.colors.entity.diagram}
                  bg={design.colors.entity.diagramBg}
                  onClick={() => createDiagram(project.id, "New Diagram")}
                />
                <QuickStartCard
                  icon={<Presentation className="w-5 h-5" />}
                  label="Deck"
                  desc="Slides, presentations"
                  color={design.colors.entity.deck}
                  bg={design.colors.entity.deckBg}
                  onClick={() => createDeck(project.id, "New Deck")}
                />
              </div>

              {/* AI suggestion */}
              <button
                onClick={() => window.dispatchEvent(new Event("drafta:focus-chat"))}
                className="w-full mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150"
                style={{
                  backgroundColor: design.colors.bg.elevated,
                  borderColor: design.colors.border.default,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = design.colors.brand.primary;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${design.colors.brand.subtle}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = design.colors.border.default;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: design.colors.brand.subtle }}
                >
                  <Pen className="w-4 h-4" style={{ color: design.colors.brand.primary }} strokeWidth={1.8} />
                </div>
                <div className="text-left">
                  <p style={{ fontSize: "13px", fontWeight: 600, color: design.colors.text.primary }}>Ask AI to build something</p>
                  <p style={{ fontSize: "11px", color: design.colors.text.muted }}>Describe what you need in the chat</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => {
                const isKu = entity.type === "ku";
                const isDiagram = entity.type === "diagram";
                const isDeck = entity.type === "deck";
                const accent = isDeck ? design.colors.entity.deck : isDiagram ? design.colors.entity.diagram : isKu ? design.colors.entity.doc : design.colors.entity.sheet;
                const accentBg = isDeck ? design.colors.entity.deckBg : isDiagram ? design.colors.entity.diagramBg : isKu ? design.colors.entity.docBg : design.colors.entity.sheetBg;

                return (
                  <FileCard
                    key={entity.id}
                    entity={entity}
                    accent={accent}
                    accentBg={accentBg}
                    onOpen={() => {
                      if (isDeck) openDeck(entity.id);
                      else if (isDiagram) openDiagram(entity.id);
                      else if (isKu) openKnowledgeUnit(entity.id);
                      else openTable(entity.id);
                    }}
                    onRename={(name) => {
                      if (isDeck) renameDeck(project.id, entity.id, name);
                      else if (isDiagram) renameDiagram(project.id, entity.id, name);
                      else if (isKu) renameKnowledgeUnit(project.id, entity.id, name);
                      else renameTable(project.id, entity.id, name);
                    }}
                    onDelete={() => {
                      if (!window.confirm(`Delete "${entity.title}"? This cannot be undone.`)) return;
                      if (isDeck) deleteDeck(project.id, entity.id);
                      else if (isDiagram) deleteDiagram(project.id, entity.id);
                      else if (isKu) deleteKnowledgeUnit(project.id, entity.id);
                      else deleteTable(project.id, entity.id);
                    }}
                    isRenaming={renamingId === entity.id}
                    startRename={() => { setRenamingId(entity.id); setRenameValue(entity.title); }}
                    stopRename={() => setRenamingId(null)}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    menuOpen={menuOpenId === entity.id}
                    toggleMenu={() => setMenuOpenId(menuOpenId === entity.id ? null : entity.id)}
                    closeMenu={() => setMenuOpenId(null)}
                  />
                );
              })}
            </div>
          )}
        </div>
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
          fontSize: "32px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
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
        fontSize: "32px",
        fontWeight: 700,
        letterSpacing: "-0.03em",
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

// ── File components ──

interface FileEntity {
  id: string;
  title: string;
  type: "ku" | "table" | "diagram" | "deck";
  updatedAt: number;
  data: KnowledgeUnit | ProjectTable | ProjectDiagram | ProjectDeck;
}

/* ── Preview content extractors ── */

function getDocPreview(data: KnowledgeUnit): string {
  // Strip HTML tags and get plain text
  const text = data.content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 200);
}

function getTablePreview(data: ProjectTable): { headers: string[]; rows: string[][] } {
  const sheet = data.sheets?.[0];
  if (!sheet?.celldata) return { headers: [], rows: [] };
  // Build a simple grid from celldata
  const cells: Record<string, string> = {};
  for (const cell of sheet.celldata) {
    const r = cell.r;
    const c = cell.c;
    const val = cell.v?.v ?? cell.v?.m ?? "";
    cells[`${r}-${c}`] = String(val);
  }
  const maxCols = Math.min(4, Math.max(...sheet.celldata.map((c: any) => c.c)) + 1);
  const maxRows = Math.min(4, Math.max(...sheet.celldata.map((c: any) => c.r)) + 1);
  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    headers.push(cells[`0-${c}`] || "");
  }
  const rows: string[][] = [];
  for (let r = 1; r < maxRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      row.push(cells[`${r}-${c}`] || "");
    }
    rows.push(row);
  }
  return { headers, rows };
}

function getDiagramPreview(data: ProjectDiagram): string {
  return data.source?.slice(0, 160) || "";
}

function getDeckPreview(data: ProjectDeck): { title: string; subtitle: string } {
  const first = data.slides?.[0];
  if (!first) return { title: "", subtitle: "" };
  return {
    title: first.title || "",
    subtitle: first.subtitle || first.content?.slice(0, 80) || "",
  };
}

/* ── Card-based file preview ── */

function FileCard({
  entity,
  accent,
  accentBg,
  onOpen,
  onRename,
  onDelete,
  isRenaming,
  startRename,
  stopRename,
  renameValue,
  setRenameValue,
  menuOpen,
  toggleMenu,
  closeMenu,
}: {
  entity: FileEntity;
  accent: string;
  accentBg: string;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isRenaming: boolean;
  startRename: () => void;
  stopRename: () => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  menuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}) {
  const Icon = entity.type === "deck" ? Presentation
    : entity.type === "diagram" ? GitBranch
    : entity.type === "ku" ? FileText
    : Table2;

  const typeLabel = entity.type === "ku" ? "Document"
    : entity.type === "table" ? "Spreadsheet"
    : entity.type === "diagram" ? "Diagram"
    : "Deck";

  return (
    <div
      className="group relative flex flex-col rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden"
      style={{
        backgroundColor: accentBg,
        borderColor: design.colors.border.light,
      }}
      onClick={() => {
        if (!isRenaming && !menuOpen) onOpen();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.default;
        e.currentTarget.style.boxShadow = design.shadows.md;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.light;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Preview area */}
      <div
        className="relative mx-2.5 mt-2.5 rounded-lg overflow-hidden"
        style={{
          backgroundColor: design.colors.bg.elevated,
          height: "120px",
        }}
      >
        <div className="p-3 h-full overflow-hidden text-[10px] leading-[1.5] select-none pointer-events-none" style={{ color: design.colors.text.muted }}>
          {entity.type === "ku" && (
            <DocPreviewContent data={entity.data as KnowledgeUnit} />
          )}
          {entity.type === "table" && (
            <TablePreviewContent data={entity.data as ProjectTable} accent={accent} />
          )}
          {entity.type === "diagram" && (
            <DiagramPreviewContent data={entity.data as ProjectDiagram} accent={accent} />
          )}
          {entity.type === "deck" && (
            <DeckPreviewContent data={entity.data as ProjectDeck} />
          )}
        </div>
        {/* Fade overlay at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8"
          style={{
            background: `linear-gradient(to bottom, transparent, ${design.colors.bg.elevated})`,
          }}
        />
      </div>

      {/* Footer: icon + name + menu */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: accentBg }}
        >
          <Icon className="w-3 h-3" style={{ color: accent }} strokeWidth={2} />
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
                  onRename(renameValue.trim());
                }
                stopRename();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") stopRename();
              }}
              className="block w-full bg-transparent outline-none border-b-2 pb-0.5"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: design.colors.text.primary,
                fontFamily: design.typography.family.heading,
                borderColor: accent,
              }}
            />
          ) : (
            <>
              <span
                className="block truncate"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: design.colors.text.primary,
                  fontFamily: design.typography.family.heading,
                  lineHeight: "1.3",
                }}
              >
                {entity.title}
              </span>
              <span style={{ fontSize: "10px", color: design.colors.text.muted }}>
                {typeLabel}
              </span>
            </>
          )}
        </div>

        {/* Context menu */}
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          data-entity-menu
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={toggleMenu}
            className="p-1 rounded-md transition-colors"
            style={{ backgroundColor: menuOpen ? design.colors.bg.tertiary : "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.tertiary; }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <MoreHorizontal className="w-4 h-4" style={{ color: design.colors.text.muted }} />
          </button>

          {menuOpen && (
            <div
              className="absolute bottom-12 right-2 border rounded-lg py-1 min-w-[140px] z-50"
              style={{
                backgroundColor: design.colors.bg.elevated,
                borderColor: design.colors.border.default,
                boxShadow: design.shadows.dropdown,
              }}
            >
              <button
                onClick={() => { startRename(); closeMenu(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
                style={{ color: design.colors.text.primary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                onClick={() => { closeMenu(); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
                style={{ color: design.colors.status.error }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.status.errorBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Preview content components ── */

function DocPreviewContent({ data }: { data: KnowledgeUnit }) {
  const text = getDocPreview(data);
  if (!text) return <span className="italic opacity-50">Empty document</span>;
  return (
    <div style={{ fontFamily: design.typography.family.sans, fontSize: "10px", lineHeight: "1.6", color: design.colors.text.secondary }}>
      {text}
    </div>
  );
}

function TablePreviewContent({ data, accent }: { data: ProjectTable; accent: string }) {
  const { headers, rows } = getTablePreview(data);
  if (headers.length === 0) return <span className="italic opacity-50">Empty spreadsheet</span>;
  return (
    <table className="w-full border-collapse" style={{ fontSize: "9px" }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className="text-left px-1.5 py-1 border-b truncate max-w-[80px]"
              style={{ borderColor: `${accent}20`, fontWeight: 600, color: design.colors.text.secondary }}
            >
              {h || "\u00A0"}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                className="px-1.5 py-0.5 border-b truncate max-w-[80px]"
                style={{ borderColor: `${accent}10`, color: design.colors.text.muted }}
              >
                {cell || "\u00A0"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiagramPreviewContent({ data, accent }: { data: ProjectDiagram; accent: string }) {
  const preview = getDiagramPreview(data);
  if (!preview) return <span className="italic opacity-50">Empty diagram</span>;
  return (
    <pre
      className="whitespace-pre-wrap"
      style={{
        fontFamily: design.typography.family.mono,
        fontSize: "9px",
        lineHeight: "1.5",
        color: accent,
        opacity: 0.7,
      }}
    >
      {preview}
    </pre>
  );
}

function DeckPreviewContent({ data }: { data: ProjectDeck }) {
  const { title, subtitle } = getDeckPreview(data);
  if (!title && !subtitle) return <span className="italic opacity-50">Empty deck</span>;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-2">
      {title && (
        <div style={{ fontSize: "12px", fontWeight: 700, color: design.colors.text.primary, fontFamily: design.typography.family.heading, lineHeight: "1.3", marginBottom: "4px" }}>
          {title}
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: "9px", color: design.colors.text.muted, lineHeight: "1.4" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function QuickStartCard({
  icon, label, desc, color, bg, onClick,
}: {
  icon: React.ReactNode; label: string; desc: string; color: string; bg: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-150"
      style={{
        backgroundColor: design.colors.bg.elevated,
        borderColor: design.colors.border.default,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${bg}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.default;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: bg, color }}
      >
        {icon}
      </div>
      <div className="text-center">
        <p style={{ fontSize: "13px", fontWeight: 600, color: design.colors.text.primary, fontFamily: design.typography.family.heading }}>
          {label}
        </p>
        <p style={{ fontSize: "11px", color: design.colors.text.muted, marginTop: "2px" }}>
          {desc}
        </p>
      </div>
    </button>
  );
}

function CreatePill({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-150 border"
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: design.colors.text.secondary,
        borderColor: design.colors.border.default,
        backgroundColor: design.colors.bg.elevated,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.color = color;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${color}12`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.default;
        e.currentTarget.style.color = design.colors.text.secondary;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

