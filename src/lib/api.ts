// API client for Neon persistence
// Used by the Zustand store to sync with the server

import { Project } from "./types";

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    if (res.status === 401) return []; // Not authenticated
    throw new Error("Failed to fetch projects");
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
  updates: Record<string, any>
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") console.error("[Drafta] Failed to sync project to server:", res.status);
    return { ok: false };
  }
  return { ok: true };
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
