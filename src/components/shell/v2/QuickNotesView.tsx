"use client";

/**
 * QuickNotesView — frictionless capture. A two-pane "Apple Notes"-style surface
 * over the dedicated Quick Notes workspace: a notes rail on the left, the real
 * doc editor (WorkspacePanel) on the right. Reuses the entity/editor/autosave
 * machinery wholesale — a quick note is just a KnowledgeUnit in one workspace,
 * so it gets project memory + AI chat for free. No new editor, no whiteboard.
 */

import { useEffect, useMemo, useState } from "react";
import { PenLine, Plus, Search, Trash2, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";

const CANDY = ["#FFB43F", "#4285F4", "#8757D7", "#67CEC8", "#F073A7", "#42C366"];
function wsDot(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CANDY[h % CANDY.length];
}

function stripText(s: string): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function noteTitle(title: string, content: string): string {
  const t = (title || "").trim();
  if (t) return t;
  const firstLine = stripText(content).slice(0, 60);
  return firstLine || "Untitled note";
}
function notePreview(title: string, content: string): string {
  const body = stripText(content);
  const t = (title || "").trim();
  const rest = t && body.startsWith(t) ? body.slice(t.length).trim() : body;
  return rest || "No additional text";
}
function relTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function QuickNotesView({ projectId, onExit }: { projectId: string; onExit: () => void }) {
  const projects = useAppStore((s) => s.projects);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const isLoadingProject = useAppStore((s) => s.isLoadingProject);
  const [q, setQ] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);

  // Workspaces a note can be promoted into (everything except Quick Notes itself).
  const targets = useMemo(() => projects.filter((p) => p.id !== projectId), [projects, projectId]);

  function moveTo(targetId: string, targetTitle: string) {
    const s = useAppStore.getState();
    const noteId = s.currentEntityId;
    if (!noteId) return;
    setMoveOpen(false);
    // Local move is synchronous + optimistic; server sync runs in the
    // background, so navigation lands the user on the note instantly.
    s.moveKnowledgeUnitToProject(noteId, targetId);
    s.switchProject(targetId);
    s.openKnowledgeUnit(noteId);
    onExit();
    toast.success(`Moved to ${targetTitle || "workspace"}`);
  }

  const project = projects.find((p) => p.id === projectId);
  const notes = useMemo(() => {
    const list = (project?.knowledgeUnits || []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((k) => noteTitle(k.title, k.content).toLowerCase().includes(needle) || stripText(k.content).toLowerCase().includes(needle));
  }, [project, q]);

  const newNote = () => {
    const s = useAppStore.getState();
    const ku = s.createKnowledgeUnit(projectId, "");
    s.openKnowledgeUnit(ku.id);
  };

  // First visit with notes but nothing selected → open the most recent so the
  // editor is never awkwardly blank next to a full list.
  useEffect(() => {
    if (!currentEntityId && notes.length > 0) {
      useAppStore.getState().openKnowledgeUnit(notes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, notes.length]);

  const editorOpen = !!currentEntityId && currentEntityType === "ku" && notes.some((n) => n.id === currentEntityId);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Notes rail */}
      <aside className="flex flex-col flex-shrink-0 w-[280px] min-h-0" style={{ background: "var(--card)", borderRight: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 h-[60px] px-4 flex-shrink-0">
          <PenLine size={17} style={{ color: "var(--icon)" }} />
          <span className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>Quick Notes</span>
          <button onClick={newNote} title="New note"
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-[8px] press"
            style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--ink-2)" }}>
            <Plus size={16} />
          </button>
        </div>

        {(project?.knowledgeUnits.length ?? 0) > 0 && (
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 h-[32px] px-2.5 rounded-[8px]" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
              <Search size={13} style={{ color: "var(--ink-4)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes"
                className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px]" style={{ color: "var(--ink)" }} />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto v2-scroll px-2 pb-3">
          {notes.length === 0 && !isLoadingProject ? (
            <div className="px-3 py-8 text-center text-[12.5px]" style={{ color: "var(--ink-4)" }}>
              {q ? "No matching notes." : "No notes yet."}
            </div>
          ) : (
            notes.map((n) => {
              const active = n.id === currentEntityId;
              return (
                <div key={n.id} role="button" tabIndex={0}
                  onClick={() => useAppStore.getState().openKnowledgeUnit(n.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") useAppStore.getState().openKnowledgeUnit(n.id); }}
                  className="group relative px-3 py-2.5 rounded-[10px] mb-0.5 cursor-pointer t-fast"
                  style={{ background: active ? "var(--accent-soft)" : "transparent" }}>
                  <div className="text-[13px] font-semibold truncate pr-5" style={{ color: "var(--ink)" }}>{noteTitle(n.title, n.content)}</div>
                  <div className="text-[12px] truncate mt-0.5" style={{ color: "var(--ink-3)" }}>{notePreview(n.title, n.content)}</div>
                  <div className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--ink-4)" }}>{relTime(n.updatedAt)}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm("Delete this note?")) useAppStore.getState().deleteKnowledgeUnit(projectId, n.id); }}
                    title="Delete note"
                    className="absolute right-2 top-2 flex items-center justify-center w-6 h-6 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity press"
                    style={{ color: "var(--ink-4)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 min-w-0 min-h-0">
        {editorOpen ? (
          <div className="h-full flex flex-col min-h-0">
            {/* Slim header — autosave hint + promote-to-workspace */}
            <div className="flex items-center gap-3 h-[52px] px-7 flex-shrink-0">
              <span className="text-[12px]" style={{ color: "var(--ink-4)" }}>Quick note · autosaved</span>
              <div className="flex-1" />
              <div className="relative">
                <button onClick={() => setMoveOpen((v) => !v)}
                  disabled={targets.length === 0}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[13px] font-medium press hover-row disabled:opacity-40"
                  style={{ color: "var(--ink-2)", border: "1px solid var(--border)", background: "var(--card)" }}
                  title={targets.length === 0 ? "Create a workspace first" : "Move this note into a workspace"}>
                  <FolderInput size={14} /> Move to workspace
                </button>
                {moveOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoveOpen(false)} />
                    <div className="absolute right-0 top-10 z-50 w-60 rounded-[11px] p-1.5 max-h-[320px] overflow-y-auto v2-scroll"
                      style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                      <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--ink-4)" }}>Move to…</div>
                      {targets.map((p) => (
                        <button key={p.id} onClick={() => moveTo(p.id, p.title || "Untitled")}
                          className="flex items-center gap-2.5 w-full h-9 px-2.5 rounded-[8px] text-[13px] press hover-row" style={{ color: "var(--ink-2)" }}>
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: wsDot(p.id) }} />
                          <span className="truncate">{p.title || "Untitled"}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 px-4 pb-4 pr-3">
              <div className="h-full overflow-hidden rounded-[14px]" style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)" }}>
                <WorkspacePanel hideActions />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="flex items-center justify-center w-16 h-16 rounded-[18px]" style={{ background: "var(--accent-soft)", color: "var(--ink-4)" }}>
              <PenLine size={26} />
            </span>
            <div>
              <div className="text-[16px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>Capture a thought</div>
              <p className="text-[13px] mt-1.5 max-w-[340px]" style={{ color: "var(--ink-3)" }}>
                A scratch space that never gets in your way. Jot it now — promote it into a real workspace later.
              </p>
            </div>
            <button onClick={newNote}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[9px] text-[13px] font-medium press lift"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Plus size={16} /> New note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
