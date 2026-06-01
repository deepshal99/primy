import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { EntityType } from "@/lib/types";

export const DRAFTA_SCHEME = "drafta://";

/** Matches drafta://<type>/<id> inside arbitrary text (g flag for scanning). */
export const DRAFTA_URI_RE = /drafta:\/\/(ku|table|deck|page)\/([A-Za-z0-9_-]+)/g;

export interface EntityRef {
  id: string;
  type: EntityType;
  title: string;
}

/** Build a stable cross-link URI. */
export function formatEntityUri(type: EntityType, id: string): string {
  return `${DRAFTA_SCHEME}${type}/${id}`;
}

/** Parse a single drafta:// URI. Returns null if it isn't one or is malformed. */
export function parseEntityUri(uri: string): { type: EntityType; id: string } | null {
  if (!uri || !uri.startsWith(DRAFTA_SCHEME)) return null;
  const rest = uri.slice(DRAFTA_SCHEME.length); // "<type>/<id>"
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const type = rest.slice(0, slash) as EntityType;
  const id = rest.slice(slash + 1);
  if (!id) return null;
  if (type !== "ku" && type !== "table" && type !== "deck" && type !== "page") return null;
  return { type, id };
}

/** The Slate node shape for an inline cross-link chip. */
export interface MentionNode {
  type: "mention";
  entityType: EntityType;
  entityId: string;
  value: string; // title snapshot for graceful display if target is deleted
  children: [{ text: "" }];
}

export function createMentionNode(ref: EntityRef): MentionNode {
  return {
    type: "mention",
    entityType: ref.type,
    entityId: ref.id,
    value: ref.title,
    children: [{ text: "" }],
  };
}

/** Open an entity by type using the existing store actions. */
export function openEntity(type: EntityType, id: string): void {
  const s = useAppStore.getState();
  switch (type) {
    case "ku":
      s.openKnowledgeUnit(id);
      break;
    case "table":
      s.openTable(id);
      break;
    case "deck":
      s.openDeck(id);
      break;
    case "page":
      s.openPage(id);
      break;
  }
}

/** Collect every entity in the current project as EntityRef[] (for the picker). */
export function useProjectEntities(): EntityRef[] {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const out: EntityRef[] = [];
    for (const ku of project.knowledgeUnits || []) out.push({ id: ku.id, type: "ku", title: ku.title });
    for (const t of project.tables || []) out.push({ id: t.id, type: "table", title: t.title });
    for (const d of project.decks || []) out.push({ id: d.id, type: "deck", title: d.title });
    for (const p of project.pages || []) out.push({ id: p.id, type: "page", title: p.title });
    return out;
  }, [projects, currentProjectId]);
}

/** Resolve an entity's current title; undefined if it no longer exists. */
export function useResolvedEntity(type: EntityType, id: string): EntityRef | undefined {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return undefined;
    const list =
      type === "ku" ? project.knowledgeUnits
      : type === "table" ? project.tables
      : type === "deck" ? project.decks
      : project.pages;
    const found = (list || []).find((e: { id: string }) => e.id === id) as { id: string; title: string } | undefined;
    return found ? { id, type, title: found.title } : undefined;
  }, [projects, currentProjectId, type, id]);
}

/** Documents that reference the given entity id (scans markdown content). */
export function useBacklinks(targetId: string | null): EntityRef[] {
  const projects = useAppStore((s) => s.projects);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  return useMemo(() => {
    if (!targetId) return [];
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const out: EntityRef[] = [];
    for (const ku of project.knowledgeUnits || []) {
      if (ku.id === targetId) continue; // no self-backlink
      const content: string = ku.content || "";
      if (content.includes(`${DRAFTA_SCHEME}`) && content.includes(`/${targetId}`)) {
        DRAFTA_URI_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        let hit = false;
        while ((m = DRAFTA_URI_RE.exec(content)) !== null) {
          if (m[2] === targetId) { hit = true; break; }
        }
        if (hit) out.push({ id: ku.id, type: "ku", title: ku.title });
      }
    }
    return out;
  }, [projects, currentProjectId, targetId]);
}
