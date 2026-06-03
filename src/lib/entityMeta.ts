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

// Entity palette — softened to match the warm Strut personality and the hero
// illustration's tones (cornflower #5C8CEF, warm amber #F4A24C, teal #69CEC8),
// rather than harsh saturated primaries. Distinct enough to ID type at a glance,
// but calm and harmonious with the warm near-white shell.
// doc cornflower · sheet soft emerald · deck warm amber · page soft violet.
export const ENTITY_META: Record<EntityType, EntityMeta> = {
  ku: { label: "Document", group: "Documents", color: "#5B8DEF", bg: "#EDF2FE", Icon: FileText },
  table: { label: "Spreadsheet", group: "Sheets", color: "#4FB084", bg: "#E8F6EF", Icon: Table2 },
  deck: { label: "Presentation", group: "Decks", color: "#F2A24C", bg: "#FCF1E0", Icon: Presentation },
  page: { label: "Page", group: "Pages", color: "#9173E0", bg: "#F1ECFC", Icon: LayoutTemplate },
};
