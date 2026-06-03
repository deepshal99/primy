"use client";

import { X, Loader2 } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";
import { getFileTypeStyle } from "@/lib/fileStyle";

interface FilePreviewPillProps {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

export function FilePreviewPill({ attachment, onRemove }: FilePreviewPillProps) {
  const style = getFileTypeStyle(attachment.type);
  const Icon = style.icon;

  // Images preview as the thumbnail itself with a corner remove button — the
  // picture is the content, so a name + byte count is just noise (matches the
  // sent-message treatment and the familiar ChatGPT composer pattern).
  if (attachment.type === "image" && attachment.previewUrl) {
    return (
      <div className="animate-scale-in group relative">
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="w-16 h-16 rounded-[12px] object-cover outline outline-1 -outline-offset-1 outline-[rgba(24,24,22,0.08)] shadow-[var(--shadow-card)]"
        />
        {attachment.isExtracting && (
          <div className="absolute inset-0 rounded-[12px] flex items-center justify-center bg-[rgba(24,24,22,0.45)]">
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          </div>
        )}
        <button
          onClick={() => onRemove(attachment.id)}
          className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-[var(--ink)] text-[var(--card)] shadow-[var(--shadow-card)] hover:scale-110 active:scale-95 t-fast cursor-pointer"
          aria-label={`Remove ${attachment.name}`}
        >
          <X className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="animate-scale-in group flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-[14px] bg-card border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] t-fast">
      {/* Tinted icon chip */}
      <div
        className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
        style={{ background: style.grad }}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: style.color }} />
      </div>

      {/* File info */}
      <div className="flex flex-col min-w-0 gap-px">
        <span className="text-[11px] font-medium text-foreground truncate max-w-[130px] leading-tight">
          {attachment.name}
        </span>
        <span className="text-[10px] text-muted-foreground leading-tight tabular-nums">
          {attachment.isExtracting ? (
            <span className="flex items-center gap-1 text-[var(--accent-amber-deep)]">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Processing...
            </span>
          ) : (
            formatFileSize(attachment.size)
          )}
        </span>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(attachment.id)}
        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent active:scale-[0.96] t-fast cursor-pointer flex-shrink-0"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="w-3 h-3" strokeWidth={2} />
      </button>
    </div>
  );
}
