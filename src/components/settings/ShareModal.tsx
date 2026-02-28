"use client";

import { useState, useEffect } from "react";
import { X, Link2, Copy, Check, Globe, Lock, Loader2 } from "lucide-react";
import { design } from "@/lib/design";
import { toast } from "sonner";

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

  const isShared = !!currentToken;
  const shareUrl = currentToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${currentToken}`
    : "";

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  if (!open) return null;

  const toggleShare = async () => {
    setLoading(true);
    try {
      const endpoint =
        mode === "project"
          ? `/api/projects/${entityId}/share`
          : `/api/files/${entityId}/share`;

      if (isShared) {
        // Unshare
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to unshare");
        onTokenChange(null);
        toast.success("Sharing disabled");
      } else {
        // Share
        const res = await fetch(endpoint, { method: "POST" });
        if (!res.ok) throw new Error("Failed to share");
        const data = await res.json();
        onTokenChange(data.shareToken);
        toast.success("Share link created");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[420px] rounded-xl border mx-4 animate-scale-in"
        style={{
          backgroundColor: design.colors.bg.elevated,
          borderColor: design.colors.border.default,
          boxShadow: design.shadows.xl,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: design.colors.border.light }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: design.colors.brand.subtle }}
            >
              <Link2 className="w-4 h-4" style={{ color: design.colors.brand.primary }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: design.colors.text.primary }}>
                Share {mode === "project" ? "Project" : "File"}
              </p>
              <p className="text-[11px]" style={{ color: design.colors.text.muted }}>
                {entityTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: design.colors.text.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: isShared ? design.colors.brand.subtle : design.colors.bg.secondary,
                }}
              >
                {isShared ? (
                  <Globe className="w-4.5 h-4.5" style={{ color: design.colors.brand.primary }} />
                ) : (
                  <Lock className="w-4.5 h-4.5" style={{ color: design.colors.text.muted }} />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium" style={{ color: design.colors.text.primary }}>
                  {isShared ? "Anyone with the link can view" : "Only you can access"}
                </p>
                <p className="text-[11px]" style={{ color: design.colors.text.muted }}>
                  {isShared ? "Read-only access, no editing" : "Enable sharing to create a public link"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleShare}
              disabled={loading}
              className="relative w-[44px] h-[24px] rounded-full transition-colors duration-200 flex-shrink-0"
              style={{
                backgroundColor: isShared ? design.colors.brand.primary : design.colors.border.focus,
              }}
            >
              {loading ? (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ color: "white" }}
                />
              ) : (
                <div
                  className="absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all duration-200"
                  style={{
                    left: isShared ? "22px" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              )}
            </button>
          </div>

          {/* Share URL */}
          {isShared && (
            <div className="animate-fade-in">
              <p className="text-[11px] font-medium mb-1.5" style={{ color: design.colors.text.secondary }}>
                Share link
              </p>
              <div
                className="flex items-center gap-2 p-2 rounded-lg border"
                style={{
                  backgroundColor: design.colors.bg.primary,
                  borderColor: design.colors.border.default,
                }}
              >
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-[12px] bg-transparent outline-none truncate px-1"
                  style={{ color: design.colors.text.primary }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors flex-shrink-0"
                  style={{
                    backgroundColor: copied ? design.colors.status.successBg : design.colors.brand.primary,
                    color: copied ? design.colors.status.success : design.colors.brand.text,
                  }}
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5" /> Copied</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
