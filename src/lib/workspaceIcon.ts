/**
 * Deterministic workspace identity — a stable glyph + accent per workspace id,
 * shared by the Workspaces directory and (in future) the sidebar Recents, so a
 * workspace always looks the same wherever it appears.
 *
 * Accents are drawn from the brand candy set, restricted to the four calm hues:
 * amber and green carry other meaning in the system (active dots / sheet), so
 * they are deliberately excluded from workspace identity.
 *
 * This is the interim until workspaces carry a user-set icon column (brand logo
 * / glyph / lettermark picker) — at which point that persisted choice wins.
 */

import { Rocket, Orbit, Compass, Layers, Target, Box, Hexagon, Flame } from "lucide-react";
import { hashOf } from "@/lib/format";

const GLYPHS = [Rocket, Orbit, Compass, Layers, Target, Box, Hexagon, Flame] as const;
export type WorkspaceGlyph = (typeof GLYPHS)[number];

const ACCENTS = ["#4285F4", "#8757D7", "#67CEC8", "#F073A7"] as const;
const TYPE_ACCENT: Record<string, string> = {
  Design: "#8757D7", Research: "#4285F4", Marketing: "#F073A7", Finance: "#67CEC8",
  People: "#F073A7", Content: "#67CEC8", Engineering: "#4285F4", Sales: "#F073A7", Other: "#8757D7",
};

export function workspaceGlyph(id: string): WorkspaceGlyph {
  return GLYPHS[hashOf(id) % GLYPHS.length];
}

export function workspaceAccent(id: string, projectType?: string): string {
  return (projectType && TYPE_ACCENT[projectType]) || ACCENTS[hashOf(id) % ACCENTS.length];
}
