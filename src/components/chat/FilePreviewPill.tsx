"use client";

import { X, FileText, Image as ImageIcon, File, FolderArchive, Loader2 } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";

interface FilePreviewPillProps {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

const FILE_STYLE: Record<string, { icon: typeof File; color: string; bg: string }> = {
  text: { icon: FileText, color: "#737373", bg: "#f5f5f3" },
  pdf: { icon: FileText, color: "#ef4444", bg: "rgba(239,68,68,0.06)" },
  docx: { icon: FileText, color: "#4a7aed", bg: "rgba(74,122,237,0.06)" },
  xlsx: { icon: FileText, color: "#2e9e47", bg: "rgba(46,158,71,0.06)" },
  image: { icon: ImageIcon, color: "#7c5cb8", bg: "rgba(124,92,184,0.06)" },
  zip: { icon: FolderArchive, color: "#d4582a", bg: "rgba(212,88,42,0.06)" },
};

export function FilePreviewPill({ attachment, onRemove }: FilePreviewPillProps) {
  const style = FILE_STYLE[attachment.type] || { icon: File, color: "#737373", bg: "#f5f5f3" };
  const Icon = style.icon;

  return (
    <div className="animate-scale-in flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 rounded-[14px] bg-[#fafaf8] border border-[#e8e7e4] group hover:border-[#dddfe3] t-colors">
      {/* Thumbnail or icon */}
      {attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="w-8 h-8 rounded-[8px] object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: style.bg }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: style.color }} />
        </div>
      )}

      {/* File info */}
      <div className="flex flex-col min-w-0 gap-px">
        <span className="text-[11px] font-medium text-[#1a1a1a] truncate max-w-[130px] leading-tight">
          {attachment.name}
        </span>
        <span className="text-[10px] text-[#a3a3a3] leading-tight">
          {attachment.isExtracting ? (
            <span className="flex items-center gap-1 text-[#ff4a00]">
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
        className="w-5 h-5 rounded-full flex items-center justify-center text-[#a3a3a3] hover:text-[#555555] hover:bg-[#f0f0ee] t-fast cursor-pointer flex-shrink-0"
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="w-3 h-3" strokeWidth={2} />
      </button>
    </div>
  );
}
