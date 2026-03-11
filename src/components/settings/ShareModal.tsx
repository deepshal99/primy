"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Check, Copy, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
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
  const backdropRef = useRef<HTMLDivElement>(null);

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
              style={{ background: isShared ? "#ff4a00" : "#e8e8ed" }}
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
                    : "bg-[#ff4a00] text-white hover:bg-[#e54400]"
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
        </div>
      </div>
    </div>
  );
}
