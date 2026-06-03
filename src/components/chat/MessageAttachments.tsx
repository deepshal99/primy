"use client";

import { FileAttachment } from "@/lib/types";
import { formatFileSize } from "@/lib/fileUtils";
import { getFileTypeStyle } from "@/lib/fileStyle";

interface MessageAttachmentsProps {
  attachments: FileAttachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {attachments.map((att) => {
        const style = getFileTypeStyle(att.type);
        const Icon = style.icon;

        // Images show as the thumbnail itself — the picture is the content, so
        // a uuid filename and byte count just add noise. Files keep the labeled
        // pill, where the name and size actually carry meaning.
        if (att.type === "image" && att.previewUrl) {
          return (
            <img
              key={att.id}
              src={att.previewUrl}
              alt={att.name}
              className="max-w-[220px] max-h-[180px] w-auto h-auto rounded-[14px] object-cover outline outline-1 -outline-offset-1 outline-[rgba(24,24,22,0.08)] shadow-[var(--shadow-card)]"
            />
          );
        }

        return (
          <div
            key={att.id}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-[12px] bg-card border border-border shadow-[var(--shadow-card)]"
          >
            <div
              className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: style.grad }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.6} style={{ color: style.color }} />
            </div>
            <div className="flex flex-col min-w-0 gap-px">
              <span className="text-[12px] font-medium truncate max-w-[150px] text-foreground leading-tight">
                {att.name}
              </span>
              <span className="text-[10.5px] text-muted-foreground leading-tight tabular-nums">
                {att.size ? formatFileSize(att.size) : style.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
