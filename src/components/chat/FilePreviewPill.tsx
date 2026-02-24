"use client";

import { X, FileText, Image as ImageIcon, File, Loader2 } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";
import { design } from "@/lib/design";

interface FilePreviewPillProps {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

const iconMap = {
  text: FileText,
  pdf: FileText,
  docx: FileText,
  image: ImageIcon,
} as const;

export function FilePreviewPill({ attachment, onRemove }: FilePreviewPillProps) {
  const Icon = iconMap[attachment.type] || File;

  return (
    <div className="animate-scale-in flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] group">
      {/* Thumbnail or icon */}
      {attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="w-8 h-8 rounded object-cover"
        />
      ) : (
        <div
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ backgroundColor: design.colors.brand.subtle }}
        >
          <Icon
            className="w-3.5 h-3.5"
            style={{ color: design.colors.brand.primary }}
            strokeWidth={1.5}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-label text-[var(--color-text-primary)] truncate max-w-[120px]">
          {attachment.name}
        </span>
        <span className="text-label-xs text-[var(--color-text-muted)]">
          {attachment.isExtracting ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Extracting...
            </span>
          ) : (
            formatFileSize(attachment.size)
          )}
        </span>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(attachment.id)}
        className="p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
