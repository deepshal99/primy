"use client";

import { FileText, Image as ImageIcon, File, FolderArchive } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";

interface MessageAttachmentsProps {
  attachments: FileAttachment[];
}

const iconMap = {
  text: FileText,
  pdf: FileText,
  docx: FileText,
  xlsx: FileText,
  image: ImageIcon,
  zip: FolderArchive,
} as const;

const labelMap: Record<string, string> = {
  text: "TXT",
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  image: "IMG",
  zip: "ZIP",
};

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {attachments.map((att) => {
        const Icon = iconMap[att.type] || File;

        return (
          <div
            key={att.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card"
          >
            {att.previewUrl ? (
              <img
                src={att.previewUrl}
                alt={att.name}
                className="w-6 h-6 rounded object-cover"
              />
            ) : (
              <Icon className="w-3 h-3 text-icon" strokeWidth={1.5} />
            )}
            <span className="text-[11px] font-medium truncate max-w-[100px] text-foreground">
              {att.name}
            </span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase">
              {labelMap[att.type] || att.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}
