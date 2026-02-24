"use client";

import { FileText, Image as ImageIcon, File } from "lucide-react";
import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";
import { design } from "@/lib/design";

interface MessageAttachmentsProps {
  attachments: FileAttachment[];
}

const iconMap = {
  text: FileText,
  pdf: FileText,
  docx: FileText,
  image: ImageIcon,
} as const;

const labelMap: Record<string, string> = {
  text: "TXT",
  pdf: "PDF",
  docx: "DOCX",
  image: "IMG",
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
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/20 bg-white/10"
          >
            {att.previewUrl ? (
              <img
                src={att.previewUrl}
                alt={att.name}
                className="w-6 h-6 rounded object-cover"
              />
            ) : (
              <Icon className="w-3 h-3 opacity-70" strokeWidth={1.5} />
            )}
            <span className="text-label truncate max-w-[100px] opacity-90">
              {att.name}
            </span>
            <span className="text-label-xs px-1 py-0.5 rounded bg-white/10 font-medium uppercase opacity-60">
              {labelMap[att.type] || att.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}
