"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RotateCcw, Save, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/lib/confirm";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Version history panel — list, save, restore artifact snapshots.
 *
 * Mounted from the toolbar of DocView / SheetView / DeckBuilder. The
 * caller passes the artifact type + id and (optionally) a getter to
 * pull the current artifact content for the "Save version now"
 * action. After a successful restore, onRestored fires so the
 * caller can refresh its editor state from the server.
 */

export type ArtifactType = "ku" | "table" | "deck";

export interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  type: ArtifactType;
  id: string;
  /** Returns current artifact content for "Save version now". */
  getCurrentContent?: () => unknown;
  /** Called after a successful restore. Caller should refresh editor. */
  onRestored?: (content: unknown) => void;
}

interface SnapshotMeta {
  id: string;
  label: string | null;
  createdAt: number;
}

const ARTIFACT_NOUN: Record<ArtifactType, string> = {
  ku: "document",
  table: "spreadsheet",
  deck: "deck",
};

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

function formatAbsolute(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function VersionHistoryPanel({
  open,
  onClose,
  type,
  id,
  getCurrentContent,
  onRestored,
}: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());

  const noun = ARTIFACT_NOUN[type];

  const fetchList = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/snapshots/${type}/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSnapshots(data.snapshots ?? []);
    } catch (err) {
      console.warn("[snapshots] list fetch failed:", err);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    if (open) {
      fetchList();
      setNow(Date.now());
    }
  }, [open, fetchList]);

  const handleSaveNow = useCallback(async () => {
    if (!getCurrentContent) return;
    const content = getCurrentContent();
    if (content === undefined || content === null) {
      toast.error("Nothing to save yet.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/snapshots/${type}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          label: labelInput.trim() || "Manual save",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLabelInput("");
      toast.success("Version saved");
      await fetchList();
    } catch (err) {
      console.error("[snapshots] save failed:", err);
      toast.error("Couldn't save version. Try again.");
    } finally {
      setSaving(false);
    }
  }, [getCurrentContent, type, id, labelInput, fetchList]);

  const handleRestore = useCallback(
    async (snapshotId: string, snapshotLabel: string | null, snapshotTs: number) => {
      const labelText =
        snapshotLabel?.trim() || formatAbsolute(snapshotTs) || "this version";
      const ok = await confirmDialog({
        title: `Restore to "${labelText}"?`,
        message: "Your current state is saved as a new version first, so you can undo if needed.",
        confirmLabel: "Restore",
      });
      if (!ok) return;

      setRestoringId(snapshotId);
      try {
        const res = await fetch(
          `/api/snapshots/${type}/${id}/${snapshotId}/restore`,
          { method: "POST" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        toast.success(`Restored to ${formatRelative(snapshotTs, Date.now())}`);
        onRestored?.(data?.content);
        onClose();
      } catch (err) {
        console.error("[snapshots] restore failed:", err);
        toast.error("Couldn't restore. Try again.");
      } finally {
        setRestoringId(null);
      }
    },
    [type, id, onRestored, onClose]
  );

  const list = useMemo(() => snapshots ?? [], [snapshots]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent
        className="max-w-[560px] p-0 gap-0 overflow-hidden"
        style={{ borderRadius: 12 }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary border border-border"
              aria-hidden
            >
              <History className="w-4 h-4 text-icon" />
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-[15px] font-medium text-foreground leading-tight">
                Version history
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground leading-tight mt-0.5">
                Restore any version of this {noun}. Primy saves a version after
                each AI edit.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col max-h-[60vh]">
          {/* Save row */}
          {getCurrentContent && (
            <div className="px-6 py-4 border-b border-border bg-secondary/40">
              <div className="flex items-center gap-2">
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Label (optional), e.g. before client review"
                  className="flex-1 h-9 text-[13px]"
                  disabled={saving}
                  maxLength={100}
                />
                <Button
                  onClick={handleSaveNow}
                  disabled={saving}
                  className="h-9 px-3 text-[13px] gap-1.5"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving…" : "Save version now"}
                </Button>
              </div>
            </div>
          )}

          {/* List */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 tabular-nums"
            style={{ fontFeatureSettings: "'tnum'" }}
          >
            {loading && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && list.length === 0 && (
              <EmptyState
                size="sm"
                icon={Clock}
                title="No saved versions yet"
                description={`Primy saves a version automatically after the next AI edit to this ${noun}.`}
              />
            )}

            {!loading && list.length > 0 && (
              <ul className="space-y-1">
                {list.map((snap) => (
                  <li
                    key={snap.id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary border border-border shrink-0"
                      aria-hidden
                    >
                      <Clock className="w-3.5 h-3.5 text-icon" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] text-foreground font-medium truncate"
                        title={snap.label ?? formatAbsolute(snap.createdAt)}
                      >
                        {snap.label || "Auto-saved"}
                      </div>
                      <div
                        className="text-[12px] text-muted-foreground truncate"
                        title={formatAbsolute(snap.createdAt)}
                      >
                        {formatRelative(snap.createdAt, now)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={restoringId === snap.id}
                      onClick={() =>
                        handleRestore(snap.id, snap.label, snap.createdAt)
                      }
                      className="h-8 px-2.5 text-[12.5px] gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {restoringId === snap.id ? "Restoring…" : "Restore"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
