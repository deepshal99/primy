"use client";

import { X, FileText, Image as ImageIcon, File, FolderArchive, Loader2 } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";

interface FilePreviewPillProps {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

const iconMap = {
  text: FileText,
  pdf: FileText,
  docx: FileText,
  xlsx: FileText,
  image: ImageIcon,
  zip: FolderArchive,
} as const;

export function FilePreviewPill({ attachment, onRemove }: FilePreviewPillProps) {
  const Icon = iconMap[attachment.type] || File;

  return (
    <div className="animate-scale-in flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg border border-[#e8e7e4] bg-[#f5f4f1] group">
      {/* Thumbnail or icon */}
      {attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="w-8 h-8 rounded object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded flex items-center justify-center bg-[rgba(255,74,0,0.06)]">
          <Icon
            className="w-3.5 h-3.5 text-[#ff4a00]"
            strokeWidth={1.5}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium text-[#1a1a2e] truncate max-w-[120px]">
          {attachment.name}
        </span>
        <span className="text-[10px] text-[#95928E]">
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
        className="p-0.5 rounded hover:bg-[#e8e7e4] text-[#95928E] hover:text-[#6b6b80] transition-colors cursor-pointer"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
