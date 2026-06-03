import { FileText, Image as ImageIcon, File, FolderArchive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { entityGradient } from "@/lib/entityMeta";

/**
 * Single source of truth for how a file attachment is presented — icon,
 * accent color, soft chip background, and short type label. Shared by the
 * pre-send composer pill (`FilePreviewPill`) and the sent-message pill
 * (`MessageAttachments`) so the two never drift apart.
 *
 * Colors are aligned to the canonical brand/entity palette (doc blue
 * #4285F4, sheet forest #42c366, page purple #8757D7, deck amber). The
 * icon rides a same-hue alpha chip, so the pair reads correctly in both
 * light and dark without per-theme overrides.
 */
export interface FileTypeStyle {
  icon: LucideIcon;
  color: string;
  bg: string; // flat wash (fallback / neutral types)
  grad: string; // soft same-hue gradient for the icon chip
  label: string;
}

const FILE_TYPE_STYLE: Record<string, FileTypeStyle> = {
  text: { icon: FileText, color: "var(--ink-3)", bg: "var(--muted)", grad: "var(--muted)", label: "TXT" },
  pdf: { icon: FileText, color: "#E5484D", bg: "rgba(229,72,77,0.12)", grad: entityGradient("229,72,77", 0.2), label: "PDF" },
  docx: { icon: FileText, color: "#4285F4", bg: "rgba(66,133,244,0.12)", grad: entityGradient("66,133,244", 0.2), label: "DOCX" },
  xlsx: { icon: FileText, color: "#42c366", bg: "rgba(66,195,102,0.14)", grad: entityGradient("66,195,102", 0.22), label: "XLSX" },
  image: { icon: ImageIcon, color: "#8757D7", bg: "rgba(135,87,215,0.12)", grad: entityGradient("135,87,215", 0.2), label: "IMG" },
  zip: { icon: FolderArchive, color: "#E0922F", bg: "rgba(255,173,69,0.16)", grad: entityGradient("255,173,69", 0.28), label: "ZIP" },
};

export function getFileTypeStyle(type: string): FileTypeStyle {
  return (
    FILE_TYPE_STYLE[type] || {
      icon: File,
      color: "var(--ink-3)",
      bg: "var(--muted)",
      grad: "var(--muted)",
      label: (type || "file").toUpperCase(),
    }
  );
}
