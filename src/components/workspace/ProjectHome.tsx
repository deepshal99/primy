"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Table2, GitBranch, Presentation, Pen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";

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
  if (!project) return null;

  const entities = [
    ...project.knowledgeUnits.map((k) => ({
      id: k.id,
      title: k.title,
      type: "ku" as const,
      updatedAt: k.updatedAt,
    })),
    ...project.tables.map((t) => ({
      id: t.id,
      title: t.title,
      type: "table" as const,
      updatedAt: t.updatedAt,
    })),
    ...(project.diagrams || []).map((d) => ({
      id: d.id,
      title: d.title,
      type: "diagram" as const,
      updatedAt: d.updatedAt,
    })),
    ...(project.decks || []).map((d) => ({
      id: d.id,
      title: d.title,
      type: "deck" as const,
      updatedAt: d.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

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
      <div className="max-w-3xl mx-auto px-8 py-10">

        {/* ── Hero section ── */}
        <div className="mb-10">
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
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: design.colors.text.muted }}>
              Files
            </span>
            {totalFiles > 0 && (
              <span style={{ fontSize: "11px", color: design.colors.text.placeholder }}>{totalFiles}</span>
            )}
            <div className="flex-1" />
            <div className="flex gap-1">
              <CreatePill icon={<FileText className="w-3 h-3" />} label="Doc" color={design.colors.accent.purple} onClick={() => createKnowledgeUnit(project.id, "New Document")} />
              <CreatePill icon={<Table2 className="w-3 h-3" />} label="Table" color={design.colors.accent.teal} onClick={() => createTable(project.id, "New Table")} />
              <CreatePill icon={<GitBranch className="w-3 h-3" />} label="Diagram" color={design.colors.accent.gold} onClick={() => createDiagram(project.id, "New Diagram")} />
              <CreatePill icon={<Presentation className="w-3 h-3" />} label="Deck" color={design.colors.accent.blue} onClick={() => createDeck(project.id, "New Deck")} />
            </div>
          </div>

          {entities.length === 0 ? (
            <div className="py-6">
              <div
                className="flex flex-col items-center justify-center py-10 mb-6"
                style={{
                  borderRadius: "14px",
                  backgroundColor: design.colors.bg.elevated,
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
                  color={design.colors.accent.purple}
                  bg={design.colors.accent.purpleSubtle}
                  onClick={() => createKnowledgeUnit(project.id, "New Document")}
                />
                <QuickStartCard
                  icon={<Table2 className="w-5 h-5" />}
                  label="Spreadsheet"
                  desc="Tables, trackers, data"
                  color={design.colors.accent.teal}
                  bg={design.colors.accent.tealSubtle}
                  onClick={() => createTable(project.id, "New Table")}
                />
                <QuickStartCard
                  icon={<GitBranch className="w-5 h-5" />}
                  label="Diagram"
                  desc="Flowcharts, charts"
                  color={design.colors.accent.gold}
                  bg={design.colors.accent.goldSubtle}
                  onClick={() => createDiagram(project.id, "New Diagram")}
                />
                <QuickStartCard
                  icon={<Presentation className="w-5 h-5" />}
                  label="Deck"
                  desc="Slides, presentations"
                  color={design.colors.accent.blue}
                  bg={design.colors.accent.blueSubtle}
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
            <div className="flex flex-col gap-2">
              {entities.map((entity) => {
                const isKu = entity.type === "ku";
                const isDiagram = entity.type === "diagram";
                const isDeck = entity.type === "deck";
                const accent = isDeck ? design.colors.accent.blue : isDiagram ? design.colors.accent.gold : isKu ? design.colors.accent.purple : design.colors.accent.teal;
                const accentSubtle = isDeck ? design.colors.accent.blueSubtle : isDiagram ? design.colors.accent.goldSubtle : isKu ? design.colors.accent.purpleSubtle : design.colors.accent.tealSubtle;

                return (
                  <FileRow
                    key={entity.id}
                    entity={entity}
                    accent={accent}
                    accentSubtle={accentSubtle}
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
}

function FileRow({
  entity,
  accent,
  accentSubtle,
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
  accentSubtle: string;
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
  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 relative rounded-xl border"
      style={{
        backgroundColor: design.colors.bg.elevated,
        borderColor: design.colors.border.default,
      }}
      onClick={() => {
        if (!isRenaming && !menuOpen) onOpen();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.focus;
        e.currentTarget.style.boxShadow = design.shadows.sm;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = design.colors.border.default;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ backgroundColor: accentSubtle }}
      >
        {entity.type === "deck" ? (
          <Presentation className="w-4 h-4" style={{ color: accent }} strokeWidth={1.8} />
        ) : entity.type === "diagram" ? (
          <GitBranch className="w-4 h-4" style={{ color: accent }} strokeWidth={1.8} />
        ) : entity.type === "ku" ? (
          <FileText className="w-4 h-4" style={{ color: accent }} strokeWidth={1.8} />
        ) : (
          <Table2 className="w-4 h-4" style={{ color: accent }} strokeWidth={1.8} />
        )}
      </div>

      {/* Content */}
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
        )}
      </div>

      {/* Timestamp */}
      <span
        className="flex-shrink-0 text-right hidden sm:block"
        style={{ fontSize: "11px", color: design.colors.text.placeholder, minWidth: "60px" }}
      >
        {formatTimeAgo(entity.updatedAt)}
      </span>

      {/* Menu */}
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
            className="absolute top-full right-4 mt-1 border rounded-xl py-1 min-w-[140px] z-50"
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
      className="flex flex-col items-center gap-2 p-5 rounded-xl border transition-all duration-150"
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

// ── Helpers ──

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
