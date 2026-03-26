// API client for Neon persistence
// Used by the Zustand store to sync with the server

import { Project, ProjectListItem, Message } from "./types";

/** Fetch lightweight project list (metadata + entity counts, no content) */
export async function fetchProjects(): Promise<ProjectListItem[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error("Failed to fetch projects");
  }
  return res.json();
}

/** Fetch full project with all entities and last 50 messages */
export async function fetchFullProject(id: string): Promise<Project & { hasMoreMessages: boolean }> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch project ${id}: ${res.status}`);
  }
  return res.json();
}

/** Fetch older messages before a given timestamp */
export async function fetchOlderMessages(
  projectId: string,
  before: number,
  limit = 50
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const beforeISO = new Date(before).toISOString();
  const res = await fetch(
    `/api/projects/${projectId}/messages?before=${encodeURIComponent(beforeISO)}&limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch messages: ${res.status}`);
  }
  return res.json();
}

export async function createProjectOnServer(
  project: { id: string; title: string; description?: string; projectType?: string }
): Promise<{ ok: boolean }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") console.error("[Drafta] Failed to create project on server:", res.status);
    return { ok: false };
  }
  return { ok: true };
}

export async function updateProjectOnServer(
  id: string,
  updates: Record<string, any>,
  retries = 2
): Promise<{ ok: boolean }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) return { ok: true };
      // Don't retry on 4xx (client errors)
      if (res.status >= 400 && res.status < 500) {
        if (process.env.NODE_ENV !== "production") console.error("[Drafta] Save rejected:", res.status);
        return { ok: false };
      }
      // Retry on 5xx
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (process.env.NODE_ENV !== "production") console.error("[Drafta] Failed to sync project to server after retries:", res.status);
      return { ok: false };
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return { ok: false };
}

export async function deleteProjectOnServer(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") console.error("[Drafta] Failed to delete project on server:", res.status);
    return { ok: false };
  }
  return { ok: true };
}
