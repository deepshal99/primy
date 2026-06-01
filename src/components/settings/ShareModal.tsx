"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Check, Copy, Loader2, X, UserPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

interface Member {
  userId: string;
  role: string;
  email: string;
  name: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  commenter: "Commenter",
  viewer: "Viewer",
};

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  mode: "file" | "project";
  entityId: string;
  entityTitle: string;
  currentToken: string | null | undefined;
  onTokenChange: (token: string | null) => void;
}

export function ShareModal({
  open,
  onClose,
  mode,
  entityId,
  entityTitle,
  currentToken,
  onTokenChange,
}: ShareModalProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // ── Members / invites (project mode only) ──
  const currentProjectRole = useAppStore((s) => s.currentProjectRole);
  const isOwner = currentProjectRole === "owner" || currentProjectRole === null;
  const showMembers = mode === "project";
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!showMembers) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/projects/${entityId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      /* non-fatal */
    } finally {
      setMembersLoading(false);
    }
  }, [showMembers, entityId]);

  useEffect(() => {
    if (open && showMembers) fetchMembers();
  }, [open, showMembers, fetchMembers]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/projects/${entityId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add this person");
      setInviteEmail("");
      toast.success(`Added ${email}`);
      fetchMembers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add this person");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (m: Member) => {
    try {
      const res = await fetch(`/api/projects/${entityId}/members?userId=${encodeURIComponent(m.userId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't remove");
      setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove");
    }
  };

  const isShared = !!currentToken;
  const shareUrl = currentToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${currentToken}`
    : "";

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const toggleShare = async () => {
    setLoading(true);
    try {
      const endpoint =
        mode === "project"
          ? `/api/projects/${entityId}/share`
          : `/api/files/${entityId}/share`;

      if (isShared) {
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to unshare");
        onTokenChange(null);
        toast.success("Sharing disabled");
      } else {
        const res = await fetch(endpoint, { method: "POST" });
        if (!res.ok) throw new Error("Failed to share");
        const data = await res.json();
        onTokenChange(data.shareToken);
        toast.success("Share link created");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }, [shareUrl]);

  if (!open) return null;

  const title =
    mode === "project"
      ? "Share project"
      : `Share "${entityTitle}"`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-[calc(100%-2rem)] bg-background border border-border rounded-2xl shadow-xl animate-scale-in"
        style={{ maxWidth: 440 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <h2 className="text-lg font-semibold text-foreground pr-8 truncate mb-6">
            {title}
          </h2>

          {/* Toggle row */}
          <div className="flex items-center justify-between gap-4 mb-1">
            <div>
              <div className="text-[14px] text-foreground font-medium">Enable link sharing</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">Anyone with the link can view</div>
            </div>
            <button
              onClick={toggleShare}
              disabled={loading}
              className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 cursor-pointer"
              style={{ background: isShared ? "#1A1815" : "#e8e8ed" }}
              aria-label={isShared ? "Disable sharing" : "Enable sharing"}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
              ) : (
                <div
                  className="absolute top-[2px] w-5 h-5 rounded-full bg-white t-normal"
                  style={{
                    left: isShared ? "22px" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              )}
            </button>
          </div>

          {/* Link row */}
          {isShared && (
            <div className="flex gap-2 mt-5">
              <div className="flex-1 h-10 bg-muted rounded-lg px-3 flex items-center gap-2 overflow-hidden">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-[13px] text-muted-foreground truncate select-all">
                  {shareUrl}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  "h-10 px-3.5 rounded-lg text-[13px] font-medium t-fast flex items-center gap-1.5 flex-shrink-0 cursor-pointer",
                  copied
                    ? "bg-[#2e9e47] text-white"
                    : "bg-[#1A1815] text-white hover:bg-black"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                    Copy
                  </>
                )}
              </button>
            </div>
          )}

          {/* People with access (project only) */}
          {showMembers && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="text-[14px] text-foreground font-medium mb-3">People with access</div>

              {/* Invite row — owners only */}
              {isOwner && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
                    placeholder="Add by email…"
                    className="flex-1 h-9 px-3 rounded-lg bg-muted text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[#4285F4]/30 t-fast"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-muted text-[13px] text-foreground outline-none cursor-pointer focus:ring-2 focus:ring-[#4285F4]/30"
                    aria-label="Role"
                  >
                    <option value="editor">Editor</option>
                    <option value="commenter">Commenter</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="h-9 px-3 rounded-lg bg-[#1A1815] text-white text-[13px] font-medium flex items-center gap-1.5 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed t-fast cursor-pointer"
                  >
                    {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />}
                    Add
                  </button>
                </div>
              )}

              {/* Member list */}
              {membersLoading ? (
                <div className="flex items-center gap-2 py-2 text-[12px] text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : members.length === 0 ? (
                <div className="text-[12px] text-muted-foreground py-1">Just you so far.</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {members.map((m) => (
                    <div key={m.userId} className="group flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/60 t-fast">
                      <div className="w-7 h-7 rounded-full bg-[#4285F4]/12 text-[#2c5fb3] flex items-center justify-center text-[12px] font-semibold flex-shrink-0 uppercase">
                        {(m.name || m.email || "?").charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-foreground truncate leading-tight">{m.name || m.email}</div>
                        {m.name && <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">{ROLE_LABELS[m.role] || m.role}</span>
                      {isOwner && m.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(m)}
                          className="p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-[#e5484d] t-fast cursor-pointer"
                          aria-label={`Remove ${m.email}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
