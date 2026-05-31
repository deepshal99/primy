import { FileText, Table2, Presentation, LayoutTemplate } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EntityType } from "@/lib/types";

/**
 * Single source of truth for per-entity-type presentation: color, light tint,
 * icon, singular label, and plural group label. Previously each of these was
 * re-declared in ~6 components — and drifted (doc was #2a6dfb in the breadcrumb
 * but #4a7aed on its card/chat). Canonical palette matches the design system
 * (CLAUDE.md: doc bluetron, sheet forest, deck heat, page amethyst).
 */
export interface EntityMeta {
  label: string; // singular, e.g. "Document"
  group: string; // plural section header, e.g. "Documents"
  color: string; // vivid accent for icons / dots / active glyphs
  bg: string; // light tint for chips / card backgrounds
  Icon: LucideIcon;
}

export const ENTITY_META: Record<EntityType, EntityMeta> = {
  ku: { label: "Document", group: "Documents", color: "#2a6dfb", bg: "#eef3fd", Icon: FileText },
  table: { label: "Spreadsheet", group: "Sheets", color: "#42c366", bg: "#eafaef", Icon: Table2 },
  deck: { label: "Presentation", group: "Decks", color: "#fa5d19", bg: "#fef0e8", Icon: Presentation },
  page: { label: "Page", group: "Pages", color: "#9061ff", bg: "#f3eeff", Icon: LayoutTemplate },
};
