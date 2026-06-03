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
  bg: string; // flat light tint for small chips / inline highlights
  grad: string; // soft same-hue diagonal gradient for icon tiles / boxes
  Icon: LucideIcon;
}

// Entity palette — softened to match the warm Strut personality and the hero
// illustration's tones (cornflower #5C8CEF, warm amber #F4A24C, teal #69CEC8),
// rather than harsh saturated primaries. Distinct enough to ID type at a glance,
// but calm and harmonious with the warm near-white shell.
// doc cornflower · sheet soft emerald · deck warm amber · page soft violet.
/**
 * Builds a subtle same-hue diagonal gradient for an entity's icon tile. The
 * fill is stronger at the top-left and fades toward the bottom-right, giving
 * the box a little depth instead of reading as a flat color block. `peak` is
 * the top-left alpha — amber needs a higher peak than blue/green/violet to
 * carry the same visual weight (it's the lightest hue). Pair with a flat `bg`
 * for small chips/highlights where a gradient would be noise.
 */
export function entityGradient(rgb: string, peak: number): string {
  return `linear-gradient(150deg, rgba(${rgb},${peak}) 0%, rgba(${rgb},${(peak * 0.46).toFixed(3)}) 55%, rgba(${rgb},${(peak * 0.22).toFixed(3)}) 100%)`;
}

export const ENTITY_META: Record<EntityType, EntityMeta> = {
  ku: { label: "Document", group: "Documents", color: "#5B8DEF", bg: "#EDF2FE", grad: entityGradient("91,141,239", 0.22), Icon: FileText },
  table: { label: "Spreadsheet", group: "Sheets", color: "#4FB084", bg: "#E8F6EF", grad: entityGradient("79,176,132", 0.24), Icon: Table2 },
  deck: { label: "Presentation", group: "Decks", color: "#F2A24C", bg: "#FCF1E0", grad: entityGradient("242,162,76", 0.32), Icon: Presentation },
  page: { label: "Page", group: "Pages", color: "#9173E0", bg: "#F1ECFC", grad: entityGradient("145,115,224", 0.22), Icon: LayoutTemplate },
};
