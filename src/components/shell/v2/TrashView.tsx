"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Trash2, RotateCcw, FileText, Table2, Presentation, LayoutTemplate, Folder as FolderIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { confirmDialog } from "@/lib/confirm";

interface TrashItem {
  type: "project" | "ku" | "table" | "deck" | "page" | "folder";
  id: string;
  title: string;
  projectTitle?: string;
  deletedAt: number | null;
}

const TYPE_META: Record<TrashItem["type"], { Icon: typeof FileText; label: string }> = {
  project: { Icon: FolderIcon, label: "Workspace" },
  ku: { Icon: FileText, label: "Document" },
  table: { Icon: Table2, label: "Sheet" },
  deck: { Icon: Presentation, label: "Deck" },
  page: { Icon: LayoutTemplate, label: "Page" },
  folder: { Icon: FolderIcon, label: "Folder" },
};

function relTime(ms: number | null): string {
  if (!ms) return "";
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function TrashView({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadProjects = useAppStore((s) => s.loadProjects);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/trash");
      const data = await r.json();
      const projects: TrashItem[] = (data.projects || []).map((p: { id: string; title: string; deletedAt: number | null }) => ({
        type: "project" as const,
        id: p.id,
        title: p.title,
        deletedAt: p.deletedAt,
      }));
      setItems([...projects, ...(data.items || [])]);
    } catch {
      toast.error("Couldn't load Trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRestore = async (it: TrashItem) => {
    setBusyId(it.id);
    try {
      const r = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: it.type, id: it.id }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Restore failed");
      setItems((prev) => prev.filter((x) => !(x.id === it.id && x.type === it.type)));
      toast.success(`Restored "${it.title}"`);
      if (it.type === "project") loadProjects();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (it: TrashItem) => {
    const ok = await confirmDialog({
      title: `Permanently delete "${it.title}"?`,
      message: "This can't be undone.",
      confirmLabel: "Delete permanently",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(it.id);
    try {
      const r = await fetch(`/api/trash?type=${it.type}&id=${encodeURIComponent(it.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Delete failed");
      setItems((prev) => prev.filter((x) => !(x.id === it.id && x.type === it.type)));
      toast.success("Permanently deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto v2-scroll" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-[760px] px-6 py-8">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-[13px] press mb-5"
          style={{ color: "var(--ink-3)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="flex items-center gap-2.5 mb-1">
          <Trash2 size={20} style={{ color: "var(--ink-2)" }} />
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>Trash</h1>
        </div>
        <p className="text-[13px] mb-6" style={{ color: "var(--ink-3)" }}>
          Deleted items are kept for 30 days, then removed for good.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-[13px] py-8" style={{ color: "var(--ink-3)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center py-16"
            style={{ color: "var(--ink-3)" }}
          >
            <Trash2 size={28} className="mb-3 opacity-50" />
            <p className="text-[14px] font-medium" style={{ color: "var(--ink-2)" }}>Trash is empty</p>
            <p className="text-[12.5px] mt-1">Deleted docs, sheets, decks, and workspaces show up here.</p>
          </div>
        ) : (
          <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            {items.map((it, i) => {
              const meta = TYPE_META[it.type];
              const busy = busyId === it.id;
              return (
                <div
                  key={`${it.type}:${it.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover-row"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                >
                  <meta.Icon size={16} style={{ color: "var(--icon)" }} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{it.title || "Untitled"}</p>
                    <p className="text-[11.5px] truncate" style={{ color: "var(--ink-3)" }}>
                      {meta.label}
                      {it.projectTitle ? ` · ${it.projectTitle}` : ""}
                      {it.deletedAt ? ` · deleted ${relTime(it.deletedAt)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(it)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium press disabled:opacity-50"
                    style={{ background: "var(--secondary)", color: "var(--ink)" }}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Restore
                  </button>
                  <button
                    onClick={() => handlePurge(it)}
                    disabled={busy}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-[8px] press disabled:opacity-50 hover:bg-destructive/10"
                    style={{ color: "var(--destructive)" }}
                    aria-label="Delete permanently"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
